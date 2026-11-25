import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Loader2, Database, Calendar, AlertCircle } from 'lucide-react';
import CitySearchBar from '../components/CitySearchBar';
import { useLocationContext } from '../contexts/LocationContext';
import { fetchAirQualityAnalytics, fetchLiveAirQuality } from '../services/airQualityService';
import { fetchStoredReadingsForCity } from '../services/firestoreService';
import { SUGGESTED_CITIES, formatTimestamp, getDisplayAqi } from '../utils/aqi';

export default function AnalyticsPage() {
  const { selectedCity, aqiStandard, setAqiStandard } = useLocationContext();
  const [days, setDays] = useState(7);
  const [analytics, setAnalytics] = useState(null);
  const [storedReadings, setStoredReadings] = useState([]);
  const [cityCompareData, setCityCompareData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [hist, fsReadings, ...compareRes] = await Promise.all([
          fetchAirQualityAnalytics(selectedCity, days),
          fetchStoredReadingsForCity(selectedCity.name, 24).catch(() => []),
          ...SUGGESTED_CITIES.slice(0, 5).map((c) => fetchLiveAirQuality(c)),
        ]);
        if (!active) return;
        setAnalytics(hist);
        setStoredReadings(fsReadings);
        setCityCompareData(
          compareRes.map((r) => ({
            city: r.city,
            aqi: getDisplayAqi(r, aqiStandard) ?? 0,
            pm25: r.pm25 != null ? Number(r.pm25.toFixed(1)) : 0,
            pm10: r.pm10 != null ? Number(r.pm10.toFixed(1)) : 0,
          }))
        );
      } catch (err) {
        if (active) setError(err.message || 'Failed to load analytics.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [selectedCity?.lat, selectedCity?.lon, days, aqiStandard]);

  const aqiKey = aqiStandard === 'IN' ? 'aqiIN' : 'aqiUS';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Air Quality Analytics & Trends</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Hourly, daily, and multi-city particulate trends for {selectedCity?.name}.
          </p>
        </div>
        <div className="w-full md:w-[420px]">
          <CitySearchBar />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold text-slate-600">Time Window:</span>
          {[
            { val: 2, label: '48 Hours' },
            { val: 7, label: '7 Days' },
            { val: 14, label: '14 Days' },
          ].map((opt) => (
            <button
              key={opt.val}
              type="button"
              onClick={() => setDays(opt.val)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                days === opt.val
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">AQI Standard:</span>
          {['US', 'IN'].map((std) => (
            <button
              key={std}
              type="button"
              onClick={() => setAqiStandard(std)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                aqiStandard === std ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {std === 'IN' ? 'Indian CPCB' : 'US EPA'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
          <span className="text-sm">Loading historical air quality analytics...</span>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Hourly AQI */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <h2 className="font-bold text-slate-900 text-sm mb-1">Hourly AQI Trend (Last 48h)</h2>
            <p className="text-xs text-slate-500 mb-4">Source: {analytics?.source}</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.hourly || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} width={36} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey={aqiKey}
                    name={`${aqiStandard} AQI`}
                    stroke="#059669"
                    fill="#10b981"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily AQI */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <h2 className="font-bold text-slate-900 text-sm mb-1">Daily Average AQI ({days}-Day Comparison)</h2>
            <p className="text-xs text-slate-500 mb-4">Daily mean index progression</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.daily || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={36} />
                  <Tooltip />
                  <Bar dataKey={aqiKey} name={`${aqiStandard} AQI`} fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PM2.5 vs PM10 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <h2 className="font-bold text-slate-900 text-sm mb-1">PM2.5 vs PM10 Particulate Trends (µg/m³)</h2>
            <p className="text-xs text-slate-500 mb-4">Daily average particulate concentration</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics?.daily || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={36} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="pm25" name="PM2.5" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="pm10" name="PM10" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* City-to-City Comparison */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <h2 className="font-bold text-slate-900 text-sm mb-1">Regional City AQI Comparison ({aqiStandard})</h2>
            <p className="text-xs text-slate-500 mb-4">Live comparison across major Indian cities</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityCompareData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="city" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={36} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="aqi" name={`${aqiStandard} AQI`} fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="pm25" name="PM2.5" fill="#64748b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Firestore Stored Readings Archive */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-slate-900 text-sm">
              Firestore Archived Readings — {selectedCity?.name}
            </h2>
          </div>
          <span className="text-xs text-slate-500">{storedReadings.length} records</span>
        </div>

        {storedReadings.length === 0 ? (
          <p className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            No backend-persisted snapshots exist in Firestore <code>airQualityReadings</code> for {selectedCity?.name}{' '}
            yet. Cloud Functions automatically archive readings every 60 minutes (or on backend API calls). Charts above
            display live Open-Meteo reanalysis data.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 pr-3">Timestamp</th>
                  <th className="py-2 pr-3">US AQI</th>
                  <th className="py-2 pr-3">Indian AQI</th>
                  <th className="py-2 pr-3">PM2.5</th>
                  <th className="py-2 pr-3">PM10</th>
                  <th className="py-2">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {storedReadings.slice(0, 10).map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 pr-3 font-medium text-slate-700">{formatTimestamp(row.timestamp)}</td>
                    <td className="py-2 pr-3 font-bold">{row.aqiUS ?? '—'}</td>
                    <td className="py-2 pr-3 font-bold">{row.aqiIN ?? '—'}</td>
                    <td className="py-2 pr-3">{row.pm25 != null ? `${row.pm25} µg/m³` : '—'}</td>
                    <td className="py-2 pr-3">{row.pm10 != null ? `${row.pm10} µg/m³` : '—'}</td>
                    <td className="py-2 text-slate-500">{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
