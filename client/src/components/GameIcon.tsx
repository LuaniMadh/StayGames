import { Dices, Flame, Layers, LucideProps, Sparkles, WandSparkles } from 'lucide-react';
import type { GameMetadata } from '../../../shared/types';

/** Tailwind class sets per theme color (kept literal so Tailwind can detect them). */
export const THEME_CLASSES: Record<
  GameMetadata['themeColor'],
  { bg: string; text: string; border: string; soft: string }
> = {
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-300', border: 'border-indigo-500/40', soft: 'bg-indigo-500/15' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-300', border: 'border-emerald-500/40', soft: 'bg-emerald-500/15' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-300', border: 'border-amber-500/40', soft: 'bg-amber-500/15' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-300', border: 'border-rose-500/40', soft: 'bg-rose-500/15' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-300', border: 'border-violet-500/40', soft: 'bg-violet-500/15' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-300', border: 'border-cyan-500/40', soft: 'bg-cyan-500/15' },
};

export function GameIcon({
  name,
  ...props
}: { name: GameMetadata['iconName'] } & LucideProps) {
  switch (name) {
    case 'wand':
      return <WandSparkles {...props} />;
    case 'layers':
      return <Layers {...props} />;
    case 'flame':
      return <Flame {...props} />;
    case 'hat':
      return <Sparkles {...props} />;
    default:
      return <Dices {...props} />;
  }
}

export function GameBadge({ game, size = 'md' }: { game: GameMetadata; size?: 'sm' | 'md' }) {
  const t = THEME_CLASSES[game.themeColor];
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11';
  return (
    <div className={`flex ${dim} shrink-0 items-center justify-center rounded-xl ${t.soft} ${t.text}`}>
      <GameIcon name={game.iconName} size={size === 'sm' ? 16 : 22} />
    </div>
  );
}
