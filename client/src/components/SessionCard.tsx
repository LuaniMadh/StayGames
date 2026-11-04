import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import type { GameSession } from '../../../shared/types';
import { getSessionDisplayName } from '../../../shared/games/index';
import { useGames } from '../context/GamesContext';
import { Avatar } from './Avatar';
import { GameBadge } from './GameIcon';

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function SessionCard({ session }: { session: GameSession }) {
  const { bySlug } = useGames();
  const game = bySlug[session.gameSlug];
  const title = getSessionDisplayName(session.gameSlug, session.config);
  const participants = [...session.participants].sort((a, b) =>
    session.status === 'completed'
      ? (a.placement ?? 99) - (b.placement ?? 99)
      : a.seatOrder - b.seatOrder
  );

  return (
    <Link
      to={`/sessions/${session.id}`}
      className="card block transition hover:border-slate-600"
    >
      <div className="flex items-center gap-3">
        {game && <GameBadge game={game} size="sm" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{title}</span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-400">
              {session.mode === 'quick' ? 'Quick' : 'Scorecard'}
            </span>
            {session.status === 'in_progress' && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase text-emerald-300">
                Live
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {formatDate(session.completedAt ?? session.startedAt)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {participants.map((p) => (
          <span
            key={p.playerId}
            className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs ${
              p.isWinner ? 'bg-amber-500/20 text-amber-200' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {p.isWinner && <Crown size={12} />}
            <Avatar name={p.displayName} color={p.avatarColor} size={18} />
            {p.displayName}
            {session.status === 'completed' && p.finalScore !== null && session.mode === 'scorecard' && (
              <span className="text-slate-500">· {p.finalScore}</span>
            )}
          </span>
        ))}
      </div>
    </Link>
  );
}
