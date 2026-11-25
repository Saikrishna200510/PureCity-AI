import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Wind,
  MapPin,
  BarChart3,
  Bot,
  Megaphone,
  Bell,
  UserCog,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext } from '../contexts/LocationContext';
import { subscribeUserAlerts } from '../services/firestoreService';

export default function DashboardLayout() {
  const { user, userProfile, isAdmin, logout } = useAuth();
  const { selectedCity, aqiStandard, setAqiStandard } = useLocationContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeUserAlerts(user.uid, (alerts) => {
      const unread = alerts.reduce((acc, a) => {
        const hist = Array.isArray(a.history) ? a.history : [];
        return acc + hist.filter((h) => !h.read).length;
      }, 0);
      setUnreadAlerts(unread);
    });
    return () => unsub();
  }, [user?.uid]);

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/monitoring', label: 'Air Monitoring', icon: Wind },
    { to: '/map', label: 'Pollution Map', icon: MapPin },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/assistant', label: 'AI Assistant', icon: Bot },
    { to: '/reports', label: 'Citizen Reports', icon: Megaphone },
    { to: '/alerts', label: 'Alerts', icon: Bell, badge: unreadAlerts },
    { to: '/profile', label: 'Profile & Settings', icon: UserCog },
  ];

  if (isAdmin) {
    navItems.push({ to: '/admin', label: 'Admin Console', icon: ShieldCheck });
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <Link to="/">
          <BrandLogo size="md" showTagline tagline="Urban Air Intelligence" />
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/70'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </span>
              {item.badge > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-500 text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-100">
        <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/60 mb-2">
          <p className="text-xs font-semibold text-slate-800 truncate">
            {userProfile?.displayName || user?.displayName || 'Citizen User'}
          </p>
          <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f6f9f7] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-slate-800 truncate">{selectedCity?.name}</span>
              {selectedCity?.state && (
                <span className="hidden sm:inline text-slate-400 truncate">• {selectedCity.state}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setAqiStandard('US')}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                  aqiStandard === 'US' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                US AQI
              </button>
              <button
                type="button"
                onClick={() => setAqiStandard('IN')}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                  aqiStandard === 'IN' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                Indian AQI
              </button>
            </div>

            <Link
              to="/alerts"
              className="relative p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
              aria-label="View alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadAlerts > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadAlerts}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200/70 bg-white/70 px-6 py-3 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            <strong className="text-slate-700">PureCity AI</strong> — Cleaner Cities. Smarter Air. Healthier Lives.
          </span>
          <span>Hack2Skill Urban Air Quality Assistant</span>
        </footer>
      </div>
    </div>
  );
}
