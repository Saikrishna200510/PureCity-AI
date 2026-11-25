import { useEffect, useState } from 'react';
import { UserCog, Save, KeyRound, CheckCircle2, Loader2, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import CitySearchBar from '../components/CitySearchBar';
import { ACTIVITY_OPTIONS, SENSITIVITY_OPTIONS } from '../utils/recommendations';
import { DEFAULT_CITY, formatTimestamp } from '../utils/aqi';

export default function ProfilePage() {
  const { user, userProfile, updateUserProfile, resetPassword } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [preferredCity, setPreferredCity] = useState(DEFAULT_CITY);
  const [preferredStandard, setPreferredStandard] = useState('US');
  const [activityPreference, setActivityPreference] = useState('general');
  const [sensitivityGroup, setSensitivityGroup] = useState('standard');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || user?.displayName || '');
      if (userProfile.preferredCity) setPreferredCity(userProfile.preferredCity);
      if (userProfile.preferredStandard) setPreferredStandard(userProfile.preferredStandard);
      if (userProfile.activityPreference) setActivityPreference(userProfile.activityPreference);
      if (userProfile.sensitivityGroup) setSensitivityGroup(userProfile.sensitivityGroup);
    }
  }, [userProfile, user?.displayName]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg('');
    try {
      await updateUserProfile({
        displayName,
        preferredCity,
        preferredStandard,
        activityPreference,
        sensitivityGroup,
      });
      setSavedMsg('Profile and environmental preferences saved.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    if (!user?.email) return;
    await resetPassword(user.email);
    setResetMsg(`Password reset email sent to ${user.email}.`);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">User Profile & Preferences</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Customize your default monitoring location, AQI standard, and outdoor sensitivity profile.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCog className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-slate-900">{user?.email}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                Role: <span className="capitalize font-semibold">{userProfile?.role || 'user'}</span> • Joined{' '}
                {formatTimestamp(userProfile?.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {savedMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {savedMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Display Name</label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Default City ({preferredCity?.name}
            {preferredCity?.state ? `, ${preferredCity.state}` : ''})
          </label>
          <CitySearchBar compact onSelect={setPreferredCity} />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">AQI Standard</label>
            <select
              value={preferredStandard}
              onChange={(e) => setPreferredStandard(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl"
            >
              <option value="US">US AQI (EPA)</option>
              <option value="IN">Indian AQI (CPCB)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Preferred Activity</label>
            <select
              value={activityPreference}
              onChange={(e) => setActivityPreference(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl"
            >
              {ACTIVITY_OPTIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Sensitivity Group</label>
            <select
              value={sensitivityGroup}
              onChange={(e) => setSensitivityGroup(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl"
            >
              {SENSITIVITY_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePasswordReset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            Send Password Reset Email
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>

        {resetMsg && <p className="text-xs text-emerald-700 font-medium">{resetMsg}</p>}
      </form>
    </div>
  );
}
