import { getDisplayAqi, getAqiCategory } from './aqi';

export const ACTIVITY_OPTIONS = [
  { id: 'walking', label: 'Walking', intensity: 'light' },
  { id: 'running', label: 'Running', intensity: 'vigorous' },
  { id: 'cycling', label: 'Cycling', intensity: 'vigorous' },
  { id: 'outdoor_work', label: 'Outdoor work', intensity: 'moderate_prolonged' },
  { id: 'general', label: 'General outdoor activities', intensity: 'moderate' },
];

export const SENSITIVITY_OPTIONS = [
  { id: 'standard', label: 'Standard Adult' },
  { id: 'respiratory', label: 'Asthma / Respiratory Sensitivity' },
  { id: 'sensitive_age', label: 'Children / Older Adults' },
  { id: 'cardiac', label: 'Cardiovascular Sensitivity' },
  { id: 'athlete', label: 'Endurance / Outdoor Athlete' },
];

/**
 * Generates grounded activity & exposure recommendations from real AQI & pollutant readings.
 * Never fabricates safe status when data is missing.
 */
export function buildPersonalizedRecommendations({
  reading,
  standard = 'US',
  activity = 'general',
  sensitivity = 'standard',
}) {
  const aqi = getDisplayAqi(reading, standard);
  if (aqi == null) {
    return {
      status: 'unavailable',
      headline: 'Live air quality data is currently unavailable',
      adviceLevel: 'caution',
      recommendations: [
        'Avoid assuming air quality is safe until a fresh measurement is retrieved.',
        'Check local monitoring updates before scheduling vigorous outdoor exercise.',
        'If you notice visible smoke, haze, or odor, move indoors and keep windows closed.',
      ],
    };
  }

  const category = getAqiCategory(aqi, standard);
  const isSensitive = sensitivity !== 'standard';
  const isVigorous = activity === 'running' || activity === 'cycling';
  const isProlonged = activity === 'outdoor_work';
  const activityObj = ACTIVITY_OPTIONS.find((a) => a.id === activity) || ACTIVITY_OPTIONS[4];
  const sensitivityObj = SENSITIVITY_OPTIONS.find((s) => s.id === sensitivity) || SENSITIVITY_OPTIONS[0];

  const pm25 = reading?.pm25;
  const pm10 = reading?.pm10;
  const recommendations = [];

  // Normalize to US-like risk tier for consistent guidance thresholds
  const riskScore = standard === 'IN' ? Math.round(aqi * 0.75) : aqi;

  let headline = '';
  let adviceLevel = 'good';

  if (riskScore <= 50) {
    adviceLevel = 'good';
    headline = `Favorable conditions for ${activityObj.label.toLowerCase()}`;
    recommendations.push(`Current ${standard === 'IN' ? 'Indian' : 'US'} AQI is ${aqi} (${category.label}), well suited for ${activityObj.label.toLowerCase()}.`);
    recommendations.push('Take advantage of cleaner outdoor air for ventilation and outdoor routines.');
    if (isSensitive) {
      recommendations.push(`As someone in the "${sensitivityObj.label}" group, conditions are currently low-risk, though keeping quick-relief medication handy is always wise.`);
    }
  } else if (riskScore <= 100) {
    adviceLevel = isSensitive && isVigorous ? 'moderate_caution' : 'moderate';
    headline = isSensitive
      ? `Moderate air quality — pace ${activityObj.label.toLowerCase()} carefully`
      : `Generally acceptable for ${activityObj.label.toLowerCase()}`;
    if (isSensitive) {
      recommendations.push(`With ${sensitivityObj.label} sensitivity, consider shortening intense ${activityObj.label.toLowerCase()} or choosing low-traffic green corridors.`);
    } else {
      recommendations.push(`Current AQI (${aqi}) is moderate. Most people can continue ${activityObj.label.toLowerCase()} comfortably.`);
    }
    recommendations.push('Check local hourly readings before peak traffic hours when particulates tend to rise.');
  } else if (riskScore <= 150) {
    adviceLevel = 'caution';
    headline = `Elevated pollution — reduce vigorous ${activityObj.label.toLowerCase()}`;
    if (isVigorous || isProlonged || isSensitive) {
      recommendations.push(`Reduce outdoor exercise intensity or shift ${activityObj.label.toLowerCase()} indoors while AQI is ${aqi}.`);
    } else {
      recommendations.push(`Limit prolonged outdoor exertion and take frequent breaks in cleaner indoor spaces.`);
    }
    recommendations.push('Avoid busy arterial roads and construction zones where PM2.5 and PM10 spike locally.');
    recommendations.push('Consider wearing a well-fitted N95/KN95 mask if commuting or working outdoors.');
  } else if (riskScore <= 200) {
    adviceLevel = 'warning';
    headline = `Unhealthy air (${aqi} AQI) — move ${activityObj.label.toLowerCase()} indoors`;
    recommendations.push('Consider indoor activities instead of outdoor exercise until AQI drops below 100.');
    recommendations.push('Keep windows closed during peak pollution hours and use HEPA air filtration if available.');
    recommendations.push('Wear a certified N95/FFP2 respirator for essential outdoor commutes.');
  } else {
    adviceLevel = 'severe';
    headline = `High pollution warning (${aqi} AQI) — stay indoors`;
    recommendations.push(`Avoid outdoor ${activityObj.label.toLowerCase()} and minimize all non-essential outdoor exposure.`);
    recommendations.push('Close doors and windows, seal drafts, and run indoor air purifiers on medium-high.');
    recommendations.push('Sensitive groups should monitor symptoms closely and consult a healthcare professional if discomfort occurs.');
  }

  if (pm25 != null && pm25 > 35) {
    recommendations.push(`Fine particulate matter (PM2.5) is ${pm25.toFixed(1)} µg/m³ — fine particles penetrate deep into lungs, so avoid high-exertion breathing outdoors.`);
  }
  if (pm10 != null && pm10 > 100) {
    recommendations.push(`Coarse dust (PM10) is ${pm10.toFixed(1)} µg/m³ — keep away from unpaved roads and construction dust.`);
  }

  return {
    status: 'ok',
    aqi,
    category,
    headline,
    adviceLevel,
    recommendations,
    disclaimer: 'General environmental guidance only — not medical advice or diagnosis.',
  };
}
