const US_PM25_BREAKPOINTS = [
  [0.0, 12.0, 0, 50],
  [12.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 150.4, 151, 200],
  [150.5, 250.4, 201, 300],
  [250.5, 500.4, 301, 500],
];

const US_PM10_BREAKPOINTS = [
  [0, 54, 0, 50],
  [55, 154, 51, 100],
  [155, 254, 101, 150],
  [255, 354, 151, 200],
  [355, 424, 201, 300],
  [425, 604, 301, 500],
];

const IN_PM25_BREAKPOINTS = [
  [0, 30, 0, 50],
  [31, 60, 51, 100],
  [61, 90, 101, 200],
  [91, 120, 201, 300],
  [121, 250, 301, 400],
  [251, 500, 401, 500],
];

const IN_PM10_BREAKPOINTS = [
  [0, 50, 0, 50],
  [51, 100, 51, 100],
  [101, 250, 101, 200],
  [251, 350, 201, 300],
  [351, 430, 301, 400],
  [431, 600, 401, 500],
];

function linearSubIndex(value, breakpoints) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const v = Math.max(0, Number(value));
  for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
    if (v <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (v - cLow) + iLow);
    }
  }
  return 500;
}

function calculateUSAqiFromPollutants(pm25, pm10) {
  const s1 = linearSubIndex(pm25, US_PM25_BREAKPOINTS);
  const s2 = linearSubIndex(pm10, US_PM10_BREAKPOINTS);
  const valid = [s1, s2].filter((x) => x != null);
  return valid.length ? Math.max(...valid) : null;
}

function calculateIndianAqiFromPollutants(pm25, pm10) {
  const s1 = linearSubIndex(pm25, IN_PM25_BREAKPOINTS);
  const s2 = linearSubIndex(pm10, IN_PM10_BREAKPOINTS);
  const valid = [s1, s2].filter((x) => x != null);
  return valid.length ? Math.max(...valid) : null;
}

function getCategoryLabel(aqi, standard = 'US') {
  if (aqi == null) return 'Unavailable';
  if (standard === 'IN') {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Satisfactory';
    if (aqi <= 200) return 'Moderately Polluted';
    if (aqi <= 300) return 'Poor';
    if (aqi <= 400) return 'Very Poor';
    return 'Severe';
  }
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

module.exports = {
  calculateUSAqiFromPollutants,
  calculateIndianAqiFromPollutants,
  getCategoryLabel,
};
