import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Edit3, HelpCircle, LineChart, Trophy, Users, X } from 'lucide-react';
import type { ChartDef, ConfigField, ScoreboardColumnDef } from '../../../../shared/types';
import { useGames } from '../../context/GamesContext';
import { PlayerHeader, ScorecardProps, SplitScoreStepper, zeroMap } from './common';

function getDefaultCustomValues(fields: ConfigField[]): Record<string, any> {
  const vals: Record<string, any> = {};
  for (const f of fields) {
    if (f.default !== undefined) {
      vals[f.key] = f.default;
    } else if (f.type === 'boolean') {
      vals[f.key] = false;
    } else if (f.type === 'number') {
      vals[f.key] = f.min ?? 0;
    } else if (f.type === 'select' || f.type === 'radio') {
      const first = f.options?.[0];
      vals[f.key] = typeof first === 'object' && first !== null ? first.value : first || '';
    } else {
      vals[f.key] = '';
    }
  }
  return vals;
}

/**
 * Visual SVG progression chart for tracking history (hints, scores, tokens) over rounds.
 */
function ProgressionChart({
  chart,
  state,
  rounds,
}: {
  chart: ChartDef;
  state: any;
  rounds: any[];
}) {
  const rawData: number[] = useMemo(() => {
    if (Array.isArray(state?.[chart.dataKey])) {
      return state[chart.dataKey].map(Number);
    }
    return rounds.map((r) => {
      const v = r[chart.dataKey] ?? r.input?.[chart.dataKey] ?? r.teamScore ?? 0;
      return Number(v);
    });
  }, [state, chart.dataKey, rounds]);

  if (rawData.length === 0) return null;

  const w = 460;
  const h = 130;
  const padX = 28;
  const padY = 22;

  const minVal = chart.yAxisMin !== undefined ? chart.yAxisMin : Math.min(0, ...rawData);
  const maxVal = chart.yAxisMax !== undefined ? chart.yAxisMax : Math.max(1, ...rawData);
  const range = maxVal - minVal || 1;

  const points = rawData.map((val, idx) => {
    const x = padX + (idx / Math.max(1, rawData.length - 1)) * (w - 2 * padX);
    const y = h - padY - ((Math.min(maxVal, Math.max(minVal, val)) - minVal) / range) * (h - 2 * padY);
    return { x, y, val };
  });

  const pathD = points.reduce(
    (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
    ''
  );

  const fillD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${h - padY} L ${points[0].x.toFixed(1)} ${h - padY} Z`;
  const strokeColor = chart.color || '#38bdf8';
  const latest = rawData[rawData.length - 1];

  return (
    <div className="card border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
          <LineChart size={14} style={{ color: strokeColor }} />
          <span>{chart.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono">
            Range: {minVal}–{maxVal}
          </span>
          <span
            className="rounded-md px-2 py-0.5 text-xs font-bold font-mono"
            style={{ backgroundColor: `${strokeColor}22`, color: strokeColor }}
          >
            Current: {latest}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-slate-900/60 p-1">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id={`grad-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal guides */}
          <line
            x1={padX}
            y1={padY}
            x2={w - padX}
            y2={padY}
            stroke="#334155"
            strokeDasharray="3 3"
            strokeWidth="0.8"
          />
          <line
            x1={padX}
            y1={h / 2}
            x2={w - padX}
            y2={h / 2}
            stroke="#334155"
            strokeDasharray="3 3"
            strokeWidth="0.8"
          />
          <line
            x1={padX}
            y1={h - padY}
            x2={w - padX}
            y2={h - padY}
            stroke="#475569"
            strokeWidth="1"
          />

          {/* Guide labels */}
          <text x={padX - 4} y={padY + 4} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
            {maxVal}
          </text>
          <text x={padX - 4} y={h - padY + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
            {minVal}
          </text>

          {/* Area and Line */}
          <path d={fillD} fill={`url(#grad-${chart.key})`} />
          <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {points.map((pt, i) => (
            <g key={i}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={i === points.length - 1 ? '4' : '2.5'}
                fill={i === points.length - 1 ? strokeColor : '#0f172a'}
                stroke={strokeColor}
                strokeWidth="1.5"
              />
              {points.length <= 15 && (
                <text
                  x={pt.x}
                  y={pt.y - 6}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {pt.val}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function GenericPointsScorecard({
  session,
  state,
  players,
  readOnly,
  busy,
  onSubmitRound,
  onEditRound,
}: ScorecardProps<any>) {
  const { bySlug } = useGames();
  const game = bySlug[session.gameSlug];
  const isCooperative = Boolean(game?.cooperative || game?.gameType === 'cooperative');
  const customFields: ConfigField[] = game?.roundInputFields || game?.roundFields || [];
  const scoreboardColumns: ScoreboardColumnDef[] = game?.scoreboardColumns || game?.roundTableColumns || [];
  const charts: ChartDef[] = game?.charts || [];

  // Competitive points per player
  const [points, setPoints] = useState<Record<number, number>>(() => zeroMap(players));

  // Cooperative round points / team score
  const [teamScoreInput, setTeamScoreInput] = useState<number>(0);

  // Custom round-level input fields (clues, strikes, notes, action, etc.)
  const [customValues, setCustomValues] = useState<Record<string, any>>(() =>
    getDefaultCustomValues(customFields)
  );

  // Editing state
  const [editingRoundNumber, setEditingRoundNumber] = useState<number | null>(null);
  const [editPoints, setEditPoints] = useState<Record<number, number>>({});
  const [editTeamScore, setEditTeamScore] = useState<number>(0);
  const [editCustomValues, setEditCustomValues] = useState<Record<string, any>>({});

  // Option Label Lookup Map (resolves internal IDs like "give_clue" -> "Give Clue")
  const optionLabelMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const f of customFields) {
      if (f.options && Array.isArray(f.options)) {
        map[f.key] = {};
        for (const opt of f.options) {
          if (typeof opt === 'object' && opt !== null) {
            map[f.key][String(opt.value)] = opt.label;
          } else if (typeof opt === 'string') {
            map[f.key][opt] = opt;
          }
        }
      }
    }
    return map;
  }, [customFields]);

  const formatFieldValue = (fieldKey: string, val: any): string => {
    if (val === undefined || val === null) return '—';
    if (typeof val === 'boolean') return val ? '✓ Yes' : '—';
    const str = String(val);
    if (optionLabelMap[fieldKey] && optionLabelMap[fieldKey][str]) {
      return optionLabelMap[fieldKey][str];
    }
    return str;
  };

  useEffect(() => {
    setPoints(zeroMap(players));
    setTeamScoreInput(0);
    setCustomValues(getDefaultCustomValues(customFields));
  }, [state?.rounds?.length]);

  const startEdit = (r: any) => {
    setEditingRoundNumber(r.roundNumber);
    setEditPoints({ ...(r.points || {}) });
    setEditTeamScore(r.teamScore ?? r.score ?? 0);
    setEditCustomValues({ ...(r.input || r.custom || r) });
  };

  const saveEdit = async () => {
    if (!editingRoundNumber || !onEditRound) return;
    const payload = isCooperative
      ? {
          teamScore: editTeamScore,
          pointsByPlayer: Object.fromEntries(players.map((p) => [p.playerId, editTeamScore])),
          ...editCustomValues,
        }
      : {
          pointsByPlayer: editPoints,
          ...editCustomValues,
        };
    const ok = await onEditRound(editingRoundNumber, payload);
    if (ok) setEditingRoundNumber(null);
  };

  const handleSaveRound = () => {
    const payload = isCooperative
      ? {
          teamScore: teamScoreInput,
          pointsByPlayer: Object.fromEntries(players.map((p) => [p.playerId, teamScoreInput])),
          ...customValues,
        }
      : {
          pointsByPlayer: points,
          ...customValues,
        };
    onSubmitRound(payload);
  };

  const currentTeamTotal =
    state?.teamScore ??
    state?.score ??
    (state?.totals ? Object.values(state.totals as Record<number, number>).reduce((a, b) => a + b, 0) : 0);

  const roundsList: any[] = state?.rounds || [];

  return (
    <div className="space-y-4">
      {/* Sticky header */}
      {isCooperative ? (
        <div className="card sticky top-14 z-10 border-indigo-500/40 bg-slate-900/95 py-3 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-500/20 p-2.5 text-indigo-400">
                <Trophy size={24} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                  Cooperative Team Score
                </div>
                <div className="text-2xl font-black text-white">
                  {currentTeamTotal} pts
                </div>
              </div>
            </div>

            {/* Hanabi-specific or custom dynamic status counters if present on state */}
            <div className="flex flex-wrap items-center gap-2">
              {state?.clues !== undefined && (
                <div className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-200">
                  <HelpCircle size={14} /> Clues: {state.clues}/8
                </div>
              )}
              {state?.strikes !== undefined && (
                <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold ${
                  state.strikes >= 3
                    ? 'border-rose-500 bg-rose-500/30 text-rose-200 animate-pulse'
                    : 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                }`}>
                  <AlertTriangle size={14} /> Strikes: {state.strikes}/3
                </div>
              )}

              {/* Teammates avatars */}
              <div className="flex items-center -space-x-1 pl-2">
                {players.map((p) => (
                  <span
                    key={p.playerId}
                    title={p.displayName}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-900 text-[10px] font-bold text-white shadow"
                    style={{ backgroundColor: p.avatarColor }}
                  >
                    {p.displayName[0]?.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card sticky top-14 z-10 border-indigo-500/40 bg-slate-900/95 py-3 shadow-xl backdrop-blur">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Current Totals
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {players.map((p) => (
              <div
                key={p.playerId}
                className="flex items-center gap-2 rounded-xl bg-slate-950/80 px-2.5 py-1.5 border border-slate-800"
              >
                <span
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: p.avatarColor }}
                >
                  {p.displayName[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-slate-200">
                    {p.displayName}
                  </div>
                  <div className="text-sm font-black text-indigo-300">
                    {state?.totals?.[p.playerId] ?? 0} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Progression Charts */}
      {charts.length > 0 && roundsList.length > 0 && (
        <div className={`grid gap-3 ${charts.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
          {charts.map((chart) => (
            <ProgressionChart
              key={chart.key}
              chart={chart}
              state={state}
              rounds={roundsList}
            />
          ))}
        </div>
      )}

      {/* Score Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="bg-slate-900">
              <th className="table-cell text-left text-xs text-slate-500">Round</th>
              {scoreboardColumns.length > 0 ? (
                // Declarative custom scoreboard columns from manifest
                scoreboardColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`table-cell text-xs text-slate-300 ${
                      col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center'
                    }`}
                  >
                    {col.label}
                  </th>
                ))
              ) : isCooperative ? (
                <>
                  <th className="table-cell text-center text-xs text-slate-300">
                    Team Points
                  </th>
                  {customFields.map((f) => (
                    <th key={f.key} className="table-cell text-center text-xs text-slate-400">
                      {f.label}
                    </th>
                  ))}
                </>
              ) : (
                <>
                  {players.map((p) => (
                    <th key={p.playerId} className="table-cell">
                      <PlayerHeader p={p} />
                    </th>
                  ))}
                  {customFields.map((f) => (
                    <th key={f.key} className="table-cell text-center text-xs text-slate-400">
                      {f.label}
                    </th>
                  ))}
                </>
              )}
              {!readOnly && onEditRound && (
                <th className="table-cell w-16 text-center text-xs text-slate-500">Edit</th>
              )}
            </tr>
          </thead>
          <tbody>
            {roundsList.map((r) => (
              <tr key={r.roundNumber} className="hover:bg-slate-800/30">
                <td className="table-cell font-bold text-slate-400">Round {r.roundNumber}</td>
                {scoreboardColumns.length > 0 ? (
                  // Custom scoreboard columns rendering with option label resolution
                  scoreboardColumns.map((col) => {
                    const rawVal =
                      r[col.key] ??
                      r.input?.[col.key] ??
                      r.custom?.[col.key] ??
                      (col.key === 'teamScore' ? (r.teamScore ?? r.score ?? r.points?.[players[0]?.playerId]) : undefined);
                    const formatted = formatFieldValue(col.key, rawVal);
                    const alignClass =
                      col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center';

                    return (
                      <td key={col.key} className={`table-cell text-xs ${alignClass} font-medium text-slate-200`}>
                        {col.format === 'badge' ? (
                          <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                            {formatted}
                          </span>
                        ) : (
                          formatted
                        )}
                      </td>
                    );
                  })
                ) : isCooperative ? (
                  <>
                    <td className="table-cell text-center font-bold text-indigo-300">
                      {r.teamScore ?? r.points?.[players[0]?.playerId] ?? r.score ?? 0}
                    </td>
                    {customFields.map((f) => {
                      const val = r[f.key] ?? r.input?.[f.key] ?? r.custom?.[f.key];
                      return (
                        <td key={f.key} className="table-cell text-center text-xs text-slate-300">
                          {formatFieldValue(f.key, val)}
                        </td>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {players.map((p) => (
                      <td key={p.playerId} className="table-cell text-center font-semibold">
                        {r.points?.[p.playerId] ?? 0}
                      </td>
                    ))}
                    {customFields.map((f) => {
                      const val = r[f.key] ?? r.input?.[f.key] ?? r.custom?.[f.key];
                      return (
                        <td key={f.key} className="table-cell text-center text-xs text-slate-300">
                          {formatFieldValue(f.key, val)}
                        </td>
                      );
                    })}
                  </>
                )}
                {!readOnly && onEditRound && (
                  <td className="table-cell text-center">
                    <button
                      className="btn-secondary px-2 py-1 text-xs hover:border-indigo-400"
                      onClick={() => startEdit(r)}
                      title={`Edit Round ${r.roundNumber}`}
                    >
                      <Edit3 size={12} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            <tr className="bg-slate-900/90 font-bold border-t border-slate-700">
              <td className="table-cell">Total</td>
              {scoreboardColumns.length > 0 ? (
                scoreboardColumns.map((col) => (
                  <td
                    key={col.key}
                    className={`table-cell text-xs ${
                      col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center'
                    } text-indigo-300 font-bold`}
                  >
                    {col.key === 'teamScore' || col.key === 'score' ? currentTeamTotal : ''}
                  </td>
                ))
              ) : isCooperative ? (
                <>
                  <td className="table-cell text-center text-indigo-300 text-base">
                    {currentTeamTotal}
                  </td>
                  {customFields.map((f) => (
                    <td key={f.key} className="table-cell" />
                  ))}
                </>
              ) : (
                <>
                  {players.map((p) => (
                    <td key={p.playerId} className="table-cell text-center text-indigo-300 text-base">
                      {state?.totals?.[p.playerId] ?? 0}
                    </td>
                  ))}
                  {customFields.map((f) => (
                    <td key={f.key} className="table-cell" />
                  ))}
                </>
              )}
              {!readOnly && onEditRound && <td className="table-cell" />}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Edit round modal */}
      {editingRoundNumber && (
        <div className="card space-y-4 border-amber-500/50 bg-slate-900/95 ring-2 ring-amber-500/30">
          <div className="flex items-center justify-between">
            <div className="text-lg font-black text-amber-300">
              Editing Round {editingRoundNumber}
            </div>
            <button
              className="text-slate-400 hover:text-white"
              onClick={() => setEditingRoundNumber(null)}
            >
              <X size={20} />
            </button>
          </div>

          {isCooperative ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Team Points for Round {editingRoundNumber}
                </label>
                <div className="mt-1">
                  <SplitScoreStepper
                    value={editTeamScore}
                    min={-999}
                    max={9999}
                    disabled={busy}
                    onChange={(v) => setEditTeamScore(v)}
                    label="Team Points"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((p) => (
                <div key={p.playerId} className="space-y-1 rounded-xl bg-slate-950/70 p-3 border border-slate-800">
                  <div className="font-semibold text-slate-200">{p.displayName}</div>
                  <SplitScoreStepper
                    value={editPoints[p.playerId] ?? 0}
                    min={-999}
                    max={9999}
                    disabled={busy}
                    onChange={(v) => setEditPoints((s) => ({ ...s, [p.playerId]: v }))}
                    label="Points"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Edit custom fields */}
          {customFields.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 border-t border-slate-800 pt-3">
              {customFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">{field.label}</label>
                  {field.type === 'boolean' ? (
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 mt-1">
                      <input
                        type="checkbox"
                        checked={Boolean(editCustomValues[field.key])}
                        onChange={(e) =>
                          setEditCustomValues((s) => ({ ...s, [field.key]: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600"
                      />
                      <span>{field.description || field.label}</span>
                    </label>
                  ) : field.type === 'radio' || field.display === 'buttons' || field.widget === 'buttons' ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(field.options || []).map((opt) => {
                        const val = typeof opt === 'object' && opt !== null ? opt.value : opt;
                        const lbl = typeof opt === 'object' && opt !== null ? opt.label : opt;
                        const selected = (editCustomValues[field.key] ?? '') === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setEditCustomValues((s) => ({ ...s, [field.key]: val }))}
                            className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition border ${
                              selected
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow ring-2 ring-indigo-400/30'
                                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                            }`}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  ) : field.type === 'select' ? (
                    <select
                      value={editCustomValues[field.key] ?? ''}
                      onChange={(e) =>
                        setEditCustomValues((s) => ({ ...s, [field.key]: e.target.value }))
                      }
                      className="input w-full text-xs"
                    >
                      {(field.options || []).map((opt) => {
                        const val = typeof opt === 'object' && opt !== null ? opt.value : opt;
                        const lbl = typeof opt === 'object' && opt !== null ? opt.label : opt;
                        return (
                          <option key={val} value={val}>
                            {lbl}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={editCustomValues[field.key] ?? 0}
                      onChange={(e) =>
                        setEditCustomValues((s) => ({ ...s, [field.key]: Number(e.target.value) }))
                      }
                      className="input w-full text-xs"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
            <button className="btn-secondary" disabled={busy} onClick={() => setEditingRoundNumber(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy} onClick={saveEdit}>
              <Check size={16} /> Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Add Round Input Form */}
      {!readOnly && (
        <div className="card space-y-4 border-indigo-500/30">
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold flex items-center gap-2">
              <span>Round {roundsList.length + 1}</span>
              {isCooperative && (
                <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
                  Shared Team Input
                </span>
              )}
            </div>
          </div>

          {/* Custom round-level fields rendered FIRST if any (e.g. Turn Action buttons) */}
          {customFields.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {customFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {field.label}
                  </label>

                  {field.type === 'boolean' ? (
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-200 mt-1">
                      <input
                        type="checkbox"
                        checked={Boolean(customValues[field.key])}
                        onChange={(e) =>
                          setCustomValues((s) => ({ ...s, [field.key]: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{field.description || field.label}</span>
                    </label>
                  ) : field.type === 'radio' || field.display === 'buttons' || field.widget === 'buttons' ? (
                    // Button group / segmented control
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {(field.options || []).map((opt) => {
                        const val = typeof opt === 'object' && opt !== null ? opt.value : opt;
                        const lbl = typeof opt === 'object' && opt !== null ? opt.label : opt;
                        const selected = (customValues[field.key] ?? '') === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCustomValues((s) => ({ ...s, [field.key]: val }))}
                            className={`rounded-xl px-3 py-2 text-xs font-semibold transition border ${
                              selected
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-400/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
                            }`}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  ) : field.type === 'select' ? (
                    <select
                      value={customValues[field.key] ?? ''}
                      onChange={(e) =>
                        setCustomValues((s) => ({ ...s, [field.key]: e.target.value }))
                      }
                      className="input w-full text-sm"
                    >
                      {(field.options || []).map((opt) => {
                        const val = typeof opt === 'object' && opt !== null ? opt.value : opt;
                        const lbl = typeof opt === 'object' && opt !== null ? opt.label : opt;
                        return (
                          <option key={val} value={val}>
                            {lbl}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={customValues[field.key] ?? 0}
                      onChange={(e) =>
                        setCustomValues((s) => ({ ...s, [field.key]: Number(e.target.value) }))
                      }
                      className="input w-full text-sm"
                    />
                  )}
                  {field.description && field.type !== 'boolean' && (
                    <p className="text-[11px] text-slate-500">{field.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Score input: only show if no custom round fields or if game doesn't exclusively use custom action buttons */}
          {(!customFields.some((f) => f.type === 'radio' && f.key === 'action') || teamScoreInput !== 0) && (
            isCooperative ? (
              <div className="space-y-4 border-t border-slate-800/80 pt-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Team Points Scored This Round
                  </label>
                  <div className="mt-1">
                    <SplitScoreStepper
                      value={teamScoreInput}
                      min={-999}
                      max={9999}
                      disabled={busy}
                      onChange={(v) => setTeamScoreInput(v)}
                      label="Team Points"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 border-t border-slate-800/80 pt-3">
                {players.map((p) => (
                  <div key={p.playerId} className="space-y-1 rounded-xl bg-slate-800/60 p-3 border border-slate-700/60">
                    <div className="font-semibold text-slate-200">{p.displayName}</div>
                    <SplitScoreStepper
                      value={points[p.playerId] ?? 0}
                      min={-999}
                      max={9999}
                      disabled={busy}
                      onChange={(v) => setPoints((s) => ({ ...s, [p.playerId]: v }))}
                      label="Points"
                    />
                  </div>
                ))}
              </div>
            )
          )}

          <div className="flex justify-end pt-2">
            <button
              className="btn-primary"
              disabled={busy}
              onClick={handleSaveRound}
            >
              <Check size={16} /> Save Round {roundsList.length + 1}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
