import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Heart,
  CheckCircle2,
  Bot,
  ArrowRight,
  MapPin,
  ShieldAlert,
  Save,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import CitySearchBar from '../components/CitySearchBar';
import { AqiHeroCard, AqiScaleLegend } from '../components/AqiCards';
import { useLocationContext } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import {
  ACTIVITY_OPTIONS,
  SENSITIVITY_OPTIONS,
  buildPersonalizedRecommendations,
} from '../utils/recommendations';
import { calculateIndianAqiFromPollutants, calculateUSAqiFromPollutants } from '../utils/aqi';

export default function DashboardPage() {
  const { userProfile, updateUserProfile } = useAuth();
  const {
    selectedCity,
    selectCity,
    aqiStandard,
    setAqiStandard,
    currentReading,
    loadingReading,
    refreshReading,
    favorites,
  } = useLocationContext();

  const [activity, setActivity] = useState(userProfile?.activityPreference || 'general');
  const [sensitivity, setSensitivity] = useState(userProfile?.sensitivityGroup || 'standard');
  const [savingPref, setSavingPref] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (userProfile?.activityPreference) setActivity(userProfile.activityPreference);
    if (userProfile?.sensitivityGroup) setSensitivity(userProfile.sensitivityGroup);
  }, [userProfile?.activityPreference, userProfile?.sensitivityGroup]);

  const advice = buildPersonalizedRecommendations({
    reading: currentReading,
    standard: aqiStandard,
    activity,
    sensitivity,
  });

  async function handleSavePreferences() {
    setSavingPref(true);
    setSavedMsg('');
    try {
      await updateUserProfile({
        activityPreference: activity,
        sensitivityGroup: sensitivity,
        preferredCity: selectedCity,
      });
      setSavedMsg('Preferences saved');
      setTimeout(() => setSavedMsg(''), 3000);
    } finally {
      setSavingPref(false);
    }
  }

  // Build 24h mini-trend from real Open-Meteo hourly array when present
  const hourlyChartData = (() => {
    const h = currentReading?.hourly;
    if (!h?.time?.length) return [];
    const nowIdx = Math.max(0, h.time.length - 48);
    const sliceEnd = Math.min(h.time.length, nowIdx + 24);
    const pts = [];
    for (let i = nowIdx; i < sliceEnd; i += 1) {
      const pm25 = h.pm2_5?.[i];
      const pm10 = h.pm10?.[i];
      const val =
        aqiStandard === 'IN'
          ? calculateIndianAqiFromPollutants(pm25, pm10)
          : h.us_aqi?.[i] ?? calculateUSAqiFromPollutants(pm25, pm10);
      pts.push({
        hour: new Date(h.time[i]).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        aqi: val,
        pm25: pm25 != null ? Number(pm25.toFixed(1)) : null,
      });
    }
    return pts;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Air Quality Intelligence Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Live environmental monitoring, personalized exposure guidance, and quick AI insights.
          </p>
        </div>
        <div className="w-full md:w-[460px]">
          <CitySearchBar />
        </div>
      </div>

      {favorites.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            Saved Cities:
          </span>
          {favorites.map((fav) => {
            const active = fav.locationName.toLowerCase() === selectedCity?.name?.toLowerCase();
            return (
              <button
                key={fav.id}
                type="button"
                onClick={() =>
                  selectCity({
                    name: fav.locationName,
                    state: fav.state,
                    country: fav.country,
                    lat: fav.lat,
                    lon: fav.lon,
                  })
                }
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                }`}
              >
                {fav.locationName}
              </button>
            );
          })}
        </div>
      )}

      <AqiHeroCard
        reading={currentReading}
        standard={aqiStandard}
        onToggleStandard={setAqiStandard}
        loading={loadingReading}
        onRefresh={() => refreshReading(selectedCity, true)}
        city={selectedCity}
      />

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Personalized Recommendations */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Personalized Outdoor Recommendations</h2>
                <p className="text-xs text-slate-500">Tailored to your activity & health sensitivity</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSavePreferences}
              disabled={savingPref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {savedMsg || (savingPref ? 'Saving...' : 'Save Preferences')}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Outdoor Activity
              </label>
              <select
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              >
                {ACTIVITY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Sensitivity Profile
              </label>
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              >
                {SENSITIVITY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              {advice.status === 'unavailable' ? (
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              {advice.headline}
            </h3>
            <ul className="mt-2.5 space-y-2">
              {advice.recommendations.map((rec, idx) => (
                <li key={idx} className="text-xs sm:text-sm text-slate-700 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
            {advice.disclaimer && (
              <p className="mt-3 text-[11px] text-slate-400">{advice.disclaimer}</p>
            )}
          </div>
        </div>

        {/* 24h Trend + Quick Actions */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-slate-900 text-sm">24-Hour AQI Trend ({aqiStandard})</h2>
                <p className="text-xs text-slate-500">Hourly atmospheric progression</p>
              </div>
              <Link to="/analytics" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                Full Analytics →
              </Link>
            </div>

            {hourlyChartData.length > 0 ? (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyChartData}>
                    <defs>
                      <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={32} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="aqi"
                      stroke="#059669"
                      strokeWidth={2}
                      fill="url(#aqiGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                Hourly trend unavailable for this reading.
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-xs">
            <div className="flex items-center gap-2.5 mb-2">
              <Bot className="w-5 h-5 text-emerald-200" />
              <h3 className="font-bold">Ask PureCity AI</h3>
            </div>
            <p className="text-xs text-emerald-50/90 leading-relaxed">
              Get Gemini-powered answers grounded in {selectedCity?.name}'s live readings: running safety, pollution
              causes, or nearby cleaner zones.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/assistant"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-emerald-800 text-xs font-semibold hover:bg-emerald-50 transition"
              >
                Open AI Assistant
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/map"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/30 border border-white/20 text-white text-xs font-semibold hover:bg-emerald-500/40 transition"
              >
                <MapPin className="w-3.5 h-3.5" />
                Hotspot Map
              </Link>
            </div>
          </div>
        </div>
      </div>

      <AqiScaleLegend standard={aqiStandard} />
    </div>
  );
}
