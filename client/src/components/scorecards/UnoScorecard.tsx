import { useEffect, useState } from 'react';
import { Check, Crown, RotateCcw } from 'lucide-react';
import type { UnoState } from '../../../../shared/games/uno';
import { PlayerHeader, ScorecardProps, zeroMap } from './common';

const UNO_CARDS = [
  { label: '0–9', pts: 0, isNumber: true },
  { label: '+2', pts: 20 },
  { label: 'Reverse', pts: 20 },
  { label: 'Skip', pts: 20 },
  { label: 'Wild', pts: 50 },
  { label: 'Wild +4', pts: 50 },
];

export function UnoScorecard({ session, state, players, readOnly, busy, onSubmitRound }: ScorecardProps<UnoState>) {
  const target: number = session.config.targetScore ?? 500;
  const winnerCollects = session.config.scoringVariant !== 'penalty_lowest';
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [points, setPoints] = useState<Record<number, number>>(() => zeroMap(players));
  const [numberCard, setNumberCard] = useState<Record<number, string>>({});

  useEffect(() => {
    setWinnerId(null);
    setPoints(zeroMap(players));
  }, [state.rounds.length]);

  const losers = players.filter((p) => p.playerId !== winnerId);
  const winnerTotal = losers.reduce((s, p) => s + (points[p.playerId] ?? 0), 0);

  const add = (pid: number, n: number) => setPoints((pts) => ({ ...pts, [pid]: Math.max(0, (pts[pid] ?? 0) + n) }));

  const submit = () => {
    if (winnerId === null) return;
    const pointsByPlayer = winnerCollects ? { [winnerId]: winnerTotal } : { ...points, [winnerId]: 0 };
    onSubmitRound({ roundWinnerId: winnerId, pointsByPlayer });
  };

  return (
    <div className="space-y-4">
      {/* Totals with progress to target */}
      <div className="card space-y-2">
        {players.map((p) => {
          const total = state.totals[p.playerId] ?? 0;
          const pct = Math.min(100, (total / target) * 100);
          return (
            <div key={p.playerId} className="flex items-center gap-3">
              <div className="w-24 shrink-0"><PlayerHeader p={p} /></div>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full ${winnerCollects ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="w-20 text-right font-bold">
                {total} <span className="text-xs font-normal text-slate-500">/ {target}</span>
              </div>
            </div>
          );
        })}
        <p className="text-xs text-slate-500">
          {winnerCollects ? 'Hand winner scores the value of everyone else’s cards. Highest total wins once someone reaches the target.' : 'Each player adds the value of their own leftover cards. Lowest total wins once someone reaches the target.'}
        </p>
      </div>

      {!readOnly && (
        <div className="card space-y-3">
          <div className="text-lg font-bold">Hand {state.rounds.length + 1}</div>
          <div>
            <div className="label">Who went out?</div>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <button
                  key={p.playerId}
                  disabled={busy}
                  onClick={() => setWinnerId(p.playerId)}
                  className={winnerId === p.playerId ? 'btn bg-rose-500 text-white' : 'btn-secondary'}
                >
                  {winnerId === p.playerId && <Crown size={14} />} {p.displayName}
                </button>
              ))}
            </div>
          </div>

          {winnerId !== null && (
            <>
              <div className="label">Cards left in hand</div>
              <div className="grid gap-2 md:grid-cols-2">
                {losers.map((p) => (
                  <div key={p.playerId} className="space-y-2 rounded-xl bg-slate-800/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{p.displayName}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          className="num-input w-20"
                          value={points[p.playerId] ?? 0}
                          onChange={(e) => setPoints((pts) => ({ ...pts, [p.playerId]: Math.max(0, Number(e.target.value) || 0) }))}
                        />
                        <button className="text-slate-400 hover:text-white" onClick={() => setPoints((pts) => ({ ...pts, [p.playerId]: 0 }))}>
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={9}
                          placeholder="0–9"
                          className="num-input w-14 py-1 text-xs"
                          value={numberCard[p.playerId] ?? ''}
                          onChange={(e) => setNumberCard((n) => ({ ...n, [p.playerId]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              add(p.playerId, Math.min(9, Number(numberCard[p.playerId]) || 0));
                              setNumberCard((n) => ({ ...n, [p.playerId]: '' }));
                            }
                          }}
                        />
                        <button
                          className="rounded-lg bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                          onClick={() => {
                            add(p.playerId, Math.min(9, Number(numberCard[p.playerId]) || 0));
                            setNumberCard((n) => ({ ...n, [p.playerId]: '' }));
                          }}
                        >
                          + number
                        </button>
                      </div>
                      {UNO_CARDS.filter((c) => !c.isNumber).map((c) => (
                        <button
                          key={c.label}
                          className="rounded-lg bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                          onClick={() => add(p.playerId, c.pts)}
                        >
                          {c.label} +{c.pts}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-slate-400">
                  {winnerCollects ? (
                    <>
                      {players.find((p) => p.playerId === winnerId)?.displayName} scores <b className="text-rose-300">+{winnerTotal}</b>
                    </>
                  ) : (
                    <>Penalty points will be added to each player.</>
                  )}
                </div>
                <button className="btn-primary" disabled={busy} onClick={submit}>
                  <Check size={16} /> Save hand
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {state.rounds.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold text-slate-300">Hand history ({state.rounds.length})</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr>
                  <th className="table-cell text-left text-xs text-slate-500">Hand</th>
                  {players.map((p) => (
                    <th key={p.playerId} className="table-cell text-xs">{p.displayName.split(' ')[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.rounds.map((r) => (
                  <tr key={r.roundNumber}>
                    <td className="table-cell text-slate-400">{r.roundNumber}</td>
                    {players.map((p) => {
                      const e = r.entries.find((x) => x.playerId === p.playerId);
                      return (
                        <td key={p.playerId} className="table-cell text-center">
                          {r.roundWinnerId === p.playerId && '👑 '}
                          <span className="font-semibold">{e?.cumulativeScore ?? 0}</span>
                          {e && e.pointsAdded > 0 && <span className="text-xs text-slate-500"> (+{e.pointsAdded})</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
