const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { GoogleGenAI } = require('@google/genai');
const {
  calculateUSAqiFromPollutants,
  calculateIndianAqiFromPollutants,
  getCategoryLabel,
} = require('./utils/aqi');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

// Simple in-memory caches & rate limiting (per Cloud Function instance)
const aqCache = new Map();
const AQ_CACHE_TTL_MS = 5 * 60 * 1000;
const lastFirestorePersist = new Map();
const FIRESTORE_PERSIST_INTERVAL_MS = 15 * 60 * 1000;
const rateLimitMap = new Map();

function checkRateLimit(uid, maxPerMinute = 20) {
  const now = Date.now();
  const entry = rateLimitMap.get(uid) || { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60_000;
  }
  entry.count += 1;
  rateLimitMap.set(uid, entry);
  return entry.count <= maxPerMinute;
}

async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }
  const idToken = authHeader.slice(7).trim();
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.user.admin === true) {
    return next();
  }
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (userDoc.exists && userDoc.data().role === 'admin') {
      return next();
    }
    return res.status(403).json({ error: 'Administrator privileges required.' });
  } catch {
    return res.status(403).json({ error: 'Unable to verify administrator role.' });
  }
}

async function fetchOpenMeteoAirAndWeather(lat, lon, cityName, state = '', country = '') {
  const aqUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  aqUrl.searchParams.set('latitude', String(lat));
  aqUrl.searchParams.set('longitude', String(lon));
  aqUrl.searchParams.set(
    'current',
    'us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone'
  );
  aqUrl.searchParams.set('hourly', 'pm2_5,pm10,us_aqi');
  aqUrl.searchParams.set('past_days', '2');
  aqUrl.searchParams.set('forecast_days', '2');
  aqUrl.searchParams.set('timezone', 'auto');

  const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
  weatherUrl.searchParams.set('latitude', String(lat));
  weatherUrl.searchParams.set('longitude', String(lon));
  weatherUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,wind_speed_10m');
  weatherUrl.searchParams.set('timezone', 'auto');

  const [aqRes, weatherRes] = await Promise.all([fetch(aqUrl.toString()), fetch(weatherUrl.toString())]);
  if (!aqRes.ok) throw new Error(`Open-Meteo AQ HTTP ${aqRes.status}`);
  if (!weatherRes.ok) throw new Error(`Open-Meteo Weather HTTP ${weatherRes.status}`);

  const aqJson = await aqRes.json();
  const weatherJson = await weatherRes.json();
  const c = aqJson.current || {};
  const w = weatherJson.current || {};

  const pm25 = c.pm2_5 ?? null;
  const pm10 = c.pm10 ?? null;
  const aqiUS = c.us_aqi ?? calculateUSAqiFromPollutants(pm25, pm10);
  const aqiIN = calculateIndianAqiFromPollutants(pm25, pm10);
  const coordKey = `${Number(lat).toFixed(3)}_${Number(lon).toFixed(3)}`;

  return {
    city: cityName || 'Selected Location',
    state,
    country,
    coordinates: { lat: Number(lat), lon: Number(lon) },
    stationId: `openmeteo_${coordKey}`,
    stationName: `${cityName || 'Location'} Atmospheric Grid`,
    aqiUS,
    aqiIN,
    europeanAqi: c.european_aqi ?? null,
    pm25,
    pm10,
    no2: c.nitrogen_dioxide ?? null,
    so2: c.sulphur_dioxide ?? null,
    o3: c.ozone ?? null,
    co: c.carbon_monoxide ?? null,
    temperature: w.temperature_2m ?? null,
    humidity: w.relative_humidity_2m ?? null,
    windSpeed: w.wind_speed_10m ?? null,
    source: 'Open-Meteo Copernicus CAMS (Live)',
    standard: 'US EPA / CPCB NAQI',
    timestamp: c.time ? new Date(c.time).toISOString() : new Date().toISOString(),
    hourly: aqJson.hourly || null,
  };
}

