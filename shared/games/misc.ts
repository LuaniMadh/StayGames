import { createSimplePointsGame } from './simplePoints.js';

/**
 * Miscellaneous game: log any game that has no dedicated module.
 * The actual game name is stored in the session config (config.gameName).
 */
export const miscGame = createSimplePointsGame({
  slug: 'misc',
  name: 'Other game',
  tagline: 'Log any game that is not registered (yet)',
  description:
    'For everything else: enter the name of the game and either just record the final placements or keep a simple per-round points tally.',
  rulesSummary: [
    'Enter the name of the game you played so it shows up in history.',
    'Quick mode: order players by placement (ties allowed).',
    'Scorecard mode: add points per round; choose whether highest or lowest total wins.',
  ],
  minPlayers: 1,
  maxPlayers: 20,
  scoringDirection: 'highest_wins',
  supportedModes: ['quick', 'scorecard'],
  defaultMode: 'quick',
  themeColor: 'cyan',
  iconName: 'dice',
  allowNegative: true,
  extraConfigFields: [
    {
      key: 'gameName',
      label: 'Game name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Catan, Skyjo, Werewolf…',
      showInQuickMode: true,
    },
    {
      key: 'scoringDirection',
      label: 'Winner',
      type: 'select',
      options: [
        { value: 'highest_wins', label: 'Highest score wins' },
        { value: 'lowest_wins', label: 'Lowest score wins' },
      ],
    },
  ],
  extraDefaults: { gameName: '', scoringDirection: 'highest_wins' },
  validateConfig(config) {
    const name = typeof config.gameName === 'string' ? config.gameName.trim() : '';
    if (!name) {
      throw new Error('Please enter the name of the game.');
    }
    if (name.length > 100) {
      throw new Error('Game name must be at most 100 characters.');
    }
    config.gameName = name;
  },
  getSessionTitle(config) {
    return typeof config.gameName === 'string' && config.gameName.trim() ? config.gameName.trim() : null;
  },
});
