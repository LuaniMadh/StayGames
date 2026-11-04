import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './context/AuthContext';
import { GamesProvider } from './context/GamesContext';
import { ActiveSessionPage } from './pages/ActiveSessionPage';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { LeaderboardsPage } from './pages/LeaderboardsPage';
import { LoginPage } from './pages/LoginPage';
import { NewGamePage } from './pages/NewGamePage';
import { PlayersPage } from './pages/PlayersPage';
import { PluginsPage } from './pages/PluginsPage';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <GamesProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="new" element={<NewGamePage />} />
          <Route path="sessions/:id" element={<ActiveSessionPage />} />
          <Route path="leaderboards" element={<LeaderboardsPage />} />
          <Route path="leaderboards/:slug" element={<LeaderboardsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="plugins" element={<PluginsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </GamesProvider>
  );
}