async function fetchOpenAqStations(lat, lon, radiusKm = 30) {
  const apiKey = process.env.OPENAQ_API_KEY;
  if (!apiKey || apiKey.includes('your_openaq')) {
    return {
      status: 'not_configured',
      stations: [],
      message:
        'OPENAQ_API_KEY is not configured in functions/.env. Configure a free OpenAQ v3 API key to load ground monitoring sensors.',
    };
  }

  const radiusMeters = Math.min(Math.max(Number(radiusKm) * 1000, 1000), 25000);
  const locUrl = `https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=${radiusMeters}&limit=12`;

  const locRes = await fetch(locUrl, {
    headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
  });
  if (!locRes.ok) {
    throw new Error(`OpenAQ locations HTTP ${locRes.status}`);
  }
  const locJson = await locRes.json();
  const locations = locJson.results || [];

  const stations = await Promise.all(
    locations.slice(0, 8).map(async (loc) => {
      let pm25 = null;
      let pm10 = null;
      let latestTimestamp = loc.datetimeLast?.utc || null;

      try {
        const latestRes = await fetch(`https://api.openaq.org/v3/locations/${loc.id}/latest`, {
          headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
        });
        if (latestRes.ok) {
          const latestJson = await latestRes.json();
          const sensors = loc.sensors || [];
          const sensorParamMap = new Map(sensors.map((s) => [s.id, s.parameter?.name]));
          for (const m of latestJson.results || []) {
            const pName = sensorParamMap.get(m.sensorsId);
            if (pName === 'pm25') pm25 = m.value;
            if (pName === 'pm10') pm10 = m.value;
            if (m.datetime?.utc) latestTimestamp = m.datetime.utc;
          }
        }
      } catch {
        // Keep partial station metadata
      }

      return {
        id: `openaq_${loc.id}`,
        openAqId: loc.id,
        name: loc.name || `Station #${loc.id}`,
        lat: loc.coordinates?.latitude,
        lon: loc.coordinates?.longitude,
        pm25,
        pm10,
        aqiUS: calculateUSAqiFromPollutants(pm25, pm10),
        aqiIN: calculateIndianAqiFromPollutants(pm25, pm10),
        timestamp: latestTimestamp || new Date().toISOString(),
        kind: 'ground_station',
        source: loc.provider?.name ? `OpenAQ (${loc.provider.name})` : 'OpenAQ v3',
      };
    })
  );

  return {
    status: 'ok',
    stations: stations.filter((s) => s.lat != null && s.lon != null),
    message: '',
  };
}

