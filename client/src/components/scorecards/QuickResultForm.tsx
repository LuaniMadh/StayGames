import { useState } from 'react';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import type { GameMetadata, QuickResultEntry, SessionParticipant } from '../../../../shared/types';
import { Avatar } from '../Avatar';

/**
 * Generic quick-log form: order players by finishing position, mark ties,
 * optionally enter final scores.
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
  const [order, setOrder] = useState<number[]>(players.map((p) => p.playerId));
  // tiedWithPrev[i] = true means player at index i shares the placement of index i-1
  const [tiedWithPrev, setTiedWithPrev] = useState<boolean[]>(players.map(() => false));
  const [scores, setScores] = useState<Record<number, string>>({});
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
    const entries: QuickResultEntry[] = order.map((pid, i) => ({
      playerId: pid,
      placement: placements[i],
      score: scores[pid] !== undefined && scores[pid] !== '' ? Number(scores[pid]) : null,
    }));
    onSubmit(entries, notes);
  };

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
