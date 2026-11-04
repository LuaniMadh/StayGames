import { History, Home, LogOut, PlusCircle, Puzzle, Trophy, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/new', label: 'New Game', icon: PlusCircle, end: false },
  { to: '/leaderboards', label: 'Leaderboards', icon: Trophy, end: false },
  { to: '/history', label: 'History', icon: History, end: false },
  { to: '/players', label: 'Players', icon: Users, end: false },
  { to: '/plugins', label: 'Plugins', icon: Puzzle, end: false },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60 p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2 text-xl font-black tracking-tight">
          <span className="text-2xl">🎲</span> StayGames
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-500/20 text-indigo-200'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 p-2">
            <Avatar name={user.displayName} color={user.avatarColor} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{user.displayName}</div>
              <div className="truncate text-xs text-slate-500">@{user.username}</div>
            </div>
            <button className="text-slate-400 hover:text-rose-400" onClick={logout} title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2 text-lg font-black">
          <span>🎲</span> StayGames
        </div>
        {user && (
          <button onClick={logout} className="flex items-center gap-2 text-sm text-slate-400" title="Sign out">
            <Avatar name={user.displayName} color={user.avatarColor} size={28} />
            <LogOut size={16} />
          </button>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-24 pt-4 md:px-8 md:pb-10 md:pt-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-slate-800 bg-slate-950/95 backdrop-blur md:hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                isActive ? 'text-indigo-300' : 'text-slate-500'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
