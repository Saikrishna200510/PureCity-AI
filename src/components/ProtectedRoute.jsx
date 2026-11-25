import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert, Wrench } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading, isAdmin, isFirebaseConfigured } = useAuth();
  const location = useLocation();

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-amber-200 shadow-sm p-6">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <Wrench className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Firebase Configuration Required</h1>
          <p className="text-sm text-slate-600 mt-2">
            To enable authentication, Firestore database, and cloud features, copy{' '}
            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">.env.example</code> to{' '}
            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">.env</code> and fill in your Firebase Web App credentials.
          </p>
          <a
            href="/"
            className="inline-block mt-4 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm text-slate-500 font-medium">Loading PureCity AI session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 shadow-xs p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Administrator Access Required</h2>
          <p className="text-sm text-slate-600 mt-1.5">
            Your account does not have administrator privileges. Admin roles can only be granted by an existing administrator or via the server-side Firebase Admin CLI.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
