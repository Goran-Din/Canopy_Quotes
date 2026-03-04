import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, FileText, Users, BookOpen, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';

export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const isOwner = user?.role === 'owner' || user?.role === 'n37_super_admin';
  const isCoordinator = user?.role === 'coordinator';

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    navigate('/login', { replace: true });
  };

  const navLink = (to: string, label: string, Icon: React.ComponentType<{ className?: string }>) => {
    const active = location.pathname === to || (to === '/' && location.pathname === '/');
    return (
      <Link
        to={to}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </Link>
    );
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-6 sticky top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-blue-700 flex items-center justify-center">
          <FileText className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-gray-900 text-sm">Canopy Quotes</span>
      </div>

      {/* Nav links */}
      <nav className="flex items-center gap-1">
        {navLink('/', 'Dashboard', FileText)}
        {navLink('/customers', 'Customers', Users)}
        {isOwner && navLink('/catalog', 'Catalog', BookOpen)}
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        {user && (
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-none">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-xs text-gray-500 capitalize mt-0.5">{user.role.replace('_', ' ')}</p>
          </div>
        )}
        {!isCoordinator && (
          <Link
            to="/quotes/new"
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hidden sm:flex items-center gap-1"
          >
            + New Quote
          </Link>
        )}
        <Link
          to="/settings"
          className={`p-2 rounded-lg transition-colors ${
            location.pathname === '/settings'
              ? 'text-blue-700 bg-blue-50'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </Link>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
