import { useState } from 'react';
import { Check } from 'lucide-react';
import type { ThatsNotAHatState } from '../../../../shared/games/thatsNotAHat';
import { PlayerHeader, ScorecardProps } from './common';

export function ThatsNotAHatScorecard({ session, state, players, readOnly, busy, onSubmitRound }: ScorecardProps<ThatsNotAHatState>) {
  const limit: number = session.config.penaltyLimit ?? 3;
  const [note, setNote] = useState('');

  // One tap = one penalty card for that player (the most common case)
  const givePenalty = async (pid: number) => {
    const ok = await onSubmitRound({ penaltiesAdded: { [pid]: 1 }, note });
    if (ok) setNote('');
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => {
          const pen = state.penalties[p.playerId] ?? 0;
          return (
            <div key={p.playerId} className="card flex items-center gap-3">
              <PlayerHeader p={p} />
              <div className="flex-1">
                <div className="flex gap-1">
                  {Array.from({ length: limit }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-8 w-6 rounded-md border ${
                        i < pen ? 'border-amber-400 bg-amber-500/80' : 'border-slate-700 bg-slate-800'
                      }`}
                      title="Penalty card"
                    />
                  ))}
                  {pen > limit && <span className="self-center text-xs text-amber-300">+{pen - limit}</span>}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {pen} / {limit} penalty card{limit === 1 ? '' : 's'}
                </div>
              </div>
              {!readOnly && (
                <button
                  className="btn bg-amber-500/20 px-3 text-amber-200 hover:bg-amber-500/30"
                  disabled={busy}
                  onClick={() => givePenalty(p.playerId)}
                  title="Give penalty card"
                >
                  +1
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="card flex flex-wrap items-center gap-2">
          <input
            className="input flex-1"
            placeholder="Optional note for next penalty (e.g. “Swore the fish was a hat”)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Check size={12} /> Tap +1 on the player who loses the exchange
          </span>
        </div>
      )}

      {state.rounds.length > 0 && (
        <div className="card">
          <div className="mb-2 text-sm font-semibold text-slate-300">Penalty log</div>
          <ol className="space-y-1 text-sm">
            {[...state.rounds].reverse().map((r) => {
              const who = r.entries.filter((e) => e.penaltiesAdded > 0);
              return (
                <li key={r.roundNumber} className="flex gap-2">
                  <span className="w-6 text-slate-500">#{r.roundNumber}</span>
                  <span>
                    {who
                      .map((e) => `${players.find((p) => p.playerId === e.playerId)?.displayName ?? '?'} +${e.penaltiesAdded}`)
                      .join(', ')}
                  </span>
                  {r.note && <span className="italic text-slate-500">“{r.note}”</span>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
