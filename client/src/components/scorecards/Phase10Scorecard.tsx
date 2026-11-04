import { useEffect, useState } from 'react';
import { BookOpen, Check, RotateCcw } from 'lucide-react';
import { PHASE_10_PHASES, type Phase10State } from '../../../../shared/games/phase10';
import { PlayerHeader, ScorecardProps } from './common';

interface EntryDraft {
  pointsAdded: number;
  completed: boolean;
  phaseNumber?: number;
}

const CARD_BUTTONS = [
  { label: '1–9', pts: 5 },
  { label: '10–12', pts: 10 },
  { label: 'Skip', pts: 15 },
  { label: 'Wild', pts: 25 },
];

export function Phase10Scorecard({ session, state, players, readOnly, busy, onSubmitRound }: ScorecardProps<Phase10State>) {
  const freeChoice = session.config.phaseOrder === 'free_choice';
  const [showGuide, setShowGuide] = useState(false);

  const blank = (): Record<number, EntryDraft> =>
    Object.fromEntries(players.map((p) => [p.playerId, { pointsAdded: 0, completed: false }]));
  const [drafts, setDrafts] = useState<Record<number, EntryDraft>>(blank);

  useEffect(() => setDrafts(blank()), [state.rounds.length]);

  const update = (pid: number, patch: Partial<EntryDraft>) =>
    setDrafts((d) => ({ ...d, [pid]: { ...d[pid], ...patch } }));

  const submit = () => onSubmitRound({ entries: drafts });

  return (
    <div className="space-y-4">
      {/* Progress overview */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="bg-slate-900">
              <th className="table-cell text-left text-xs text-slate-500">Player</th>
              {PHASE_10_PHASES.map((ph) => (
                <th key={ph.number} className="table-cell w-8 text-center text-xs text-slate-500" title={ph.requirement}>
                  {ph.number}
                </th>
              ))}
              <th className="table-cell text-right text-xs text-slate-500">Points</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const prog = state.players[p.playerId];
              return (
                <tr key={p.playerId}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <PlayerHeader p={p} />
                    </div>
                  </td>
                  {PHASE_10_PHASES.map((ph) => {
                    const done = prog?.completedPhases.includes(ph.number);
                    const current = !freeChoice && prog?.currentTargetPhase === ph.number;
                    return (
                      <td key={ph.number} className="table-cell text-center">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs ${
                            done
                              ? 'bg-emerald-500 text-white'
                              : current
                                ? 'border border-emerald-400 text-emerald-300'
                                : 'bg-slate-800 text-slate-600'
                          }`}
                        >
                          {done ? <Check size={14} /> : ph.number}
                        </span>
                      </td>
                    );
                  })}
                  <td className="table-cell text-right font-bold">{prog?.totalPoints ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button className="btn-secondary" onClick={() => setShowGuide((s) => !s)}>
        <BookOpen size={16} /> {showGuide ? 'Hide' : 'Show'} phase guide
      </button>
      {showGuide && (
        <div className="card grid gap-1 text-sm sm:grid-cols-2">
          {PHASE_10_PHASES.map((ph) => (
            <div key={ph.number} className="flex gap-2">
              <span className="w-6 font-bold text-emerald-300">{ph.number}</span>
              <span className="text-slate-300">{ph.requirement}</span>
            </div>
          ))}
        </div>
      )}

      {/* Round input */}
      {!readOnly && (
        <div className="card space-y-3">
          <div className="text-lg font-bold">Hand {state.rounds.length + 1}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {players.map((p) => {
              const prog = state.players[p.playerId];
              const d = drafts[p.playerId] ?? { pointsAdded: 0, completed: false };
              const target = prog?.currentTargetPhase ?? 1;
              const openPhases = PHASE_10_PHASES.filter((ph) => !prog?.completedPhases.includes(ph.number));
              const allDone = (prog?.completedPhases.length ?? 0) >= 10;
              return (
                <div key={p.playerId} className="space-y-2 rounded-xl bg-slate-800/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{p.displayName}</span>
                    <span className="text-xs text-slate-400">
                      {allDone ? 'All phases done' : freeChoice ? `${10 - openPhases.length}/10 done` : `On phase ${target}: ${PHASE_10_PHASES[target - 1]?.requirement}`}
                    </span>
                  </div>
                  {!allDone && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-emerald-500"
                          checked={d.completed}
                          disabled={busy}
                          onChange={(e) =>
                            update(p.playerId, {
                              completed: e.target.checked,
                              phaseNumber: freeChoice ? d.phaseNumber ?? openPhases[0]?.number : undefined,
                            })
                          }
                        />
                        Completed phase
                      </label>
                      {freeChoice && d.completed && (
                        <select
                          className="input w-auto py-1"
                          value={d.phaseNumber ?? openPhases[0]?.number}
                          onChange={(e) => update(p.playerId, { phaseNumber: Number(e.target.value) })}
                        >
                          {openPhases.map((ph) => (
                            <option key={ph.number} value={ph.number}>
                              Phase {ph.number}: {ph.requirement}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">Penalty</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={5}
                      className="num-input w-20"
                      value={d.pointsAdded}
                      disabled={busy}
                      onChange={(e) => update(p.playerId, { pointsAdded: Math.max(0, Number(e.target.value) || 0) })}
                    />
                    {CARD_BUTTONS.map((b) => (
                      <button
                        key={b.label}
                        type="button"
                        disabled={busy}
                        className="rounded-lg bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                        onClick={() => update(p.playerId, { pointsAdded: d.pointsAdded + b.pts })}
                        title={`+${b.pts}`}
                      >
                        {b.label} +{b.pts}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="text-slate-400 hover:text-white"
                      onClick={() => update(p.playerId, { pointsAdded: 0 })}
                      title="Reset"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={busy} onClick={submit}>
              <Check size={16} /> Save hand
            </button>
          </div>
        </div>
      )}

      {/* Hand history */}
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
                          {e?.completedPhase ? <span className="text-emerald-400">✓P{e.completedPhase} </span> : <span className="text-slate-600">– </span>}
                          <span className="text-slate-300">+{e?.pointsAdded ?? 0}</span>
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
