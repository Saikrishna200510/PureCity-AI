import { useEffect, useState } from 'react';
import {
  Megaphone,
  Camera,
  Navigation,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext } from '../contexts/LocationContext';
import {
  subscribeVerifiedReports,
  subscribeUserReports,
  uploadReportImage,
  createPollutionReport,
} from '../services/firestoreService';
import { formatTimestamp } from '../utils/aqi';

const CATEGORIES = [
  'Open Burning',
  'Industrial Smoke',
  'Vehicle Emissions',
  'Construction Dust',
  'Waste Dumping',
  'Other',
];

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  flagged: 'bg-orange-100 text-orange-800 border-orange-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
};

export default function CitizenReportsPage() {
  const { user, userProfile } = useAuth();
  const { selectedCity } = useLocationContext();

  const [locationName, setLocationName] = useState(selectedCity?.name || 'Guntur');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [reportedAt, setReportedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [lat, setLat] = useState(String(selectedCity?.lat || ''));
  const [lon, setLon] = useState(String(selectedCity?.lon || ''));
  const [imageFile, setImageFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('community');
  const [verifiedReports, setVerifiedReports] = useState([]);
  const [myReports, setMyReports] = useState([]);

  useEffect(() => {
    const unsub1 = subscribeVerifiedReports(setVerifiedReports);
    const unsub2 = user?.uid ? subscribeUserReports(user.uid, setMyReports) : () => {};
    return () => {
      unsub1();
      unsub2();
    };
  }, [user?.uid]);

  function handleDetectGps() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLon(pos.coords.longitude.toFixed(5));
      },
      () => setError('Could not obtain GPS coordinates.')
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (description.trim().length < 15) {
      setError('Please enter a detailed description (at least 15 characters).');
      return;
    }

    // Simple client-side anti-spam cooldown check (1 report per minute)
    const lastReportMs = myReports[0]?.createdAt?.toMillis ? myReports[0].createdAt.toMillis() : 0;
    if (Date.now() - lastReportMs < 60_000) {
      setError('Please wait at least 1 minute between pollution report submissions.');
      return;
    }

    setSubmitting(true);
    try {
      let imageData = { imageUrl: '', imagePath: '' };
      if (imageFile) {
        try {
          imageData = await uploadReportImage(user.uid, imageFile);
        } catch (uploadErr) {
          throw new Error(
            uploadErr?.code === 'storage/unauthorized' || uploadErr?.code === 'storage/unknown'
              ? 'Image upload failed (Firebase Storage may not be enabled on this project yet). Clear the photo and submit without an image, or enable Storage in Firebase Console.'
              : uploadErr.message || 'Image upload failed.'
          );
        }
      }

      const coords =
        lat && lon && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lon))
          ? { lat: Number(lat), lon: Number(lon) }
          : null;

      await createPollutionReport({
        userId: user.uid,
        reporterName: userProfile?.displayName || user.displayName || 'Citizen',
        locationName,
        category,
        description,
        reportedAt: new Date(reportedAt).toISOString(),
        coordinates: coords,
        imageUrl: imageData.imageUrl,
        imagePath: imageData.imagePath,
      });

      setDescription('');
      setImageFile(null);
      setSuccess('Report submitted for moderation review! Track its status in "My Reports".');
      setActiveTab('mine');
    } catch (err) {
      setError(err.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  }

  const displayedReports = activeTab === 'community' ? verifiedReports : myReports;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Citizen Pollution Reporting</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Report visible local pollution incidents. Community submissions are moderated and kept separate from verified
          monitoring sensors.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Submission Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4 self-start"
        >
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900">Submit a Pollution Report</h2>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Street / Area</label>
            <input
              type="text"
              required
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g., Brodipet Main Road, Guntur"
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pollution Type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                required
                value={reportedAt}
                onChange={(e) => setReportedAt(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              required
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you observed, smoke intensity, or nearby landmarks..."
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Optional GPS Coordinates</label>
              <button
                type="button"
                onClick={handleDetectGps}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <Navigation className="w-3 h-3" />
                Use Current GPS
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Latitude"
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
              <input
                type="text"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="Longitude"
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Optional Evidence Photo (max 5MB)</label>
            <label className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
              <Camera className="w-4 h-4 text-emerald-600" />
              <span className="truncate">{imageFile ? imageFile.name : 'Choose PNG, JPG, or WebP image...'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Report
          </button>
        </form>

        {/* Reports Feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200/80 p-2">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('community')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'community' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Verified Community Reports ({verifiedReports.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mine')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'mine' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                My Reports ({myReports.length})
              </button>
            </div>
          </div>

          {displayedReports.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-sm text-slate-500">
              {activeTab === 'community'
                ? 'No verified citizen reports yet. Reports appear here once approved by an administrator.'
                : 'You have not submitted any pollution reports yet.'}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedReports.map((rep) => (
                <div key={rep.id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        Citizen Report
                      </span>
                      <span className="text-xs font-bold text-slate-900">{rep.category}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${
                        STATUS_STYLES[rep.status] || STATUS_STYLES.pending
                      }`}
                    >
                      {rep.status}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-800 mt-2">{rep.locationName}</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{rep.description}</p>

                  {rep.imageUrl && (
                    <img
                      src={rep.imageUrl}
                      alt={rep.category}
                      className="mt-3 rounded-xl max-h-52 w-full object-cover border border-slate-200"
                    />
                  )}

                  {rep.moderationNote && (
                    <p className="mt-2.5 text-[11px] bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Moderator note: {rep.moderationNote}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Reported by {rep.reporterName || 'Citizen'}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(rep.reportedAt || rep.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
