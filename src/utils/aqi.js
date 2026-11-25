// Default initial demonstration city required by specification
export const DEFAULT_CITY = {
  name: 'Guntur',
  state: 'Andhra Pradesh',
  country: 'India',
  lat: 16.3067,
  lon: 80.4365,
};

export const SUGGESTED_CITIES = [
  DEFAULT_CITY,
  { name: 'Vijayawada', state: 'Andhra Pradesh', country: 'India', lat: 16.5062, lon: 80.648 },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', country: 'India', lat: 17.6868, lon: 83.2185 },
  { name: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.385, lon: 78.4867 },
  { name: 'Bengaluru', state: 'Karnataka', country: 'India', lat: 12.9716, lon: 77.5946 },
  { name: 'Chennai', state: 'Tamil Nadu', country: 'India', lat: 13.0827, lon: 80.2707 },
  { name: 'New Delhi', state: 'Delhi', country: 'India', lat: 28.6139, lon: 77.209 },
  { name: 'Mumbai', state: 'Maharashtra', country: 'India', lat: 19.076, lon: 72.8777 },
];

// US EPA AQI breakpoints for PM2.5 (ug/m3) and PM10 (ug/m3)
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

// Indian CPCB NAQI breakpoints for PM2.5 and PM10 (24-hr avg standard)
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

export function calculateUSAqiFromPollutants(pm25, pm10) {
  const s1 = linearSubIndex(pm25, US_PM25_BREAKPOINTS);
  const s2 = linearSubIndex(pm10, US_PM10_BREAKPOINTS);
  const valid = [s1, s2].filter((x) => x != null);
  return valid.length ? Math.max(...valid) : null;
}

export function calculateIndianAqiFromPollutants(pm25, pm10) {
  const s1 = linearSubIndex(pm25, IN_PM25_BREAKPOINTS);
  const s2 = linearSubIndex(pm10, IN_PM10_BREAKPOINTS);
  const valid = [s1, s2].filter((x) => x != null);
  return valid.length ? Math.max(...valid) : null;
}

/**
 * Returns unified color-coded category info for either US AQI or Indian NAQI.
 * Matches prompt colors: Green, Yellow, Orange, Red, Purple, Maroon.
 */
