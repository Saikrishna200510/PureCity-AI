import {
  Wind,
  Droplets,
  Thermometer,
  Clock,
  Database,
  AlertTriangle,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { getAqiCategory, getDisplayAqi, formatTimestamp } from '../utils/aqi';

export function AqiHeroCard({ reading, standard, onToggleStandard, loading, onRefresh, city }) {
  const aqiValue = getDisplayAqi(reading, standard);
  const category = getAqiCategory(aqiValue, standard);
  const standardName = standard === 'IN' ? 'Indian AQI (CPCB NAQI)' : 'US AQI (EPA Standard)';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
      {reading?.unavailable && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Live air quality data is currently unavailable</p>
            <p className="text-xs text-amber-800 mt-0.5">
              {reading.errorMessage || 'Unable to reach air quality API.'}{' '}
              {reading.lastSuccessfulTimestamp
                ? `Showing last successful reading from ${formatTimestamp(reading.lastSuccessfulTimestamp)}.`
                : 'No cached measurement is available yet for this location.'}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Activity className="w-3.5 h-3.5" />
              {standardName}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Database className="w-3.5 h-3.5" />
              {reading?.source || 'Open-Meteo Copernicus CAMS'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            {city?.name}
            {city?.state ? `, ${city.state}` : ''}
            {city?.country ? `, ${city.country}` : ''}
          </h2>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Last updated: {reading?.timestamp ? formatTimestamp(reading.timestamp) : 'Checking...'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => onToggleStandard('US')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${standard === 'US' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              US AQI
            </button>
            <button
              type="button"
              onClick={() => onToggleStandard('IN')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${standard === 'IN' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Indian AQI
            </button>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh air quality"
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        <div
          className={`md:col-span-5 rounded-2xl p-5 border ${category.bgClass} ${category.borderClass} flex items-center justify-between`}
        >
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Current AQI</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-5xl font-extrabold tracking-tight" style={{ color: category.hex }}>
                {loading && aqiValue == null ? '—' : aqiValue ?? 'N/A'}
              </span>
              <span className="text-xs font-medium text-slate-500">{standard}</span>
            </div>
            <span
              className={`inline-block mt-2.5 px-3 py-1 rounded-full text-xs font-semibold border ${category.badgeClass}`}
            >
              {category.label}
            </span>
          </div>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-xs"
            style={{ backgroundColor: category.hex }}
          >
            {category.colorName}
          </div>
        </div>

        <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricMini
            label="PM2.5"
            value={reading?.pm25 != null ? `${Number(reading.pm25).toFixed(1)}` : '—'}
            unit="µg/m³"
            highlight={reading?.pm25 > 35}
          />
          <MetricMini
            label="PM10"
            value={reading?.pm10 != null ? `${Number(reading.pm10).toFixed(1)}` : '—'}
            unit="µg/m³"
            highlight={reading?.pm10 > 100}
          />
          <MetricMini
            label="Temperature"
            value={reading?.temperature != null ? `${Number(reading.temperature).toFixed(1)}` : '—'}
            unit="°C"
            icon={<Thermometer className="w-3.5 h-3.5 text-emerald-600" />}
          />
          <MetricMini
            label="Humidity"
            value={reading?.humidity != null ? `${Math.round(reading.humidity)}` : '—'}
            unit="%"
            icon={<Droplets className="w-3.5 h-3.5 text-sky-600" />}
          />
          <MetricMini
            label="Wind Speed"
            value={reading?.windSpeed != null ? `${Number(reading.windSpeed).toFixed(1)}` : '—'}
            unit="km/h"
            icon={<Wind className="w-3.5 h-3.5 text-teal-600" />}
          />
          <MetricMini
            label="NO₂"
            value={reading?.no2 != null ? `${Number(reading.no2).toFixed(1)}` : '—'}
            unit="µg/m³"
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-600 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100">
        {category.description}
      </p>
    </div>
  );
}

function MetricMini({ label, value, unit, icon, highlight }) {
  return (
    <div
      className={`rounded-xl p-3 border transition ${highlight ? 'bg-orange-50/70 border-orange-200' : 'bg-slate-50/80 border-slate-200/70'
        }`}
    >
      <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-bold text-slate-900">{value}</span>
        <span className="text-[11px] text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

export function AqiScaleLegend({ standard = 'US' }) {
  const tiers =
    standard === 'IN'
      ? [
        { range: '0–50', label: 'Good', color: '#16a34a' },
        { range: '51–100', label: 'Satisfactory', color: '#eab308' },
        { range: '101–200', label: 'Moderately Polluted', color: '#f97316' },
        { range: '201–300', label: 'Poor', color: '#dc2626' },
        { range: '301–400', label: 'Very Poor', color: '#9333ea' },
        { range: '401–500', label: 'Severe', color: '#881337' },
      ]
      : [
        { range: '0–50', label: 'Good', color: '#16a34a' },
        { range: '51–100', label: 'Moderate', color: '#eab308' },
        { range: '101–150', label: 'Sensitive Groups', color: '#f97316' },
        { range: '151–200', label: 'Unhealthy', color: '#dc2626' },
        { range: '201–300', label: 'Very Unhealthy', color: '#9333ea' },
        { range: '301+', label: 'Hazardous', color: '#881337' },
      ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {standard === 'IN' ? 'Indian CPCB AQI Scale' : 'US EPA AQI Scale'}
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {tiers.map((t) => (
          <div key={t.range} className="flex items-center gap-2 bg-slate-50 rounded-xl px-2.5 py-2 border border-slate-100">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-800 truncate">{t.range}</p>
              <p className="text-[11px] text-slate-500 truncate">{t.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
