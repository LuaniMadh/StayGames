import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, Flag, MessageSquare, Trash2, Undo2 } from 'lucide-react';
import { getGameBySlug, getSessionDisplayName } from '../../../shared/games/index';
import type { GameSession, QuickResultEntry, StandingEntry } from '../../../shared/types';
import { api } from '../api/client';
import { Avatar } from '../components/Avatar';
import { GameBadge } from '../components/GameIcon';
import { QuickResultForm } from '../components/scorecards/QuickResultForm';
import { ScorecardHost } from '../components/scorecards/ScorecardHost';
import { formatDate } from '../components/SessionCard';
import { useGames } from '../context/GamesContext';

export function ActiveSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { bySlug } = useGames();
  const [session, setSession] = useState<GameSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  const load = useCallback(() => {
    api
      .getSession(Number(id))
      .then((r) => {
        setSession(r.session);
        setNotesDraft(r.session.notes ?? '');
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  const game = session ? bySlug[session.gameSlug] : undefined;
  const engine = session ? getGameBySlug(session.gameSlug) : undefined;
  const players = useMemo(
    () => (session ? [...session.participants].sort((a, b) => a.seatOrder - b.seatOrder) : []),
    [session]
  );
  const playerIds = players.map((p) => p.playerId);

  // Live standings computed client-side with the same shared engine as the server,
  // falling back to server-computed standings
  const standings: StandingEntry[] = useMemo(() => {
    if (!session) return [];
    if (engine) {
      try {
        return engine.computeStandings(session.state, playerIds, session.config, session.mode);
      } catch {
        // Fallback to server-computed standings
      }
    }
    return session.standings ?? [];
  }, [session, engine, playerIds]);

  const isComplete =
    session && engine
      ? engine.isGameComplete(session.state, playerIds, session.config, session.mode)
      : Boolean(session?.isComplete);

  const run = async (fn: () => Promise<{ session: GameSession }>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      setSession(r.session);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (error && !session) return <div className="rounded-xl bg-rose-500/15 p-3 text-rose-300">{error}</div>;
  if (!session || !game) return <div className="text-slate-400">Loading…</div>;

  const live = session.status === 'in_progress';
  const hasRounds = Array.isArray(session.state?.rounds) && session.state.rounds.length > 0;
  const byId = new Map(players.map((p) => [p.playerId, p]));

  const finish = () => {
    if (!isComplete && !confirm('The game has not reached its end condition yet. Finish now with the current standings?')) return;
    run(() => api.completeSession(session.id));
  };

  const remove = async () => {
    if (!confirm('Delete this game permanently?')) return;
    await api.deleteSession(session.id);
    navigate('/');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/" className="text-slate-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <GameBadge game={game} />
        <div className="flex-1">
          <h1 className="text-xl font-black md:text-2xl">
            {getSessionDisplayName(session.gameSlug, session.config)}
          </h1>
          <div className="text-xs text-slate-500">
            {session.mode === 'quick' ? 'Quick result' : 'Scorecard'} · started {formatDate(session.startedAt)}
            {session.completedAt && <> · finished {formatDate(session.completedAt)}</>}
          </div>
        </div>
        {live && session.mode === 'scorecard' && (
          <>
            <button className="btn-secondary" disabled={busy || !hasRounds} onClick={() => run(() => api.undoRound(session.id))}>
              <Undo2 size={16} /> Undo
            </button>
            <button className={isComplete ? 'btn-primary' : 'btn-secondary'} disabled={busy || !hasRounds} onClick={finish}>
              <Flag size={16} /> Finish
            </button>
          </>
        )}
        <button className="btn-secondary text-rose-300" onClick={remove} title="Delete game">
          <Trash2 size={16} />
        </button>
      </div>

      {error && <div className="rounded-xl bg-rose-500/15 p-3 text-rose-300">{error}</div>}

      {live && isComplete && session.mode === 'scorecard' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-200">
          <span>🎉 End condition reached! Finish the game to record the results.</span>
          <button className="btn-primary" disabled={busy} onClick={finish}>
            <Flag size={16} /> Finish & save
          </button>
        </div>
      )}

      {/* Standings */}
      {(session.mode === 'scorecard' || !live) && (
        <div className="card">
          <div className="label">
            {game?.cooperative || game?.gameType === 'cooperative'
              ? (live ? 'Team Status & Standings' : 'Final Team Outcome')
              : (live ? 'Current standings' : 'Final standings')}
          </div>
          {(game?.cooperative || game?.gameType === 'cooperative') && standings[0] ? (
            <div className="mb-3 rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Crown size={20} className={standings[0].isWinner ? 'text-amber-400' : 'text-slate-400'} />
                <div>
                  <div className="text-sm font-bold text-white">
                    Shared Team Result: {standings[0].scoreFormatted}
                  </div>
                  {standings[0].secondaryBadge && (
                    <div className="text-xs text-indigo-300 font-medium">
                      {standings[0].secondaryBadge}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-400">
                All {players.length} teammates share this outcome
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {standings.map((s) => {
              const p = byId.get(s.playerId);
              if (!p) return null;
              const isCoop = Boolean(game?.cooperative || game?.gameType === 'cooperative');
              const winner = !live && s.isWinner;
              return (
                <div
                  key={s.playerId}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                    winner ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : s.rank === 1 ? 'bg-slate-800 ring-1 ring-slate-600' : 'bg-slate-800/60'
                  }`}
                >
                  <span className="w-5 text-center font-black text-slate-400">
                    {winner && !isCoop ? <Crown size={16} className="text-amber-300" /> : isCoop ? '🤝' : s.rank}
                  </span>
                  <Avatar name={p.displayName} color={p.avatarColor} />
                  <div>
                    <div className="text-sm font-semibold">{p.displayName}</div>
                    <div className="text-xs text-slate-400">
                      {s.scoreFormatted}
                      {s.secondaryBadge && !isCoop && <> · {s.secondaryBadge}</>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {session.notes && <p className="mt-3 text-sm italic text-slate-400">“{session.notes}”</p>}
        </div>
      )}

      {/* Main body */}
      {session.mode === 'quick' ? (
        live && (
          <QuickResultForm
            game={game}
            players={players}
            busy={busy}
            onSubmit={(placements: QuickResultEntry[], notes: string) =>
              run(() => api.completeSession(session.id, { quickPlacements: placements, notes }))
            }
          />
        )
      ) : (
        <ScorecardHost
          session={session}
          state={session.state}
          players={players}
          readOnly={!live}
          busy={busy}
          onSubmitRound={(input) => run(() => api.addRound(session.id, input))}
          onEditRound={(roundNumber, input) => run(() => api.editRound(session.id, roundNumber, input))}
        />
      )}

      {/* Feedback #10: Notes section for any game */}
      <div className="card space-y-2 border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
            <MessageSquare size={16} /> Table Notes & Funny Moments
          </div>
          {!editingNotes && (
            <button
              className="text-xs text-indigo-300 hover:underline"
              onClick={() => {
                setNotesDraft(session.notes ?? '');
                setEditingNotes(true);
              }}
            >
              {session.notes ? 'Edit notes' : '+ Add note'}
            </button>
          )}
        </div>

        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              className="input w-full"
              rows={3}
              placeholder="Record funny quotes, memorable blunders, or table context…"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary px-3 py-1 text-xs"
                disabled={busy}
                onClick={() => setEditingNotes(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary px-3 py-1 text-xs"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(() => api.updateNotes(session.id, notesDraft));
                  if (ok) setEditingNotes(false);
                }}
              >
                Save Note
              </button>
            </div>
          </div>
        ) : session.notes ? (
          <p className="rounded-xl bg-slate-950/60 p-3 text-sm text-slate-300 italic border border-slate-800/80">
            “{session.notes}”
          </p>
        ) : (
          <p className="text-xs text-slate-500 italic">
            No notes added yet. Keep track of funny things that happened during this session!
          </p>
        )}
      </div>

      {/* Rules */}
      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">Rules reminder</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
          {game.rulesSummary.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
