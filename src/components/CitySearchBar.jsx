import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Navigation, Heart, Loader2, X } from 'lucide-react';
import { searchLocations, reverseGeocode } from '../services/airQualityService';
import { useLocationContext } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import { SUGGESTED_CITIES } from '../utils/aqi';

export default function CitySearchBar({ onSelect, compact = false }) {
  const { selectedCity, selectCity, toggleFavorite, isFavorite } = useLocationContext();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(SUGGESTED_CITIES);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults(SUGGESTED_CITIES);
        return;
      }
      setSearching(true);
      try {
        const list = await searchLocations(query);
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function handlePick(city) {
    if (onSelect) {
      onSelect(city);
    } else {
      selectCity(city);
    }
    setQuery('');
    setOpen(false);
    setGeoError('');
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const city = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          handlePick(city);
        } catch {
          setGeoError('Unable to resolve your current location.');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setGeoError(
          err.code === 1
            ? 'Location permission denied. Please search for your city manually.'
            : 'Unable to detect your GPS location.'
        );
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  const favored = isFavorite(selectedCity);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[210px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            placeholder="Search city or area (e.g., Guntur, Hyderabad, Delhi)..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition disabled:opacity-60 cursor-pointer"
          title="Detect my current location"
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          {!compact && <span>My Location</span>}
        </button>

        {!onSelect && user && (
          <button
            type="button"
            onClick={() => toggleFavorite(selectedCity)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border transition cursor-pointer ${
              favored
                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title={favored ? 'Remove from favorite cities' : 'Save to favorite cities'}
          >
            <Heart className={`w-4 h-4 ${favored ? 'fill-rose-500 text-rose-500' : ''}`} />
            {!compact && <span>{favored ? 'Saved' : 'Save'}</span>}
          </button>
        )}
      </div>

      {geoError && <p className="mt-1.5 text-xs text-rose-600">{geoError}</p>}

      {open && (
        <div className="absolute z-40 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{query.trim() ? 'Search Results' : 'Suggested Cities'}</span>
            {searching && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
          </div>
          {results.length === 0 && !searching ? (
            <div className="p-4 text-sm text-slate-500 text-center">
              No matching locations found for "{query}".
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((city, idx) => (
                <li key={`${city.name}-${city.lat}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => handlePick(city)}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50/70 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{city.name}</p>
                        <p className="text-xs text-slate-500">
                          {[city.state, city.country].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {Number(city.lat).toFixed(2)}, {Number(city.lon).toFixed(2)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
