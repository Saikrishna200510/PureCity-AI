import { useEffect, useState } from 'react';
import { Bell, Plus, Trash2, Check, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext } from '../contexts/LocationContext';
import CitySearchBar from '../components/CitySearchBar';
import {
  subscribeUserAlerts,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
} from '../services/firestoreService';
import { fetchLiveAirQuality } from '../services/airQualityService';
import { apiRequest } from '../services/apiClient';
import { formatTimestamp, getAqiCategory } from '../utils/aqi';

export default function AlertsPage() {
  const { user } = useAuth();
  const { selectedCity, aqiStandard } = useLocationContext();

  const [alerts, setAlerts] = useState([]);
  const [targetCity, setTargetCity] = useState(selectedCity);
  const [threshold, setThreshold] = useState(100);
  const [creating, setCreating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    setTargetCity(selectedCity);
  }, [selectedCity?.name]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeUserAlerts(user.uid, setAlerts);
    return () => unsub();
  }, [user?.uid]);

  async function handleCreateAlert(e) {
    e.preventDefault();
    if (!user?.uid) return;
    setCreating(true);
    setStatusMsg('');
    try {
      await createAlertRule({
        userId: user.uid,
        location: targetCity,
        aqiThreshold: Number(threshold),
        standard: aqiStandard,
        inAppEnabled: true,
      });
      setStatusMsg(`Alert rule created for ${targetCity.name} (AQI ≥ ${threshold}).`);
    } finally {
      setCreating(false);
    }
  }

  async function handleEvaluateNow() {
    setEvaluating(true);
    setStatusMsg('');
    try {
      // Try Cloud Function evaluation first
      try {
        const res = await apiRequest('/alerts/evaluate', { method: 'POST' });
        setStatusMsg(`Evaluated ${res.evaluated} active rule(s); ${res.triggered} warning(s) triggered.`);
        return;
      } catch {
        // Fallback client-side check for active user rules when functions aren't running locally
      }

      let triggered = 0;
      const now = Date.now();
      for (const a of alerts.filter((x) => x.isActive)) {
        const lastTrig = a.lastTriggeredAt?.toMillis ? a.lastTriggeredAt.toMillis() : 0;
        if (now - lastTrig < 60 * 60 * 1000) continue; // 1h cooldown avoids duplicate spam
        const reading = await fetchLiveAirQuality({ name: a.locationName, lat: a.lat, lon: a.lon });
        const val = a.standard === 'IN' ? reading.aqiIN : reading.aqiUS;
        if (val != null && val >= a.aqiThreshold) {
          triggered += 1;
          const cat = getAqiCategory(val, a.standard);
          const entry = {
            id: `evt_${now}_${Math.random().toString(36).slice(2, 6)}`,
            aqi: val,
            standard: a.standard,
            category: cat.label,
            pm25: reading.pm25,
            message: `${a.locationName} reached ${val} (${a.standard} AQI), exceeding your threshold of ${a.aqiThreshold}.`,
            triggeredAt: new Date().toISOString(),
            read: false,
          };
          await updateAlertRule(a.id, {
            lastTriggeredAt: new Date(),
            history: [entry, ...(a.history || [])].slice(0, 25),
          });
        }
      }
      setStatusMsg(`Evaluated ${alerts.filter((x) => x.isActive).length} active rule(s); ${triggered} triggered.`);
    } finally {
      setEvaluating(false);
    }
  }

  async function handleMarkRead(alertDoc, eventId) {
    const nextHistory = (alertDoc.history || []).map((h) =>
      h.id === eventId ? { ...h, read: true } : h
    );
    await updateAlertRule(alertDoc.id, { history: nextHistory });
  }

  const allEvents = alerts
    .flatMap((a) => (a.history || []).map((h) => ({ ...h, alertDoc: a })))
    .sort((a, b) => new Date(b.triggeredAt) - new Date(a.triggeredAt));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pollution Alerts & Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Set custom AQI thresholds for your saved cities. Alerts enforce a 60-minute cooldown to prevent spam.
          </p>
        </div>
        <button
          type="button"
          onClick={handleEvaluateNow}
          disabled={evaluating || alerts.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${evaluating ? 'animate-spin text-emerald-600' : ''}`} />
          Check Thresholds Now
        </button>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          {statusMsg}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Create Rule */}
        <form
          onSubmit={handleCreateAlert}
          className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4 self-start"
        >
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900">Create Alert Rule</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Target Location ({targetCity?.name})
            </label>
            <CitySearchBar compact onSelect={setTargetCity} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                AQI Warning Threshold ({aqiStandard})
              </label>
              <span className="text-sm font-bold text-emerald-700">{threshold}</span>
            </div>
            <input
              type="range"
              min={25}
              max={300}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>25 (Strict)</span>
              <span>100 (Moderate)</span>
              <span>150 (Sensitive)</span>
              <span>300 (Severe)</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Save Alert Rule
          </button>
        </form>

        {/* Active Rules & Alert History */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <h2 className="font-bold text-slate-900 text-sm mb-3">Your Alert Rules ({alerts.length})</h2>
            {alerts.length === 0 ? (
              <p className="text-xs text-slate-500">No alert rules configured yet.</p>
            ) : (
              <div className="space-y-2.5">
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/70"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{a.locationName}</p>
                      <p className="text-xs text-slate-500">
                        Notify when {a.standard} AQI ≥ <strong>{a.aqiThreshold}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateAlertRule(a.id, { isActive: !a.isActive })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                          a.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {a.isActive ? 'Active' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAlertRule(a.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        aria-label="Delete rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <h2 className="font-bold text-slate-900 text-sm mb-3">Notification & Alert History</h2>
            {allEvents.length === 0 ? (
              <p className="text-xs text-slate-500">
                No high-pollution alerts triggered yet. You will see warnings here when monitored cities cross your
                threshold.
              </p>
            ) : (
              <div className="space-y-2.5">
                {allEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                      evt.read ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 mt-0.5 ${evt.read ? 'text-slate-400' : 'text-amber-600'}`}
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{evt.message}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {evt.category} • {formatTimestamp(evt.triggeredAt)}
                        </p>
                      </div>
                    </div>
                    {!evt.read && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(evt.alertDoc, evt.id)}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        Mark Read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
