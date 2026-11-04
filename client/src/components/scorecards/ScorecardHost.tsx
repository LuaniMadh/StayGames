import { ComponentType } from 'react';
import type { ScorecardProps } from './common';
import { GenericPointsScorecard } from './GenericPointsScorecard';
import { Phase10Scorecard } from './Phase10Scorecard';
import { ThatsNotAHatScorecard } from './ThatsNotAHatScorecard';
import { UnoScorecard } from './UnoScorecard';
import { WizardScorecard } from './WizardScorecard';

/**
 * Client-side scorecard registry.
 * Map a game slug to a custom React scorecard. Games not listed here fall back
 * to the generic points scorecard (works with createSimplePointsGame()).
 */
const SCORECARDS: Record<string, ComponentType<ScorecardProps<any>>> = {
  wizard: WizardScorecard,
  'phase-10': Phase10Scorecard,
  uno: UnoScorecard,
  'thats-not-a-hat': ThatsNotAHatScorecard,
};

export function registerScorecard(slug: string, component: ComponentType<ScorecardProps<any>>) {
  SCORECARDS[slug] = component;
}

export function ScorecardHost(props: ScorecardProps<any>) {
  const Component = SCORECARDS[props.session.gameSlug] ?? GenericPointsScorecard;
  return <Component {...props} />;
}
