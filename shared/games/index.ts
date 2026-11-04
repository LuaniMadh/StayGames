import { GameDefinition, GameMetadata } from '../types.js';
import { miscGame } from './misc.js';
import { phase10Game } from './phase10.js';
import { thatsNotAHatGame } from './thatsNotAHat.js';
import { unoGame } from './uno.js';
import { wizardGame } from './wizard.js';

const gameRegistry = new Map<string, GameDefinition<any, any, any>>();

export function registerGame(definition: GameDefinition<any, any, any>): void {
  gameRegistry.set(definition.slug, definition);
}

export function unregisterGame(slug: string): void {
  gameRegistry.delete(slug);
}

// Register built-in games in display order (the catch-all "Other game" goes last)
[wizardGame, phase10Game, unoGame, thatsNotAHatGame, miscGame].forEach(registerGame);

export function getAllGames(): GameDefinition<any, any, any>[] {
  return Array.from(gameRegistry.values());
}

export function getGameBySlug(
  slug: string
): GameDefinition<any, any, any> | undefined {
  return gameRegistry.get(slug);
}

export function toGameMetadata(
  game: GameDefinition<any, any, any>
): GameMetadata {
  return {
    slug: game.slug,
    name: game.name,
    tagline: game.tagline,
    description: game.description,
    rulesSummary: game.rulesSummary,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    supportedModes: game.supportedModes,
    defaultMode: game.defaultMode,
    scoringDirection: game.scoringDirection,
    gameType: game.gameType || (game.cooperative ? 'cooperative' : 'competitive'),
    cooperative: Boolean(game.cooperative || game.gameType === 'cooperative'),
    themeColor: game.themeColor,
    iconName: game.iconName,
    configFields: game.configFields,
    roundInputFields: game.roundInputFields || game.roundFields,
    roundFields: game.roundFields || game.roundInputFields,
    scoreboardColumns: game.scoreboardColumns || game.roundTableColumns,
    roundTableColumns: game.roundTableColumns || game.scoreboardColumns,
    charts: game.charts,
    leaderboardColumns: game.leaderboardColumns,
  };
}

/** Display title for a session: custom title (e.g. misc game name) or the game name. */
export function getSessionDisplayName(slug: string, config: Record<string, any>): string {
  const game = getGameBySlug(slug);
  if (!game) return slug;
  return game.getSessionTitle?.(config) ?? game.name;
}

export { wizardGame, phase10Game, unoGame, thatsNotAHatGame, miscGame };
export * from './helpers.js';
export { createSimplePointsGame } from './simplePoints.js';