export function getAqiCategory(aqiValue, standard = 'US') {
  if (aqiValue == null || Number.isNaN(Number(aqiValue))) {
    return {
      label: 'Unavailable',
      shortLabel: 'N/A',
      colorName: 'Slate',
      hex: '#64748b',
      bgClass: 'bg-slate-100',
      textClass: 'text-slate-700',
      borderClass: 'border-slate-200',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      ringClass: 'ring-slate-200',
      description: 'Live air quality measurement is currently unavailable.',
    };
  }

  const v = Number(aqiValue);

  if (standard === 'IN') {
    if (v <= 50) {
      return {
        label: 'Good',
        shortLabel: 'Good',
        colorName: 'Green',
        hex: '#16a34a',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-800',
        borderClass: 'border-emerald-200',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        ringClass: 'ring-emerald-200',
        description: 'Minimal impact. Clean air suitable for all outdoor activities.',
      };
    }
    if (v <= 100) {
      return {
        label: 'Satisfactory (Moderate)',
        shortLabel: 'Moderate',
        colorName: 'Yellow',
        hex: '#eab308',
        bgClass: 'bg-yellow-50',
        textClass: 'text-yellow-800',
        borderClass: 'border-yellow-200',
        badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        ringClass: 'ring-yellow-200',
        description: 'Minor breathing discomfort possible for unusually sensitive people.',
      };
    }
    if (v <= 200) {
      return {
        label: 'Unhealthy for Sensitive Groups',
        shortLabel: 'Moderate-High',
        colorName: 'Orange',
        hex: '#f97316',
        bgClass: 'bg-orange-50',
        textClass: 'text-orange-800',
        borderClass: 'border-orange-200',
        badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
        ringClass: 'ring-orange-200',
        description: 'CPCB Moderately Polluted: discomfort for asthma, lung, and heart conditions.',
      };
    }
    if (v <= 300) {
      return {
        label: 'Unhealthy (Poor)',
        shortLabel: 'Unhealthy',
        colorName: 'Red',
        hex: '#dc2626',
        bgClass: 'bg-red-50',
        textClass: 'text-red-800',
        borderClass: 'border-red-200',
        badgeClass: 'bg-red-100 text-red-800 border-red-300',
        ringClass: 'ring-red-200',
        description: 'CPCB Poor: breathing discomfort on prolonged exposure for most people.',
      };
    }
    if (v <= 400) {
      return {
        label: 'Very Unhealthy (Very Poor)',
        shortLabel: 'Very Unhealthy',
        colorName: 'Purple',
        hex: '#9333ea',
        bgClass: 'bg-purple-50',
        textClass: 'text-purple-800',
        borderClass: 'border-purple-200',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
        ringClass: 'ring-purple-200',
        description: 'CPCB Very Poor: respiratory illness risk on prolonged exposure.',
      };
    }
    return {
      label: 'Hazardous (Severe)',
      shortLabel: 'Hazardous',
      colorName: 'Maroon',
      hex: '#881337',
      bgClass: 'bg-rose-950/10',
      textClass: 'text-rose-950',
      borderClass: 'border-rose-300',
      badgeClass: 'bg-rose-900 text-white border-rose-950',
      ringClass: 'ring-rose-300',
      description: 'CPCB Severe: affects healthy people and seriously impacts sensitive groups.',
    };
  }

  // US EPA AQI Standard
  if (v <= 50) {
    return {
      label: 'Good',
      shortLabel: 'Good',
      colorName: 'Green',
      hex: '#16a34a',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-800',
      borderClass: 'border-emerald-200',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      ringClass: 'ring-emerald-200',
      description: 'Air quality is satisfactory, and air pollution poses little or no risk.',
    };
  }
  if (v <= 100) {
    return {
      label: 'Moderate',
      shortLabel: 'Moderate',
      colorName: 'Yellow',
      hex: '#eab308',
      bgClass: 'bg-yellow-50',
      textClass: 'text-yellow-800',
      borderClass: 'border-yellow-200',
      badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      ringClass: 'ring-yellow-200',
      description: 'Acceptable air quality; moderate concern for very sensitive individuals.',
    };
  }
  if (v <= 150) {
    return {
      label: 'Unhealthy for Sensitive Groups',
      shortLabel: 'Sensitive',
      colorName: 'Orange',
      hex: '#f97316',
      bgClass: 'bg-orange-50',
      textClass: 'text-orange-800',
      borderClass: 'border-orange-200',
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
      ringClass: 'ring-orange-200',
      description: 'Sensitive groups may experience health effects; general public less likely.',
    };
  }
  if (v <= 200) {
    return {
      label: 'Unhealthy',
      shortLabel: 'Unhealthy',
      colorName: 'Red',
      hex: '#dc2626',
      bgClass: 'bg-red-50',
      textClass: 'text-red-800',
      borderClass: 'border-red-200',
      badgeClass: 'bg-red-100 text-red-800 border-red-300',
      ringClass: 'ring-red-200',
      description: 'Everyone may begin to experience health effects; sensitive groups more seriously.',
    };
  }
  if (v <= 300) {
    return {
      label: 'Very Unhealthy',
      shortLabel: 'Very Unhealthy',
      colorName: 'Purple',
      hex: '#9333ea',
      bgClass: 'bg-purple-50',
      textClass: 'text-purple-800',
      borderClass: 'border-purple-200',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
      ringClass: 'ring-purple-200',
      description: 'Health alert: everyone may experience more serious health effects.',
    };
  }
  return {
    label: 'Hazardous',
    shortLabel: 'Hazardous',
    colorName: 'Maroon',
    hex: '#881337',
    bgClass: 'bg-rose-950/10',
    textClass: 'text-rose-950',
    borderClass: 'border-rose-300',
    badgeClass: 'bg-rose-900 text-white border-rose-950',
    ringClass: 'ring-rose-300',
    description: 'Health warning of emergency conditions. Entire population is likely affected.',
  };
}

export function getDisplayAqi(reading, standard = 'US') {
  if (!reading) return null;
  if (standard === 'IN') {
    return reading.aqiIN ?? calculateIndianAqiFromPollutants(reading.pm25, reading.pm10);
  }
  return reading.aqiUS ?? calculateUSAqiFromPollutants(reading.pm25, reading.pm10);
}

export function formatTimestamp(ts) {
  if (!ts) return 'Unknown';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
