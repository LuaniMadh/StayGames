import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Trophy } from 'lucide-react';
import type { GameSession, OverallLeaderboardRow } from '../../../shared/types';
import { api } from '../api/client';
import { Avatar } from '../components/Avatar';
import { GameBadge } from '../components/GameIcon';
import { SessionCard } from '../components/SessionCard';
import { useAuth } from '../context/AuthContext';
import { useGames } from '../context/GamesContext';

export function DashboardPage() {
  const { user } = useAuth();
  const { games } = useGames();
  const [live, setLive] = useState<GameSession[]>([]);
  const [recent, setRecent] = useState<GameSession[]>([]);
  const [top, setTop] = useState<OverallLeaderboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.listSessions({ status: 'in_progress', limit: 10 }),
      api.listSessions({ status: 'completed', limit: 6 }),
      api.overallLeaderboard(),
    ])
      .then(([l, r, lb]) => {
        setLive(l.sessions);
        setRecent(r.sessions);
        setTop(lb.rows.slice(0, 5));
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black md:text-3xl">Hey {user?.displayName.split(' ')[0]} 👋</h1>
          <p className="text-slate-400">Ready for game night?</p>
        </div>
        <Link to="/new" className="btn-primary">
          <PlusCircle size={18} /> New Game
        </Link>
      </div>

      {error && <div className="rounded-xl bg-rose-500/15 p-3 text-rose-300">{error}</div>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {games.map((g) => (
          <Link key={g.slug} to={`/new?game=${g.slug}`} className="card flex items-center gap-3 hover:border-slate-600">
            <GameBadge game={g} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{g.name}</div>
              <div className="text-xs text-slate-500">
                {g.minPlayers}–{g.maxPlayers} players
              </div>
            </div>
          </Link>
        ))}
      </section>

      {live.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Games in progress</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {live.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent plays</h2>
            <Link to="/history" className="text-sm text-indigo-300 hover:underline">All history</Link>
          </div>
          {recent.length === 0 ? (
            <div className="card text-slate-400">No games recorded yet. Start one!</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {recent.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Top players</h2>
            <Link to="/leaderboards" className="text-sm text-indigo-300 hover:underline">Leaderboards</Link>
          </div>
          <div className="card space-y-2">
            {top.length === 0 && <div className="text-slate-400">No results yet.</div>}
            {top.map((r) => (
              <div key={r.playerId} className="flex items-center gap-3">
                <span className="w-5 text-center font-bold text-slate-500">{r.rank}</span>
                <Avatar name={r.displayName} color={r.avatarColor} />
                <span className="flex-1 truncate">{r.displayName}</span>
                <span className="flex items-center gap-1 text-sm text-amber-300">
                  <Trophy size={14} /> {r.wins}
                </span>
                <span className="w-14 text-right text-xs text-slate-500">{r.winRate}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
