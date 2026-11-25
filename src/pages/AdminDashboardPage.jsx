import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  Megaphone,
  Database,
  Bell,
  Bot,
  Check,
  X,
  Flag,
  Loader2,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { apiRequest } from '../services/apiClient';
import {
  subscribeAllReportsAdmin,
  moderatePollutionReport,
} from '../services/firestoreService';
import { formatTimestamp } from '../utils/aqi';

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [error, setError] = useState('');
  const [noteByReport, setNoteByReport] = useState({});
  const [settingsForm, setSettingsForm] = useState({
    defaultStandard: 'US',
    alertCooldownMinutes: 60,
    enableScheduledSync: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  async function loadOverview() {
    setLoadingOverview(true);
    setError('');
    try {
      const data = await apiRequest('/admin/overview');
      setOverview(data);
      if (data.settings) setSettingsForm(data.settings);
    } catch (err) {
      setError(
        err.message ||
          'Admin overview requires Cloud Functions (/api/admin/overview) running with administrator privileges.'
      );
    } finally {
      setLoadingOverview(false);
    }
  }

  useEffect(() => {
    loadOverview();
    const unsub = subscribeAllReportsAdmin(setReports);
    return () => unsub();
  }, []);

  async function handleModerate(reportId, status) {
    const note = noteByReport[reportId] || '';
    await moderatePollutionReport(reportId, status, note);
  }

  async function handleRoleChange(targetUid, nextRole) {
    try {
      await apiRequest('/admin/users/role', {
        method: 'POST',
        body: JSON.stringify({ targetUid, role: nextRole }),
      });
      await loadOverview();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiRequest('/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settingsForm),
      });
      await loadOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  const filteredReports =
    filterStatus === 'all' ? reports : reports.filter((r) => r.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            Administrator Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage platform users, moderate citizen pollution reports, and monitor system telemetry.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={Users} label="Registered Users" value={overview?.stats?.totalUsers ?? '—'} />
        <KpiCard icon={Database} label="Archived Readings" value={overview?.stats?.totalReadings ?? '—'} />
        <KpiCard icon={Megaphone} label="Citizen Reports" value={reports.length} />
        <KpiCard icon={Bell} label="Active Alert Rules" value={overview?.stats?.totalAlerts ?? '—'} />
        <KpiCard icon={Bot} label="AI Conversations" value={overview?.stats?.totalConversations ?? '—'} />
      </div>

      {/* Citizen Reports Moderation */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-bold text-slate-900">Citizen Report Moderation</h2>
          <div className="flex gap-1.5">
            {['all', 'pending', 'verified', 'flagged', 'rejected'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize cursor-pointer ${
                  filterStatus === st ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No reports matching "{filterStatus}".</p>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((rep) => (
              <div key={rep.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900">{rep.category}</span>
                    <span className="text-xs text-slate-500 ml-2">• {rep.locationName}</span>
                  </div>
                  <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-white border border-slate-200">
                    {rep.status}
                  </span>
                </div>
                <p className="text-xs text-slate-700">{rep.description}</p>
                <p className="text-[11px] text-slate-400">
                  By {rep.reporterName || 'Citizen'} • {formatTimestamp(rep.createdAt)}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Optional moderator note..."
                    value={noteByReport[rep.id] ?? rep.moderationNote ?? ''}
                    onChange={(e) => setNoteByReport((prev) => ({ ...prev, [rep.id]: e.target.value }))}
                    className="flex-1 min-w-[180px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleModerate(rep.id, 'verified')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModerate(rep.id, 'flagged')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" /> Flag
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModerate(rep.id, 'rejected')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Management & Settings */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <h2 className="font-bold text-slate-900 mb-3">User Management</h2>
          {loadingOverview ? (
            <div className="py-6 flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Loading users...
            </div>
          ) : !overview?.users?.length ? (
            <p className="text-xs text-slate-500">No user directory loaded (requires Cloud Functions backend).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">City</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.users.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-2.5 pr-3 font-semibold text-slate-800">{u.displayName}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{u.email}</td>
                      <td className="py-2.5 pr-3">{u.preferredCity}</td>
                      <td className="py-2.5 pr-3 capitalize font-semibold">{u.role}</td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          onClick={() => handleRoleChange(u.uid, u.role === 'admin' ? 'user' : 'admin')}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold cursor-pointer"
                        >
                          {u.role === 'admin' ? 'Set User' : 'Make Admin'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSaveSettings}
          className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4 self-start"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-slate-900">Global Settings</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Default AQI Standard</label>
            <select
              value={settingsForm.defaultStandard}
              onChange={(e) => setSettingsForm((s) => ({ ...s, defaultStandard: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
            >
              <option value="US">US AQI (EPA)</option>
              <option value="IN">Indian AQI (CPCB)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alert Cooldown (minutes)
            </label>
            <input
              type="number"
              min={15}
              max={1440}
              value={settingsForm.alertCooldownMinutes}
              onChange={(e) => setSettingsForm((s) => ({ ...s, alertCooldownMinutes: Number(e.target.value) }))}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={settingsForm.enableScheduledSync}
              onChange={(e) => setSettingsForm((s) => ({ ...s, enableScheduledSync: e.target.checked }))}
              className="rounded text-emerald-600"
            />
            Enable hourly scheduled sync
          </label>

          <button
            type="submit"
            disabled={savingSettings}
            className="w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
          >
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-xs font-medium">{label}</span>
        <Icon className="w-4 h-4 text-emerald-600" />
      </div>
      <p className="text-2xl font-extrabold text-slate-900 mt-1.5">{value}</p>
    </div>
  );
}
