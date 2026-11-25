import { useState, useEffect } from 'react';
import { Trash2, Plus, ArrowLeftRight, Loader2, MapPin, Check } from 'lucide-react';
import CitySearchBar from '../components/CitySearchBar';
import { AqiHeroCard } from '../components/AqiCards';
import { useLocationContext } from '../contexts/LocationContext';
import { fetchLiveAirQuality } from '../services/airQualityService';
import { removeFavoriteLocation } from '../services/firestoreService';
import { SUGGESTED_CITIES, getAqiCategory, getDisplayAqi } from '../utils/aqi';

export default function AirMonitoringPage() {
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

  const [compareCities, setCompareCities] = useState([
    SUGGESTED_CITIES[0], // Guntur
    SUGGESTED_CITIES[1], // Vijayawada
    SUGGESTED_CITIES[3], // Hyderabad
  ]);
  const [compareReadings, setCompareReadings] = useState({});
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadComparisons() {
      setComparing(true);
      try {
        const entries = await Promise.all(
          compareCities.map(async (c) => {
            const r = await fetchLiveAirQuality(c);
            return [c.name, r];
          })
        );
        if (active) setCompareReadings(Object.fromEntries(entries));
      } finally {
        if (active) setComparing(false);
      }
    }
    loadComparisons();
    return () => {
      active = false;
    };
  }, [compareCities]);

  function addCityToCompare(city) {
    setCompareCities((prev) => {
      if (prev.some((c) => c.name.toLowerCase() === city.name.toLowerCase())) return prev;
      return [...prev.slice(-2), city]; // Keep up to 3 cities
    });
  }

  const pollutants = [
    { name: 'PM2.5', value: currentReading?.pm25, unit: 'µg/m³', guideline: 'WHO 24h: 15 µg/m³' },
    { name: 'PM10', value: currentReading?.pm10, unit: 'µg/m³', guideline: 'WHO 24h: 45 µg/m³' },
    { name: 'NO₂', value: currentReading?.no2, unit: 'µg/m³', guideline: 'WHO 24h: 25 µg/m³' },
    { name: 'O₃ (Ozone)', value: currentReading?.o3, unit: 'µg/m³', guideline: 'WHO 8h: 100 µg/m³' },
    { name: 'SO₂', value: currentReading?.so2, unit: 'µg/m³', guideline: 'WHO 24h: 40 µg/m³' },
    { name: 'CO', value: currentReading?.co, unit: 'µg/m³', guideline: 'WHO 24h: 4000 µg/m³' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Air Quality Monitoring & City Comparison</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Search any city or area, inspect detailed pollutant concentrations, and compare air quality side by side.
          </p>
        </div>
        <div className="w-full md:w-[440px]">
          <CitySearchBar />
        </div>
      </div>

      <AqiHeroCard
        reading={currentReading}
        standard={aqiStandard}
        onToggleStandard={setAqiStandard}
        loading={loadingReading}
        onRefresh={() => refreshReading(selectedCity, true)}
        city={selectedCity}
      />

      {/* Detailed Pollutants Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
        <h2 className="font-bold text-slate-900 mb-4">Pollutant Breakdown — {selectedCity?.name}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {pollutants.map((p) => (
            <div key={p.name} className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
              <p className="text-xs font-semibold text-slate-500">{p.name}</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {p.value != null ? Number(p.value).toFixed(1) : '—'}
              </p>
              <p className="text-[11px] text-slate-500">{p.unit}</p>
              <p className="text-[10px] text-emerald-700 mt-2 font-medium">{p.guideline}</p>
            </div>
          ))}
        </div>
      </div>

      {/* City-to-City Comparison */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="font-bold text-slate-900">Live City-to-City Comparison</h2>
              <p className="text-xs text-slate-500">Compare up to 3 cities simultaneously ({aqiStandard} AQI)</p>
            </div>
          </div>
          <div className="w-full sm:w-80">
            <CitySearchBar compact onSelect={addCityToCompare} />
          </div>
        </div>

        {comparing && Object.keys(compareReadings).length === 0 ? (
          <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            Loading city comparison...
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {compareCities.map((city) => {
              const r = compareReadings[city.name];
              const aqi = getDisplayAqi(r, aqiStandard);
              const cat = getAqiCategory(aqi, aqiStandard);
              const isSelected = city.name.toLowerCase() === selectedCity?.name?.toLowerCase();

              return (
                <div
                  key={city.name}
                  className={`rounded-2xl border p-4 transition ${
                    isSelected ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900">{city.name}</h3>
                      <p className="text-xs text-slate-500">{city.state || city.country}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectCity(city)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50'
                      }`}
                    >
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        'Focus'
                      )}
                    </button>
                  </div>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold" style={{ color: cat.hex }}>
                      {aqi ?? 'N/A'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cat.badgeClass}`}>
                      {cat.shortLabel}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">PM2.5</span>
                      <span className="font-semibold">{r?.pm25 != null ? r.pm25.toFixed(1) : '—'}</span>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">PM10</span>
                      <span className="font-semibold">{r?.pm10 != null ? r.pm10.toFixed(1) : '—'}</span>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Wind</span>
                      <span className="font-semibold">{r?.windSpeed != null ? `${r.windSpeed}` : '—'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Favorite Cities Management */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
        <h2 className="font-bold text-slate-900 mb-3">Saved Favorite Locations</h2>
        {favorites.length === 0 ? (
          <p className="text-sm text-slate-500">
            You have no saved cities yet. Click the <strong>Save</strong> button in the search bar to bookmark a city.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favorites.map((fav) => (
              <div
                key={fav.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/70"
              >
                <button
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
                  className="flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{fav.locationName}</p>
                    <p className="text-xs text-slate-500">
                      {[fav.state, fav.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => removeFavoriteLocation(fav.id)}
                  aria-label={`Remove ${fav.locationName}`}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
