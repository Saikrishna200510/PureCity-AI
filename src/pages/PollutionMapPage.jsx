import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Loader2, Info, Radio, Megaphone, Clock } from 'lucide-react';
import CitySearchBar from '../components/CitySearchBar';
import { useLocationContext } from '../contexts/LocationContext';
import { fetchNearbyStationsAndGrid } from '../services/airQualityService';
import { subscribeVerifiedReports } from '../services/firestoreService';
import { getAqiCategory, getDisplayAqi, formatTimestamp } from '../utils/aqi';

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center?.[0] != null && center?.[1] != null) {
      map.setView(center, 11, { animate: true });
    }
  }, [center?.[0], center?.[1], map]);
  return null;
}

export default function PollutionMapPage() {
  const { selectedCity, aqiStandard } = useLocationContext();
  const [stationsData, setStationsData] = useState({
    openAqStations: [],
    gridPoints: [],
    openAqStatus: 'loading',
    openAqMessage: '',
  });
  const [verifiedReports, setVerifiedReports] = useState([]);
  const [showCitizenReports, setShowCitizenReports] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState(null);

  useEffect(() => {
    const unsub = subscribeVerifiedReports((list) => setVerifiedReports(list));
    return () => unsub();
  }, []);

  useEffect(() => {
    let active = true;
    async function loadMapData() {
      setLoading(true);
      try {
        const res = await fetchNearbyStationsAndGrid(selectedCity, 35);
        if (active) {
          setStationsData(res);
          const first = res.openAqStations[0] || res.gridPoints[0] || null;
          setSelectedStation(first);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadMapData();
    return () => {
      active = false;
    };
  }, [selectedCity?.lat, selectedCity?.lon]);

  const allNodes = [...stationsData.openAqStations, ...stationsData.gridPoints];
  const center = [Number(selectedCity?.lat || 16.3067), Number(selectedCity?.lon || 80.4365)];

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Interactive Pollution Hotspot Map</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Explore monitoring stations, regional atmospheric readings, and verified citizen reports.
          </p>
        </div>
        <div className="w-full md:w-[440px]">
          <CitySearchBar />
        </div>
      </div>

      {stationsData.openAqStatus === 'not_configured' && (
        <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div>
            <strong>Data Transparency Notice:</strong> OpenAQ ground sensor API requires{' '}
            <code>OPENAQ_API_KEY</code> in Cloud Functions. Currently displaying live{' '}
            <strong>Open-Meteo Copernicus CAMS</strong> regional atmospheric grid points (clearly labeled as model
            grid, never simulated ground sensors).
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs relative">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-emerald-600" />
              {allNodes.length} Active Monitoring Points around {selectedCity?.name}
            </span>
            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-600 font-medium">
              <input
                type="checkbox"
                checked={showCitizenReports}
                onChange={(e) => setShowCitizenReports(e.target.checked)}
                className="rounded text-emerald-600"
              />
              Show Verified Citizen Reports ({verifiedReports.filter((r) => r.coordinates).length})
            </label>
          </div>

          <div className="h-[480px] w-full relative">
            {loading && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-xs flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              </div>
            )}

            <MapContainer center={center} zoom={11} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapRecenter center={center} />

              {allNodes.map((node) => {
                const aqi = getDisplayAqi(node, aqiStandard);
                const cat = getAqiCategory(aqi, aqiStandard);
                return (
                  <CircleMarker
                    key={node.id}
                    center={[node.lat, node.lon]}
                    radius={node.kind === 'ground_station' ? 12 : 10}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 2,
                      fillColor: cat.hex,
                      fillOpacity: 0.88,
                    }}
                    eventHandlers={{
                      click: () => setSelectedStation(node),
                    }}
                  >
                    <Popup>
                      <div className="min-w-[190px] text-xs space-y-1">
                        <p className="font-bold text-slate-900">{node.name}</p>
                        <p className="text-[11px] text-slate-500">{node.source}</p>
                        <p className="font-semibold" style={{ color: cat.hex }}>
                          {aqiStandard} AQI: {aqi ?? 'N/A'} ({cat.shortLabel})
                        </p>
                        <p>
                          PM2.5: {node.pm25 != null ? `${node.pm25.toFixed(1)} µg/m³` : '—'} • PM10:{' '}
                          {node.pm10 != null ? `${node.pm10.toFixed(1)} µg/m³` : '—'}
                        </p>
                        <p className="text-[10px] text-slate-400">Updated: {formatTimestamp(node.timestamp)}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

              {showCitizenReports &&
                verifiedReports
                  .filter((r) => r.coordinates?.lat != null && r.coordinates?.lon != null)
                  .map((rep) => (
                    <CircleMarker
                      key={rep.id}
                      center={[rep.coordinates.lat, rep.coordinates.lon]}
                      radius={8}
                      pathOptions={{
                        color: '#0f172a',
                        weight: 2,
                        fillColor: '#f59e0b',
                        fillOpacity: 0.9,
                      }}
                    >
                      <Popup>
                        <div className="min-w-[190px] text-xs space-y-1">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]">
                            Citizen Report (Verified)
                          </span>
                          <p className="font-bold text-slate-900">{rep.category}</p>
                          <p className="text-slate-600">{rep.locationName}</p>
                          <p className="text-slate-500">{rep.description}</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
            </MapContainer>
          </div>
        </div>

        {/* Station Inspector & Nearby List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h2 className="font-bold text-slate-900 text-sm mb-3">Selected Monitoring Point</h2>
            {selectedStation ? (
              (() => {
                const aqi = getDisplayAqi(selectedStation, aqiStandard);
                const cat = getAqiCategory(aqi, aqiStandard);
                return (
                  <div className="space-y-3">
                    <div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {selectedStation.source}
                      </span>
                      <h3 className="font-bold text-slate-900 mt-1.5">{selectedStation.name}</h3>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(selectedStation.timestamp)}
                      </p>
                    </div>
                    <div className={`p-3.5 rounded-xl border ${cat.bgClass} ${cat.borderClass}`}>
                      <span className="text-2xl font-extrabold" style={{ color: cat.hex }}>
                        {aqi ?? 'N/A'}
                      </span>
                      <span className="ml-2 text-xs font-semibold text-slate-700">{cat.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 block">PM2.5</span>
                        <span className="font-bold">
                          {selectedStation.pm25 != null ? `${selectedStation.pm25.toFixed(1)} µg/m³` : '—'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 block">PM10</span>
                        <span className="font-bold">
                          {selectedStation.pm10 != null ? `${selectedStation.pm10.toFixed(1)} µg/m³` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <p className="text-xs text-slate-500">Click a marker on the map to view pollutant readings.</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs max-h-72 overflow-y-auto">
            <h2 className="font-bold text-slate-900 text-sm mb-3">Nearby Stations & Grid Nodes</h2>
            <div className="space-y-2">
              {allNodes.map((n) => {
                const aqi = getDisplayAqi(n, aqiStandard);
                const cat = getAqiCategory(aqi, aqiStandard);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedStation(n)}
                    className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                      selectedStation?.id === n.id
                        ? 'border-emerald-400 bg-emerald-50/50'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-slate-800 truncate">{n.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{n.source}</p>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded-lg text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: cat.hex }}
                    >
                      {aqi ?? 'N/A'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start gap-2">
            <Megaphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Amber markers represent <strong>community citizen reports</strong> (verified by moderators), kept distinct
              from atmospheric sensor readings.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
