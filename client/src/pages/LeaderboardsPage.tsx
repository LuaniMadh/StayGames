import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import type {
  GameLeaderboardResponse,
  LeaderboardColumnDef,
  OverallLeaderboardRow,
} from '../../../shared/types';
import { api } from '../api/client';
import { Avatar } from '../components/Avatar';
import { GameBadge } from '../components/GameIcon';
import { useGames } from '../context/GamesContext';

function formatMetric(v: number | null | undefined, col: LeaderboardColumnDef): string {
  if (v === null || v === undefined) return '–';
  if (col.format === 'percent') return `${v}%`;
  if (col.format === 'decimal') return v.toFixed(1);
  return String(Math.round(v));
}

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span>🥇</span>;
  if (rank === 2) return <span>🥈</span>;
  if (rank === 3) return <span>🥉</span>;
  return <span className="text-slate-500">{rank}</span>;
}

export function LeaderboardsPage() {
  const { slug } = useParams();
  const { games, bySlug } = useGames();
  const [overall, setOverall] = useState<{ totalCompletedSessions: number; rows: OverallLeaderboardRow[] } | null>(null);
  const [perGame, setPerGame] = useState<GameLeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (slug) {
      setPerGame(null);
      api.gameLeaderboard(slug).then(setPerGame).catch((e) => setError(e.message));
    } else {
      setOverall(null);
      api.overallLeaderboard().then(setOverall).catch((e) => setError(e.message));
    }
  }, [slug]);

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium ${
      isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
    }`;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Leaderboards</h1>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <NavLink to="/leaderboards" end className={tabClass}>
          🌍 Overall
        </NavLink>
        {games.map((g) => (
          <NavLink key={g.slug} to={`/leaderboards/${g.slug}`} className={tabClass}>
            {g.name}
          </NavLink>
        ))}
      </div>

      {error && <div className="rounded-xl bg-rose-500/15 p-3 text-rose-300">{error}</div>}

      {!slug && overall && (
        <div className="card overflow-x-auto p-0">
          <div className="p-4 text-sm text-slate-400">{overall.totalCompletedSessions} games completed across all titles</div>
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="bg-slate-900 text-xs text-slate-500">
                <th className="table-cell w-10">#</th>
                <th className="table-cell text-left">Player</th>
                <th className="table-cell text-right">Played</th>
                <th className="table-cell text-right">Wins</th>
                <th className="table-cell text-right">Win %</th>
                <th className="table-cell text-right">Podiums</th>
                <th className="table-cell text-left">Favourite</th>
              </tr>
            </thead>
            <tbody>
              {overall.rows.map((r) => (
                <tr key={r.playerId}>
                  <td className="table-cell text-center"><Medal rank={r.rank} /></td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.displayName} color={r.avatarColor} />
                      {r.displayName}
                      {r.isGuest && <span className="text-[10px] text-slate-500">guest</span>}
                    </div>
                  </td>
                  <td className="table-cell text-right">{r.gamesPlayed}</td>
                  <td className="table-cell text-right font-bold text-amber-300">{r.wins}</td>
                  <td className="table-cell text-right">{r.winRate}%</td>
                  <td className="table-cell text-right">{r.podiums}</td>
                  <td className="table-cell text-slate-400">{r.favoriteGameSlug ? bySlug[r.favoriteGameSlug]?.name ?? r.favoriteGameSlug : '–'}</td>
                </tr>
              ))}
              {overall.rows.length === 0 && (
                <tr><td colSpan={7} className="table-cell text-center text-slate-500">No completed games yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {slug && perGame && (
        <div className="card overflow-x-auto p-0">
          <div className="flex items-center gap-3 p-4">
            <GameBadge game={perGame.game} />
            <div>
              <div className="font-bold">{perGame.game.name}</div>
              <div className="text-sm text-slate-400">{perGame.totalSessions} games completed</div>
            </div>
          </div>
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="bg-slate-900 text-xs text-slate-500">
                <th className="table-cell w-10">#</th>
                <th className="table-cell text-left">Player</th>
                <th className="table-cell text-right">Played</th>
                <th className="table-cell text-right">Wins</th>
                <th className="table-cell text-right">Win %</th>
                <th className="table-cell text-right">Avg place</th>
                <th className="table-cell text-right" title={perGame.game.scoringDirection === 'lowest_wins' ? 'Lowest score' : 'Highest score'}>Best score</th>
                <th className="table-cell text-right">Avg score</th>
                {perGame.game.leaderboardColumns.map((c) => (
                  <th key={c.key} className="table-cell text-right" title={c.tooltip}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perGame.rows.map((r) => (
                <tr key={r.playerId}>
                  <td className="table-cell text-center"><Medal rank={r.rank} /></td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.displayName} color={r.avatarColor} />
                      {r.displayName}
                    </div>
                  </td>
                  <td className="table-cell text-right">{r.gamesPlayed}</td>
                  <td className="table-cell text-right font-bold text-amber-300">{r.wins}</td>
                  <td className="table-cell text-right">{r.winRate}%</td>
                  <td className="table-cell text-right">{r.avgPlacement || '–'}</td>
                  <td className="table-cell text-right">{r.bestScore ?? '–'}</td>
                  <td className="table-cell text-right">{r.avgScore ?? '–'}</td>
                  {perGame.game.leaderboardColumns.map((c) => (
                    <td key={c.key} className="table-cell text-right">{formatMetric(r.customMetrics[c.key], c)}</td>
                  ))}
                </tr>
              ))}
              {perGame.rows.length === 0 && (
                <tr>
                  <td colSpan={8 + perGame.game.leaderboardColumns.length} className="table-cell text-center text-slate-500">
                    No completed {perGame.game.name} games yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
