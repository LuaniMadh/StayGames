import { useEffect, useState } from 'react';
import { Check, Edit3, Lock, X } from 'lucide-react';
import {
  defaultWizardBids,
  type WizardRound,
  type WizardState,
} from '../../../../shared/games/wizard';
import { PlayerHeader, ScorecardProps, SplitScoreStepper, zeroMap } from './common';

export function WizardScorecard({
  session,
  state,
  players,
  readOnly,
  busy,
  onSubmitRound,
  onEditRound,
}: ScorecardProps<WizardState>) {
  const maxRounds: number = session.config.maxRounds ?? state.maxRounds;
  const forbid: boolean = Boolean(session.config.forbidExactTotalBid);
  const roundNumber = state.rounds.length + 1;
  const cardsDealt = roundNumber;
  const finished = state.rounds.length >= maxRounds;
  const dealer = players[(roundNumber - 1) % players.length];

  // Current round inputs
  const [bids, setBids] = useState<Record<number, number>>(() => ({
    ...defaultWizardBids(players.map((p) => p.playerId), cardsDealt),
    ...(state.pendingBids || {}),
  }));
  const [tricks, setTricks] = useState<Record<number, number>>(() => zeroMap(players));
  const [phase, setPhase] = useState<'bid' | 'tricks'>(state.bidsLocked ? 'tricks' : 'bid');

  // Modal / inline editor for old round (feedback #7)
  const [editingRoundNumber, setEditingRoundNumber] = useState<number | null>(null);
  const [editBids, setEditBids] = useState<Record<number, number>>({});
  const [editTricks, setEditTricks] = useState<Record<number, number>>({});

  // Reset inputs whenever the round count changes
  useEffect(() => {
    const currentCards = state.rounds.length + 1;
    const initialBids = {
      ...defaultWizardBids(players.map((p) => p.playerId), currentCards),
      ...(state.pendingBids || {}),
    };
    setBids(initialBids);
    setTricks(zeroMap(players));
    setPhase(state.bidsLocked ? 'tricks' : 'bid');
  }, [state.rounds.length, state.bidsLocked]);

  const totalBids = players.reduce((s, p) => s + (bids[p.playerId] ?? 0), 0);
  const totalTricks = players.reduce((s, p) => s + (tricks[p.playerId] ?? 0), 0);
  const bidViolation = forbid && totalBids === cardsDealt;

  // Feedback #3: Overshoot / undershoot description helper
  const getBidStatusText = (bidsTotal: number, cards: number) => {
    const diff = bidsTotal - cards;
    if (diff > 0) return `Overshot by +${diff} (total bids: ${bidsTotal} vs ${cards} cards dealt)`;
    if (diff < 0) return `Undershot by ${diff} (total bids: ${bidsTotal} vs ${cards} cards dealt)`;
    return `Exact cards bid (${bidsTotal} / ${cards} cards dealt)`;
  };

  const lockBids = async () => {
    const ok = await onSubmitRound({ type: 'save_bids', bids });
    if (ok) setPhase('tricks');
  };

  const completeRound = async () => {
    await onSubmitRound({ type: 'complete_round', bids, tricks });
  };

  const startEditRound = (r: WizardRound) => {
    setEditingRoundNumber(r.roundNumber);
    const b: Record<number, number> = {};
    const t: Record<number, number> = {};
    for (const e of r.entries) {
      b[e.playerId] = e.bid;
      t[e.playerId] = e.tricks;
    }
    setEditBids(b);
    setEditTricks(t);
  };

  const saveEditRound = async () => {
    if (!editingRoundNumber || !onEditRound) return;
    const ok = await onEditRound(editingRoundNumber, {
      bids: editBids,
      tricks: editTricks,
    });
    if (ok) setEditingRoundNumber(null);
  };

  const editingRoundObj = state.rounds.find((r) => r.roundNumber === editingRoundNumber);
  const editTotalBids = editingRoundObj
    ? players.reduce((s, p) => s + (editBids[p.playerId] ?? 0), 0)
    : 0;
  const editTotalTricks = editingRoundObj
    ? players.reduce((s, p) => s + (editTricks[p.playerId] ?? 0), 0)
    : 0;
  const editBidViolation =
    editingRoundObj && forbid && editTotalBids === editingRoundObj.cardsDealt;

  return (
    <div className="space-y-4">
      {/* Feedback #2: Sticky Header with Player Names and Current Scores */}
      <div className="card sticky top-14 z-10 border-indigo-500/40 bg-slate-900/95 py-3 shadow-xl backdrop-blur">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Live Scores
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {players.map((p) => {
            const lastRound = state.rounds[state.rounds.length - 1];
            const currentScore =
              lastRound?.entries.find((e) => e.playerId === p.playerId)?.cumulativeScore ?? 0;
            return (
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
                  <div className="text-sm font-black text-indigo-300">{currentScore} pts</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scoreboard Table (Feedback #6 & #7) */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="bg-slate-900">
              <th className="table-cell w-16 text-left text-xs text-slate-500">Round</th>
              {players.map((p) => (
                <th key={p.playerId} className="table-cell" colSpan={1}>
                  <PlayerHeader p={p} />
                </th>
              ))}
              {!readOnly && onEditRound && (
                <th className="table-cell w-16 text-center text-xs text-slate-500">Edit</th>
              )}
            </tr>
          </thead>
          <tbody>
            {state.rounds.map((r) => (
              <tr key={r.roundNumber} className="hover:bg-slate-800/30">
                <td className="table-cell text-xs font-bold text-slate-400">
                  {/* Feedback #6: Only show card count if it does NOT equal roundNumber */}
                  Round {r.roundNumber}
                  {r.cardsDealt !== r.roundNumber && (
                    <span className="text-slate-600"> ({r.cardsDealt}🂠)</span>
                  )}
                </td>
                {players.map((p) => {
                  const e = r.entries.find((x) => x.playerId === p.playerId);
                  if (!e) return <td key={p.playerId} className="table-cell" />;
                  const hit = e.bid === e.tricks;
                  return (
                    <td key={p.playerId} className="table-cell text-center">
                      <div className="font-bold">{e.cumulativeScore}</div>
                      <div className={`text-[11px] ${hit ? 'text-emerald-400 font-semibold' : 'text-rose-400'}`}>
                        {e.bid}/{e.tricks} · {e.delta > 0 ? '+' : ''}
                        {e.delta}
                      </div>
                    </td>
                  );
                })}
                {!readOnly && onEditRound && (
                  <td className="table-cell text-center">
                    <button
                      className="btn-secondary px-2 py-1 text-xs hover:border-indigo-400"
                      onClick={() => startEditRound(r)}
                      title={`Edit Round ${r.roundNumber}`}
                    >
                      <Edit3 size={12} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {state.rounds.length === 0 && (
              <tr>
                <td
                  className="table-cell text-center text-slate-500"
                  colSpan={players.length + (onEditRound ? 2 : 1)}
                >
                  No rounds played yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Round Modal / Overlay (Feedback #7) */}
      {editingRoundObj && (
        <div className="card space-y-4 border-amber-500/50 bg-slate-900/95 ring-2 ring-amber-500/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-black text-amber-300">
                Editing Round {editingRoundObj.roundNumber}
              </div>
              <div className="text-xs text-slate-400">
                {editingRoundObj.cardsDealt} cards dealt. Modifying this round will automatically recalculate all subsequent rounds.
              </div>
            </div>
            <button
              className="text-slate-400 hover:text-white"
              onClick={() => setEditingRoundNumber(null)}
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((p) => (
              <div key={p.playerId} className="space-y-2 rounded-xl bg-slate-950/70 p-3 border border-slate-800">
                <div className="font-semibold text-slate-200">{p.displayName}</div>
                <div>
                  <div className="mb-1 text-[10px] uppercase text-slate-400">Bid</div>
                  <SplitScoreStepper
                    value={editBids[p.playerId] ?? 0}
                    max={editingRoundObj.cardsDealt}
                    disabled={busy}
                    onChange={(v) => setEditBids((b) => ({ ...b, [p.playerId]: v }))}
                  />
                </div>
                <div>
                  <div className="mb-1 text-[10px] uppercase text-slate-400">Tricks Won</div>
                  <SplitScoreStepper
                    value={editTricks[p.playerId] ?? 0}
                    max={editingRoundObj.cardsDealt}
                    disabled={busy}
                    onChange={(v) => setEditTricks((t) => ({ ...t, [p.playerId]: v }))}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
            <div className="text-xs text-slate-400">
              Bids: <b>{editTotalBids}</b> | Tricks: <b>{editTotalTricks}</b> / {editingRoundObj.cardsDealt}
              {editBidViolation && (
                <span className="ml-2 text-rose-400">±1 Rule violation</span>
              )}
              {editTotalTricks !== editingRoundObj.cardsDealt && (
                <span className="ml-2 text-amber-400">Total tricks must equal {editingRoundObj.cardsDealt}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => setEditingRoundNumber(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={busy || editBidViolation || editTotalTricks !== editingRoundObj.cardsDealt}
                onClick={saveEditRound}
              >
                <Check size={16} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Round input form for live game */}
      {!readOnly && !finished && (
        <div className="card space-y-4 border-indigo-500/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-lg font-bold">
                Round {roundNumber} <span className="text-slate-500">/ {maxRounds}</span>
              </div>
              <div className="text-sm text-slate-400">
                {cardsDealt} card{cardsDealt === 1 ? '' : 's'} dealt · Dealer:{' '}
                <b className="text-slate-200">{dealer?.displayName}</b>
              </div>
            </div>
            <div className="flex gap-1 rounded-xl bg-slate-800 p-1 text-xs">
              <span
                className={`rounded-lg px-3 py-1 font-bold ${
                  phase === 'bid' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400'
                }`}
              >
                1. Bids
              </span>
              <span
                className={`rounded-lg px-3 py-1 font-bold ${
                  phase === 'tricks' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400'
                }`}
              >
                2. Tricks
              </span>
            </div>
          </div>

          {/* Feedback #3: Visible status of overshooting / undershooting in BOTH phases */}
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm">
            <div className="font-semibold text-indigo-300">
              {getBidStatusText(totalBids, cardsDealt)}
            </div>
            {phase === 'tricks' && (
              <div className="mt-1 text-xs text-slate-400">
                Tricks won assigned: <b className={totalTricks === cardsDealt ? 'text-emerald-400' : 'text-amber-400'}>{totalTricks}</b> / {cardsDealt}
              </div>
            )}
          </div>

          {/* Feedback #4: Split Score Stepper (left = decrease, right = increase) */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((p, idx) => {
              const isDealer = idx === (roundNumber - 1) % players.length;
              return (
                <div
                  key={p.playerId}
                  className="space-y-2 rounded-2xl bg-slate-800/60 p-3 border border-slate-700/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: p.avatarColor }}
                      >
                        {p.displayName[0]?.toUpperCase()}
                      </span>
                      <span className="font-bold text-slate-100">{p.displayName}</span>
                    </div>
                    {isDealer && (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                        Dealer
                      </span>
                    )}
                  </div>

                  {phase === 'bid' ? (
                    <div>
                      <div className="mb-1 text-[11px] font-medium uppercase text-slate-400">
                        Prediction (Bid)
                      </div>
                      <SplitScoreStepper
                        value={bids[p.playerId] ?? 0}
                        max={cardsDealt}
                        disabled={busy}
                        onChange={(v) => setBids((b) => ({ ...b, [p.playerId]: v }))}
                        label="Bid"
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] font-medium uppercase text-slate-400">
                        <span>Tricks Won</span>
                        <span className="text-indigo-300 font-bold">Bid: {bids[p.playerId] ?? 0}</span>
                      </div>
                      <SplitScoreStepper
                        value={tricks[p.playerId] ?? 0}
                        max={cardsDealt}
                        disabled={busy}
                        onChange={(v) => setTricks((t) => ({ ...t, [p.playerId]: v }))}
                        label="Tricks"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {phase === 'bid' ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
              <div className={`text-sm ${bidViolation ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                {bidViolation && '⚠️ ±1 Rule active: total bids cannot equal cards dealt. Dealer must adjust.'}
              </div>
              <button
                className="btn-primary"
                disabled={busy || bidViolation}
                onClick={lockBids}
              >
                <Lock size={16} /> Lock Bids & Start Tricks
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => setPhase('bid')}
              >
                Unlock / Edit Bids
              </button>
              <button
                className="btn-primary"
                disabled={busy || totalTricks !== cardsDealt}
                onClick={completeRound}
              >
                <Check size={16} /> Score Round {roundNumber}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
