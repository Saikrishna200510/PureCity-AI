import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wind,
  MapPin,
  Bot,
  BarChart3,
  Megaphone,
  Bell,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Clock,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { fetchLiveAirQuality } from '../services/airQualityService';
import { DEFAULT_CITY, getAqiCategory, formatTimestamp } from '../utils/aqi';

export default function LandingPage() {
  const { user } = useAuth();
  const [gunturReading, setGunturReading] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchLiveAirQuality(DEFAULT_CITY)
      .then((res) => {
        if (active) setGunturReading(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const cat = getAqiCategory(gunturReading?.aqiUS, 'US');

  const features = [
    {
      icon: Wind,
      title: 'Real-Time AQI & Pollutants',
      desc: 'Track PM2.5, PM10, NO₂, O₃, and weather conditions with dual US EPA & Indian CPCB AQI standards.',
    },
    {
      icon: MapPin,
      title: 'Interactive Pollution Map',
      desc: 'Explore color-coded monitoring stations, atmospheric grid hotspots, and verified citizen reports on OpenStreetMap.',
    },
    {
      icon: Bot,
      title: 'Gemini AI Air Assistant',
      desc: 'Ask natural questions about running safety, local pollution sources, and sensitive-group guidance grounded in live readings.',
    },
    {
      icon: BarChart3,
      title: 'Historical Analytics',
      desc: 'Visualize hourly, daily, and multi-city particulate trends with interactive Recharts dashboards.',
    },
    {
      icon: Megaphone,
      title: 'Citizen Pollution Reporting',
      desc: 'Report open burning, dust, or industrial smoke with optional photos and GPS coordinates, backed by moderation.',
    },
    {
      icon: Bell,
      title: 'Smart AQI Threshold Alerts',
      desc: 'Receive timely high-pollution warnings for your saved cities without noisy duplicate notifications.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandLogo size="md" showTagline />
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition shadow-xs"
              >
                Open Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition shadow-xs"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-semibold mb-4">
              <ShieldCheck className="w-4 h-4" />
              Hack2Skill Challenge 6 • Environmental Intelligence Platform
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Cleaner Cities.{' '}
              <span className="text-emerald-600">Smarter Air. Healthier Lives.</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              Monitor live AQI, PM2.5, and PM10 in your neighborhood, explore pollution hotspots, get Gemini AI-powered
              outdoor guidance tailored to your activities, and report local emission events.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                to={user ? '/dashboard' : '/register'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition shadow-sm"
              >
                {user ? 'Go to Live Dashboard' : 'Create Free Account'}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition"
              >
                Sign In to Monitor
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                    Initial Demonstration Location
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    Guntur, Andhra Pradesh, India
                  </h2>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  Live Feed
                </span>
              </div>

              {loading ? (
                <div className="py-10 flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span className="text-xs">Fetching live atmospheric reading...</span>
                </div>
              ) : gunturReading?.unavailable ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                  Live feed temporarily unavailable. Sign in to view cached measurements and alerts.
                </div>
              ) : (
                <>
                  <div className={`p-4 rounded-2xl border ${cat.bgClass} ${cat.borderClass} flex items-center justify-between`}>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">US AQI / Indian AQI</p>
                      <div className="flex items-baseline gap-3 mt-1">
                        <span className="text-4xl font-extrabold" style={{ color: cat.hex }}>
                          {gunturReading?.aqiUS ?? 'N/A'}
                        </span>
                        <span className="text-sm font-semibold text-slate-600">
                          (IN: {gunturReading?.aqiIN ?? 'N/A'})
                        </span>
                      </div>
                      <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cat.badgeClass}`}>
                        {cat.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 mt-4">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[11px] text-slate-500">PM2.5</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {gunturReading?.pm25 != null ? `${gunturReading.pm25.toFixed(1)} µg/m³` : '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[11px] text-slate-500">PM10</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {gunturReading?.pm10 != null ? `${gunturReading.pm10.toFixed(1)} µg/m³` : '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[11px] text-slate-500">Temp</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {gunturReading?.temperature != null ? `${gunturReading.temperature}°C` : '—'}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {gunturReading?.source} • {formatTimestamp(gunturReading?.timestamp)}
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Complete Citizen Air Quality Toolkit
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Built with Firebase, Google Gemini AI, Leaflet OpenStreetMap, and live atmospheric data.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition"
                >
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900">{f.title}</h3>
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo size="sm" showTagline />
          <p className="text-xs text-slate-500 text-center sm:text-right">
            PureCity AI • Urban Air Quality Assistant (Hack2Skill). Powered by Firebase, Google Gemini, Leaflet &amp; Open-Meteo.
          </p>
        </div>
      </footer>
    </div>
  );
}
