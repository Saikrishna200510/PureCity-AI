import {
  calculateIndianAqiFromPollutants,
  calculateUSAqiFromPollutants,
  SUGGESTED_CITIES,
} from '../utils/aqi';
import { apiRequest } from './apiClient';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes client-side cache
const memoryCache = new Map();
const FUNCTIONS_API_ENABLED = import.meta.env.VITE_ENABLE_FUNCTIONS_API === 'true';
const WAQI_TOKEN = import.meta.env.VITE_WAQI_API_TOKEN;

function cityKey(lat, lon) {
  return `${Number(lat).toFixed(3)}_${Number(lon).toFixed(3)}`;
}

function saveLastSuccessful(key, payload) {
  try {
    localStorage.setItem(`bw_last_aq_${key}`, JSON.stringify(payload));
  } catch {
    // Ignore storage quota issues
  }
}

export function getLastSuccessful(lat, lon) {
  try {
    const raw = localStorage.getItem(`bw_last_aq_${cityKey(lat, lon)}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Fetches live air quality + weather data.
 * Prefers secure Cloud Functions backend (/api/air-quality) when available,
 * and falls back to Open-Meteo's free CORS-enabled Air Quality & Weather APIs
 * when running Vite standalone locally. Never generates fake readings.
 */
export async function fetchLiveAirQuality(city, { forceRefresh = false } = {}) {
  const lat = Number(city?.lat);
  const lon = Number(city?.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    throw new Error('Invalid city coordinates.');
  }

  const key = cityKey(lat, lon);
  const cached = memoryCache.get(key);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Try Cloud Functions backend when enabled
  if (FUNCTIONS_API_ENABLED) {
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        city: city.name || 'Selected Location',
        state: city.state || '',
        country: city.country || '',
      });
      const backendData = await apiRequest(`/air-quality?${params.toString()}`);
      if (backendData && backendData.pm25 !== undefined) {
        const normalized = {
          ...backendData,
          unavailable: false,
        };
        memoryCache.set(key, { fetchedAt: Date.now(), data: normalized });
        saveLastSuccessful(key, normalized);
        return normalized;
      }
    } catch {
      // Backend may not be deployed/running in local Vite dev; proceed to direct live AQI APIs
    }
  }

  // 2. Optional WAQI ground-station real-time AQI enrichment when token is configured
  let waqiData = null;
  if (WAQI_TOKEN && !WAQI_TOKEN.includes('your_waqi')) {
    try {
      const waqiRes = await fetch(
        `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${encodeURIComponent(WAQI_TOKEN)}`
      );
      if (waqiRes.ok) {
        const waqiJson = await waqiRes.json();
        if (waqiJson.status === 'ok' && waqiJson.data) {
          waqiData = waqiJson.data;
        }
      }
    } catch {
      // Proceed with Open-Meteo real-time AQI API
    }
  }

  // 2. Direct live Open-Meteo Air Quality + Weather APIs
  try {
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
    if (!aqRes.ok) throw new Error(`Open-Meteo Air Quality HTTP ${aqRes.status}`);
    if (!weatherRes.ok) throw new Error(`Open-Meteo Weather HTTP ${weatherRes.status}`);

    const aqJson = await aqRes.json();
    const weatherJson = await weatherRes.json();

    const currAq = aqJson.current || {};
    const currWeather = weatherJson.current || {};

    const pm25 = waqiData?.iaqi?.pm25?.v ?? currAq.pm2_5 ?? null;
    const pm10 = waqiData?.iaqi?.pm10?.v ?? currAq.pm10 ?? null;
    const aqiUS =
      typeof waqiData?.aqi === 'number'
        ? waqiData.aqi
        : currAq.us_aqi ?? calculateUSAqiFromPollutants(pm25, pm10);
    const aqiIN = calculateIndianAqiFromPollutants(pm25, pm10);

    const normalized = {
      city: city.name,
      state: city.state || '',
      country: city.country || '',
      coordinates: { lat, lon },
      stationId: waqiData?.idx ? `waqi_${waqiData.idx}` : `openmeteo_${key}`,
      stationName: waqiData?.city?.name || `${city.name} Atmospheric Grid`,
      aqiUS,
      aqiIN,
      europeanAqi: currAq.european_aqi ?? null,
      pm25,
      pm10,
      no2: waqiData?.iaqi?.no2?.v ?? currAq.nitrogen_dioxide ?? null,
      so2: waqiData?.iaqi?.so2?.v ?? currAq.sulphur_dioxide ?? null,
      o3: waqiData?.iaqi?.o3?.v ?? currAq.ozone ?? null,
      co: waqiData?.iaqi?.co?.v ?? currAq.carbon_monoxide ?? null,
      temperature: waqiData?.iaqi?.t?.v ?? currWeather.temperature_2m ?? null,
      humidity: waqiData?.iaqi?.h?.v ?? currWeather.relative_humidity_2m ?? null,
      windSpeed: waqiData?.iaqi?.w?.v ?? currWeather.wind_speed_10m ?? null,
      source: waqiData
        ? `WAQI Ground Station (${waqiData.city?.name || 'Live'})`
        : 'Open-Meteo Live Air Quality API',
      standard: 'US EPA / CPCB NAQI',
      timestamp:
        waqiData?.time?.iso ||
        (currAq.time ? new Date(currAq.time).toISOString() : new Date().toISOString()),
      hourly: aqJson.hourly || null,
      unavailable: false,
    };

    memoryCache.set(key, { fetchedAt: Date.now(), data: normalized });
    saveLastSuccessful(key, normalized);
    return normalized;
  } catch (err) {
    const lastKnown = getLastSuccessful(lat, lon);
    return {
      ...(lastKnown || {}),
      city: city.name,
      coordinates: { lat, lon },
      unavailable: true,
      errorMessage: err.message || 'Live air quality service is currently unreachable.',
      lastSuccessfulTimestamp: lastKnown?.timestamp || null,
    };
  }
}

/**
 * Fetches hourly and daily historical/near-term analytics data from Open-Meteo
 * (up to past 14 days). Clearly tagged with source metadata.
 */
export async function fetchAirQualityAnalytics(city, days = 7) {
  const lat = Number(city?.lat);
  const lon = Number(city?.lon);
  const pastDays = Math.min(Math.max(Number(days) || 7, 1), 14);

  const aqUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  aqUrl.searchParams.set('latitude', String(lat));
  aqUrl.searchParams.set('longitude', String(lon));
  aqUrl.searchParams.set('hourly', 'pm2_5,pm10,us_aqi,nitrogen_dioxide,ozone');
  aqUrl.searchParams.set('past_days', String(pastDays));
  aqUrl.searchParams.set('forecast_days', '1');
  aqUrl.searchParams.set('timezone', 'auto');

  const res = await fetch(aqUrl.toString());
  if (!res.ok) {
    throw new Error(`Unable to fetch historical analytics (HTTP ${res.status})`);
  }
  const json = await res.json();
  const h = json.hourly || {};
  const times = h.time || [];

  const hourlyPoints = [];
  const dailyBuckets = new Map();

  for (let i = 0; i < times.length; i += 1) {
    const timeStr = times[i];
    const pm25 = h.pm2_5?.[i] ?? null;
    const pm10 = h.pm10?.[i] ?? null;
    const usAqi = h.us_aqi?.[i] ?? calculateUSAqiFromPollutants(pm25, pm10);
    const inAqi = calculateIndianAqiFromPollutants(pm25, pm10);

    hourlyPoints.push({
      time: timeStr,
      label: new Date(timeStr).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
      }),
      pm25: pm25 != null ? Number(pm25.toFixed(1)) : null,
      pm10: pm10 != null ? Number(pm10.toFixed(1)) : null,
      aqiUS: usAqi,
      aqiIN: inAqi,
      no2: h.nitrogen_dioxide?.[i] ?? null,
      o3: h.ozone?.[i] ?? null,
    });

    const dateKey = timeStr.slice(0, 10);
    if (!dailyBuckets.has(dateKey)) {
      dailyBuckets.set(dateKey, { pm25: [], pm10: [], aqiUS: [], aqiIN: [] });
    }
    const bucket = dailyBuckets.get(dateKey);
    if (pm25 != null) bucket.pm25.push(pm25);
    if (pm10 != null) bucket.pm10.push(pm10);
    if (usAqi != null) bucket.aqiUS.push(usAqi);
    if (inAqi != null) bucket.aqiIN.push(inAqi);
  }

  const avg = (arr) => (arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null);

  const dailyPoints = Array.from(dailyBuckets.entries()).map(([dateKey, b]) => ({
    date: dateKey,
    label: new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    pm25: avg(b.pm25),
    pm10: avg(b.pm10),
    aqiUS: b.aqiUS.length ? Math.round(avg(b.aqiUS)) : null,
    aqiIN: b.aqiIN.length ? Math.round(avg(b.aqiIN)) : null,
  }));

  return {
    city: city.name,
    source: 'Open-Meteo Historical & Reanalysis (CAMS)',
    hourly: hourlyPoints.slice(-48),
    daily: dailyPoints,
  };
}

/**
 * Fetches nearby ground monitoring stations via Cloud Function (/api/stations) if OpenAQ is configured,
 * and supplements with surrounding Open-Meteo atmospheric grid points (clearly labeled as Model Grid).
 */
export async function fetchNearbyStationsAndGrid(city, radiusKm = 30) {
  const lat = Number(city?.lat);
  const lon = Number(city?.lon);

  let openAqStations = [];
  let openAqStatus = 'not_configured';
  let openAqMessage = 'OpenAQ ground station API is handled via Cloud Functions when OPENAQ_API_KEY is configured.';

  if (FUNCTIONS_API_ENABLED) {
    try {
      const res = await apiRequest(`/stations?lat=${lat}&lon=${lon}&radius=${radiusKm}`);
      openAqStations = res.stations || [];
      openAqStatus = res.status || 'ok';
      openAqMessage = res.message || '';
    } catch {
      // Cloud Function unavailable in standalone dev
    }
  }

  // Also fetch 5 real surrounding atmospheric grid coordinates around the city via Open-Meteo
  // (Clearly labeled as Open-Meteo Atmospheric Grid, NOT fake ground stations)
  const offsets = [
    { label: `${city.name} Center`, dLat: 0, dLon: 0 },
    { label: `${city.name} North`, dLat: 0.08, dLon: 0 },
    { label: `${city.name} South`, dLat: -0.08, dLon: 0 },
    { label: `${city.name} East`, dLat: 0, dLon: 0.08 },
    { label: `${city.name} West`, dLat: 0, dLon: -0.08 },
  ];

  const lats = offsets.map((o) => (lat + o.dLat).toFixed(4)).join(',');
  const lons = offsets.map((o) => (lon + o.dLon).toFixed(4)).join(',');

  let gridPoints = [];
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : [data];
      gridPoints = list.map((item, idx) => {
        const c = item.current || {};
        const pm25 = c.pm2_5 ?? null;
        const pm10 = c.pm10 ?? null;
        return {
          id: `grid_${idx}_${cityKey(item.latitude, item.longitude)}`,
          name: offsets[idx]?.label || `Grid Point ${idx + 1}`,
          lat: item.latitude,
          lon: item.longitude,
          aqiUS: c.us_aqi ?? calculateUSAqiFromPollutants(pm25, pm10),
          aqiIN: calculateIndianAqiFromPollutants(pm25, pm10),
          pm25,
          pm10,
          no2: c.nitrogen_dioxide ?? null,
          o3: c.ozone ?? null,
          timestamp: c.time ? new Date(c.time).toISOString() : new Date().toISOString(),
          kind: 'model_grid',
          source: 'Open-Meteo CAMS Grid',
        };
      });
    }
  } catch {
    // Ignore grid fetch failure
  }

  return {
    openAqStations,
    openAqStatus,
    openAqMessage,
    gridPoints,
  };
}

/**
 * Search cities and areas globally via Open-Meteo Geocoding API.
 */
export async function searchLocations(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return SUGGESTED_CITIES;

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', trimmed);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Location search failed.');
  const json = await res.json();

  if (!json.results?.length) return [];

  return json.results.map((r) => ({
    name: r.name,
    state: r.admin1 || '',
    country: r.country || '',
    lat: r.latitude,
    lon: r.longitude,
  }));
}

/**
 * Reverse geocode GPS coordinates to a readable city/area name.
 */
export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      return {
        name: addr.city || addr.town || addr.village || addr.suburb || addr.county || 'Current Location',
        state: addr.state || '',
        country: addr.country || '',
        lat: Number(lat),
        lon: Number(lon),
      };
    }
  } catch {
    // Fallback to coordinates label
  }
  return {
    name: `Location (${Number(lat).toFixed(2)}, ${Number(lon).toFixed(2)})`,
    state: '',
    country: '',
    lat: Number(lat),
    lon: Number(lon),
  };
}
