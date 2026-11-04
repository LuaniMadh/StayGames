import type { GameSession, SessionParticipant } from '../../../../shared/types';

export interface ScorecardProps<TState = any> {
  session: GameSession;
  state: TState;
  players: SessionParticipant[]; // sorted by seat order
  readOnly: boolean;
  busy: boolean;
  onSubmitRound: (roundInput: unknown) => Promise<boolean>;
  onEditRound?: (roundNumber: number, roundInput: unknown) => Promise<boolean>;
}

export function PlayerHeader({ p }: { p: SessionParticipant }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: p.avatarColor }}
      >
        {p.displayName
          .split(/\s+/)
          .slice(0, 2)
          .map((x) => x[0]?.toUpperCase())
          .join('')}
      </span>
      <span className="max-w-[6rem] truncate text-xs font-semibold">{p.displayName.split(' ')[0]}</span>
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
      <button
        type="button"
        disabled={disabled || value <= min}
        className="px-2.5 py-1.5 text-lg leading-none text-slate-300 hover:bg-slate-800 disabled:opacity-30"
        onClick={() => onChange(clamp(value - step))}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        disabled={disabled}
        className="w-12 bg-transparent text-center font-semibold focus:outline-none"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
      />
      <button
        type="button"
        disabled={disabled || value >= max}
        className="px-2.5 py-1.5 text-lg leading-none text-slate-300 hover:bg-slate-800 disabled:opacity-30"
        onClick={() => onChange(clamp(value + step))}
      >
        +
      </button>
    </div>
  );
}

export function zeroMap(players: SessionParticipant[]): Record<number, number> {
  return Object.fromEntries(players.map((p) => [p.playerId, 0]));
}

/**
 * Large split button for score entry (feedback #4):
 * Pressing anywhere on the left reduces score, pressing anywhere on the right increases score.
 */
export function SplitScoreStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const safeVal = Number.isFinite(value) ? value : 0;
  return (
    <div className="relative flex h-14 w-full select-none items-stretch overflow-hidden rounded-2xl border-2 border-slate-700 bg-slate-950 shadow-inner">
      {/* Left button: decrease */}
      <button
        type="button"
        disabled={disabled || safeVal <= min}
        className="flex flex-1 items-center justify-start pl-4 text-2xl font-black text-rose-300 transition active:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-20"
        onClick={() => onChange(clamp(safeVal - step))}
        aria-label="Decrease"
      >
        −
      </button>

      {/* Center value display with optional direct number input */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-slate-100">{safeVal}</span>
        {label && <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>}
      </div>

      {/* Right button: increase */}
      <button
        type="button"
        disabled={disabled || safeVal >= max}
        className="flex flex-1 items-center justify-end pr-4 text-2xl font-black text-emerald-300 transition active:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-20"
        onClick={() => onChange(clamp(safeVal + step))}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