async function persistReadingIfDue(reading) {
  const now = Date.now();
  const lastWrite = lastFirestorePersist.get(reading.stationId) || 0;
  if (now - lastWrite < FIRESTORE_PERSIST_INTERVAL_MS) return;

  lastFirestorePersist.set(reading.stationId, now);
  try {
    await db.collection('airQualityReadings').add({
      stationId: reading.stationId,
      stationName: reading.stationName,
      city: reading.city,
      state: reading.state || '',
      country: reading.country || '',
      coordinates: reading.coordinates,
      aqiUS: reading.aqiUS,
      aqiIN: reading.aqiIN,
      category: getCategoryLabel(reading.aqiUS, 'US'),
      pm25: reading.pm25,
      pm10: reading.pm10,
      no2: reading.no2,
      so2: reading.so2,
      o3: reading.o3,
      co: reading.co,
      temperature: reading.temperature,
      humidity: reading.humidity,
      windSpeed: reading.windSpeed,
      source: reading.source,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('Failed to persist reading to Firestore:', err.message);
  }
}

// ==================== ROUTES ====================

app.get('/health', (_req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAqKey = process.env.OPENAQ_API_KEY;
  res.json({
    ok: true,
    service: 'PureCity AI Functions',
    geminiConfigured: Boolean(geminiKey && !geminiKey.includes('your_gemini')),
    openAqConfigured: Boolean(openAqKey && !openAqKey.includes('your_openaq')),
    timestamp: new Date().toISOString(),
  });
});

app.get('/air-quality', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const city = String(req.query.city || 'Guntur').slice(0, 100);
  const state = String(req.query.state || '').slice(0, 100);
  const country = String(req.query.country || '').slice(0, 100);

  if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
  }

  const key = `${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const cached = aqCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < AQ_CACHE_TTL_MS) {
    return res.json({ ...cached.data, isCached: true });
  }

  try {
    const reading = await fetchOpenMeteoAirAndWeather(lat, lon, city, state, country);
    aqCache.set(key, { fetchedAt: Date.now(), data: reading });
    await persistReadingIfDue(reading);
    return res.json({ ...reading, isCached: false });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Failed to retrieve live air quality data.' });
  }
});

app.get('/stations', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = Number(req.query.radius || 30);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
  }

  try {
    const result = await fetchOpenAqStations(lat, lon, radius);
    return res.json(result);
  } catch (err) {
    return res.status(502).json({ status: 'error', stations: [], error: err.message });
  }
});

app.post('/assistant', authenticateRequest, async (req, res) => {
  if (!checkRateLimit(req.user.uid, 20)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before asking again.' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey.includes('your_gemini')) {
    return res.status(503).json({
      code: 'GEMINI_NOT_CONFIGURED',
      error:
        'GEMINI_API_KEY is not configured in Firebase Cloud Functions. Set GEMINI_API_KEY in functions/.env or Firebase secrets to enable the AI Assistant.',
    });
  }

  const { message, cityContext, userPreferences, previousInteractionId } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'A non-empty message is required.' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message exceeds 2000 character limit.' });
  }

  // Ground the assistant with live context if coordinates were supplied
  let groundedReading = cityContext?.reading || null;
  if (!groundedReading && cityContext?.lat != null && cityContext?.lon != null) {
    try {
      groundedReading = await fetchOpenMeteoAirAndWeather(
        cityContext.lat,
        cityContext.lon,
        cityContext.name,
        cityContext.state,
        cityContext.country
      );
    } catch {
      groundedReading = null;
    }
  }

  const contextBlock = groundedReading && !groundedReading.unavailable
    ? [
      `Location: ${groundedReading.city || cityContext?.name || 'Unknown'}`,
      `US AQI: ${groundedReading.aqiUS ?? 'Unavailable'} (${getCategoryLabel(groundedReading.aqiUS, 'US')})`,
      `Indian CPCB AQI: ${groundedReading.aqiIN ?? 'Unavailable'} (${getCategoryLabel(groundedReading.aqiIN, 'IN')})`,
      `PM2.5: ${groundedReading.pm25 != null ? `${groundedReading.pm25} µg/m³` : 'Unavailable'}`,
      `PM10: ${groundedReading.pm10 != null ? `${groundedReading.pm10} µg/m³` : 'Unavailable'}`,
      `NO2: ${groundedReading.no2 ?? 'N/A'} µg/m³, O3: ${groundedReading.o3 ?? 'N/A'} µg/m³, SO2: ${groundedReading.so2 ?? 'N/A'} µg/m³`,
      `Weather: Temp ${groundedReading.temperature ?? 'N/A'}°C, Humidity ${groundedReading.humidity ?? 'N/A'}%, Wind ${groundedReading.windSpeed ?? 'N/A'} km/h`,
      `Data Source: ${groundedReading.source || 'Open-Meteo'} | Reading Timestamp: ${groundedReading.timestamp || 'Unknown'}`,
    ].join('\n')
    : `Location: ${cityContext?.name || 'Unknown'}\nLive Air Quality Data: UNAVAILABLE right now.`;

  const prefBlock = userPreferences
    ? `User Activity Preference: ${userPreferences.activityPreference || 'general'} | Sensitivity Group: ${userPreferences.sensitivityGroup || 'standard'} | Preferred AQI Standard: ${userPreferences.preferredStandard || 'US'}`
    : '';

  const systemInstruction = `You are PureCity AI, an expert, empathetic Urban Air Quality Assistant ("Cleaner Cities. Smarter Air. Healthier Lives.").

STRICT GROUNDING & SAFETY RULES:
1. Always rely ONLY on the real air quality data provided below when answering location-specific questions.
2. NEVER invent, estimate, or fabricate live sensor measurements. If live data is marked UNAVAILABLE, state clearly that live readings are unavailable and DO NOT claim the air is safe.
3. Clearly distinguish US AQI vs Indian CPCB AQI when citing numbers.
4. Provide plain-language explanations of AQI, PM2.5, PM10, possible urban pollution sources (traffic, biomass/open burning, construction dust, meteorology/low wind trapping), sensitive group precautions, and practical exposure reduction tips.
5. NEVER provide medical diagnoses or replace professional medical advice. Include a brief reminder to consult a physician for persistent respiratory/cardiac symptoms when relevant.
6. Keep responses well-structured, concise, and actionable.

CURRENT ENVIRONMENTAL CONTEXT:
${contextBlock}
${prefBlock}`;

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const interaction = await ai.interactions.create({
      model: 'gemini-4-hydrogen',
      system_instruction: systemInstruction,
      input: message.trim(),
      ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
    });

    const textFromSteps =
      interaction.steps
        ?.filter((s) => s.type === 'model_output')
        .flatMap((s) => s.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n') || '';

    const replyText = interaction.output_text || textFromSteps || 'I could not generate a response.';

    return res.json({
      reply: replyText,
      interactionId: interaction.id || null,
      model: 'gemini-4-hydrogen',
      groundedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Gemini API error:', err);
    return res.status(502).json({
      error: `Gemini AI request failed: ${err.message || 'Unknown error'}`,
    });
  }
});

app.post('/alerts/evaluate', authenticateRequest, async (req, res) => {
  try {
    const alertsSnap = await db
      .collection('userAlerts')
      .where('userId', '==', req.user.uid)
      .where('isActive', '==', true)
      .get();

    let triggeredCount = 0;
    const now = Date.now();
    const cooldownMs = 60 * 60 * 1000; // 1 hour cooldown prevents alert spam

    for (const docSnap of alertsSnap.docs) {
      const alert = docSnap.data();
      const lastTrig = alert.lastTriggeredAt?.toMillis ? alert.lastTriggeredAt.toMillis() : 0;
      if (now - lastTrig < cooldownMs) continue;

      const reading = await fetchOpenMeteoAirAndWeather(alert.lat, alert.lon, alert.locationName);
      const val = alert.standard === 'IN' ? reading.aqiIN : reading.aqiUS;

      if (val != null && val >= alert.aqiThreshold) {
        triggeredCount += 1;
        const eventEntry = {
          id: `evt_${now}_${Math.random().toString(36).slice(2, 7)}`,
          aqi: val,
          standard: alert.standard || 'US',
          category: getCategoryLabel(val, alert.standard || 'US'),
          pm25: reading.pm25,
          message: `${alert.locationName} reached ${val} (${alert.standard || 'US'} AQI), exceeding your threshold of ${alert.aqiThreshold}.`,
          triggeredAt: new Date().toISOString(),
          read: false,
        };
        const prevHistory = Array.isArray(alert.history) ? alert.history : [];
        await docSnap.ref.update({
          lastTriggeredAt: admin.firestore.FieldValue.serverTimestamp(),
          history: [eventEntry, ...prevHistory].slice(0, 25),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    return res.json({ evaluated: alertsSnap.size, triggered: triggeredCount });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Alert evaluation failed.' });
  }
});

// ==================== ADMIN ROUTES ====================

app.get('/admin/overview', authenticateRequest, requireAdmin, async (_req, res) => {
  try {
    const [usersList, reportsSnap, readingsSnap, alertsSnap, chatsSnap, settingsSnap] = await Promise.all([
      admin.auth().listUsers(500),
      db.collection('pollutionReports').get(),
      db.collection('airQualityReadings').get(),
      db.collection('userAlerts').get(),
      db.collection('chatHistory').get(),
      db.collection('adminSettings').doc('global').get(),
    ]);

    const userProfilesSnap = await db.collection('users').get();
    const roleMap = new Map(userProfilesSnap.docs.map((d) => [d.id, d.data()]));

    const users = usersList.users.map((u) => {
      const prof = roleMap.get(u.uid) || {};
      return {
        uid: u.uid,
        email: u.email || '',
        displayName: prof.displayName || u.displayName || 'Citizen',
        preferredCity: prof.preferredCity?.name || 'Guntur',
        role: prof.role || (u.customClaims?.admin ? 'admin' : 'user'),
        createdAt: u.metadata?.creationTime || null,
        lastSignInTime: u.metadata?.lastSignInTime || null,
      };
    });

    const reportsByStatus = { pending: 0, verified: 0, flagged: 0, rejected: 0 };
    reportsSnap.docs.forEach((d) => {
      const st = d.data().status || 'pending';
      reportsByStatus[st] = (reportsByStatus[st] || 0) + 1;
    });

    return res.json({
      stats: {
        totalUsers: usersList.users.length,
        totalReadings: readingsSnap.size,
        totalReports: reportsSnap.size,
        reportsByStatus,
        totalAlerts: alertsSnap.size,
        totalConversations: chatsSnap.size,
      },
      users,
      settings: settingsSnap.exists
        ? settingsSnap.data()
        : {
          defaultStandard: 'US',
          alertCooldownMinutes: 60,
          enableScheduledSync: true,
        },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load admin overview.' });
  }
});

app.post('/admin/users/role', authenticateRequest, requireAdmin, async (req, res) => {
  const { targetUid, role } = req.body || {};
  if (!targetUid || !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Valid targetUid and role (user or admin) required.' });
  }
  if (targetUid === req.user.uid && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot demote yourself.' });
  }

  try {
    await admin.auth().setCustomUserClaims(targetUid, { admin: role === 'admin' });
    await db.collection('users').doc(targetUid).set(
      {
        role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return res.json({ ok: true, targetUid, role });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to update user role.' });
  }
});

app.post('/admin/settings', authenticateRequest, requireAdmin, async (req, res) => {
  const { defaultStandard, alertCooldownMinutes, enableScheduledSync } = req.body || {};
  try {
    await db
      .collection('adminSettings')
      .doc('global')
      .set(
        {
          defaultStandard: defaultStandard === 'IN' ? 'IN' : 'US',
          alertCooldownMinutes: Math.min(Math.max(Number(alertCooldownMinutes) || 60, 15), 1440),
          enableScheduledSync: Boolean(enableScheduledSync),
          updatedBy: req.user.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to save admin settings.' });
  }
});

exports.api = onRequest({ cors: true }, app);

// ==================== SCHEDULED JOB ====================
exports.scheduledAirQualityAndAlerts = onSchedule('every 60 minutes', async () => {
  const defaultCities = [
    { name: 'Guntur', state: 'Andhra Pradesh', country: 'India', lat: 16.3067, lon: 80.4365 },
    { name: 'Vijayawada', state: 'Andhra Pradesh', country: 'India', lat: 16.5062, lon: 80.648 },
    { name: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.385, lon: 78.4867 },
  ];

  for (const city of defaultCities) {
    try {
      const reading = await fetchOpenMeteoAirAndWeather(city.lat, city.lon, city.name, city.state, city.country);
      lastFirestorePersist.delete(reading.stationId);
      await persistReadingIfDue(reading);
    } catch (err) {
      console.warn(`Scheduled fetch failed for ${city.name}:`, err.message);
    }
  }

  // Evaluate active user alerts with cooldown
  try {
    const activeAlerts = await db.collection('userAlerts').where('isActive', '==', true).limit(100).get();
    const now = Date.now();
    const cooldownMs = 60 * 60 * 1000;

    for (const docSnap of activeAlerts.docs) {
      const alert = docSnap.data();
      const lastTrig = alert.lastTriggeredAt?.toMillis ? alert.lastTriggeredAt.toMillis() : 0;
      if (now - lastTrig < cooldownMs) continue;

      const reading = await fetchOpenMeteoAirAndWeather(alert.lat, alert.lon, alert.locationName);
      const val = alert.standard === 'IN' ? reading.aqiIN : reading.aqiUS;
      if (val != null && val >= alert.aqiThreshold) {
        const eventEntry = {
          id: `sched_${now}_${Math.random().toString(36).slice(2, 7)}`,
          aqi: val,
          standard: alert.standard || 'US',
          category: getCategoryLabel(val, alert.standard || 'US'),
          pm25: reading.pm25,
          message: `Scheduled alert: ${alert.locationName} reached ${val} (${alert.standard || 'US'} AQI), above threshold ${alert.aqiThreshold}.`,
          triggeredAt: new Date().toISOString(),
          read: false,
        };
        const prevHistory = Array.isArray(alert.history) ? alert.history : [];
        await docSnap.ref.update({
          lastTriggeredAt: admin.firestore.FieldValue.serverTimestamp(),
          history: [eventEntry, ...prevHistory].slice(0, 25),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  } catch (err) {
    console.error('Scheduled alert evaluation failed:', err.message);
  }
});
