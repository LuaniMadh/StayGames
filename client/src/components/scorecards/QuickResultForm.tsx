import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import type { GameMetadata, QuickResultEntry, SessionParticipant } from '../../../../shared/types';
import { Avatar } from '../Avatar';

/**
 * Generic quick-log form:
 * - In competitive games: order players from winner to last place with optional individual scores.
 * - In cooperative games: record team victory/defeat and shared team score.
 */
export function QuickResultForm({
  game,
  players,
  busy,
  onSubmit,
}: {
  game: GameMetadata;
  players: SessionParticipant[];
  busy: boolean;
  onSubmit: (placements: QuickResultEntry[], notes: string) => void;
}) {
  const isCooperative = game.cooperative === true || game.gameType === 'cooperative';

  // State for competitive games
  const [order, setOrder] = useState<number[]>(players.map((p) => p.playerId));
  const [tiedWithPrev, setTiedWithPrev] = useState<boolean[]>(players.map(() => false));
  const [scores, setScores] = useState<Record<number, string>>({});

  // State for cooperative games
  const [coopOutcome, setCoopOutcome] = useState<'victory' | 'defeat'>('victory');
  const [teamScore, setTeamScore] = useState<string>('');

  const [notes, setNotes] = useState('');

  const byId = new Map(players.map((p) => [p.playerId, p]));

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    setOrder((o) => {
      const n = [...o];
      [n[idx], n[j]] = [n[j], n[idx]];
      return n;
    });
  };

  const placements: number[] = [];
  order.forEach((_, i) => {
    placements.push(i > 0 && tiedWithPrev[i] ? placements[i - 1] : i + 1);
  });

  const submit = () => {
    if (isCooperative) {
      const parsedScore = teamScore.trim() !== '' ? Number(teamScore) : null;
      const entries: QuickResultEntry[] = players.map((p) => ({
        playerId: p.playerId,
        placement: coopOutcome === 'victory' ? 1 : 2,
        score: parsedScore,
      }));
      onSubmit(entries, notes);
      return;
    }

    const entries: QuickResultEntry[] = order.map((pid, i) => ({
      playerId: pid,
      placement: placements[i],
      score: scores[pid] !== undefined && scores[pid] !== '' ? Number(scores[pid]) : null,
    }));
    onSubmit(entries, notes);
  };

  if (isCooperative) {
    return (
      <div className="card space-y-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold">
            <Users className="text-cyan-400" size={20} />
            Cooperative Team Result
          </div>
          <div className="text-sm text-slate-400">
            Record the outcome and team score. All teammates share this result in leaderboards and match history.
          </div>
        </div>

        {/* Team Members */}
        <div className="rounded-xl bg-slate-800/40 p-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Team Roster ({players.length} players)
          </div>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <div key={p.playerId} className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-2.5 py-1 text-sm font-medium">
                <Avatar name={p.displayName} color={p.avatarColor} size={22} />
                <span>{p.displayName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Team Outcome Toggle */}
        <div className="space-y-1.5">
          <label className="label">Team Outcome</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold transition-all ${
                coopOutcome === 'victory'
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-md shadow-emerald-500/10'
                  : 'border-slate-800 bg-slate-850 text-slate-400 hover:border-slate-700'
              }`}
              onClick={() => setCoopOutcome('victory')}
            >
              <ShieldCheck size={18} className="text-emerald-400" />
              <span>Team Victory / Clear 🏆</span>
            </button>
            <button
              type="button"
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold transition-all ${
                coopOutcome === 'defeat'
                  ? 'border-red-500 bg-red-500/15 text-red-300 shadow-md shadow-red-500/10'
                  : 'border-slate-800 bg-slate-850 text-slate-400 hover:border-slate-700'
              }`}
              onClick={() => setCoopOutcome('defeat')}
            >
              <ShieldAlert size={18} className="text-red-400" />
              <span>Team Defeat / Loss 💥</span>
            </button>
          </div>
        </div>

        {/* Team Score */}
        <div className="space-y-1.5">
          <label className="label">Team Final Score (Optional)</label>
          <input
            type="number"
            className="input w-full md:w-64"
            placeholder={game.slug === 'hanabi' ? 'e.g. 25 (fireworks points)' : 'Points achieved'}
            value={teamScore}
            onChange={(e) => setTeamScore(e.target.value)}
          />
        </div>

        {/* Notes */}
        <textarea
          className="input"
          rows={2}
          placeholder="Match notes (e.g. 'Flawless 25 points run', 'Bomb on round 12')"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex justify-end">
          <button className="btn-primary" disabled={busy} onClick={submit}>
            <Check size={16} /> Save Team Result
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <div>
        <div className="text-lg font-bold">Final results</div>
        <div className="text-sm text-slate-400">
          Order players from winner to last place. Scores are optional
          {game.scoringDirection === 'lowest_wins' ? ' (lower is better in this game)' : ''}.
        </div>
      </div>
      <ol className="space-y-2">
        {order.map((pid, i) => {
          const p = byId.get(pid)!;
          return (
            <li key={pid} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-800/50 p-2">
              <span className={`w-8 text-center text-lg font-black ${placements[i] === 1 ? 'text-amber-300' : 'text-slate-400'}`}>
                {placements[i] === 1 ? '🏆' : `#${placements[i]}`}
              </span>
              <Avatar name={p.displayName} color={p.avatarColor} />
              <span className="min-w-[6rem] flex-1 font-medium">{p.displayName}</span>
              {i > 0 && (
                <label className="flex items-center gap-1 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    className="accent-indigo-500"
                    checked={tiedWithPrev[i]}
                    onChange={(e) => setTiedWithPrev((t) => t.map((v, k) => (k === i ? e.target.checked : v)))}
                  />
                  tie
                </label>
              )}
              <input
                type="number"
                placeholder="score"
                className="num-input w-20"
                value={scores[pid] ?? ''}
                onChange={(e) => setScores((s) => ({ ...s, [pid]: e.target.value }))}
              />
              <button className="text-slate-400 hover:text-white disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={18} />
              </button>
              <button className="text-slate-400 hover:text-white disabled:opacity-30" disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown size={18} />
              </button>
            </li>
          );
        })}
      </ol>
      <textarea className="input" rows={2} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex justify-end">
        <button className="btn-primary" disabled={busy} onClick={submit}>
          <Check size={16} /> Save result
        </button>
      </div>
    </div>
  );
}
