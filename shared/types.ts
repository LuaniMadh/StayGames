export type GameMode = 'scorecard' | 'quick';

export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

export type GameType = 'competitive' | 'cooperative' | 'team';

export interface Player {
  id: number;
  ldapUid: string | null;
  username: string | null;
  displayName: string;
  email: string | null;
  avatarColor: string;
  isGuest: boolean;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface AuthUser {
  playerId: number;
  username: string;
  displayName: string;
  email: string | null;
  avatarColor: string;
  ldapUid: string | null;
}

export interface ConfigField {
  key: string;
  label: string;
  description?: string;
  type: 'number' | 'boolean' | 'select' | 'text' | 'radio';
  /** Optional layout preference: 'buttons' / 'segmented' renders options as selectable button group. */
  display?: 'buttons' | 'dropdown' | 'segmented';
  widget?: 'buttons' | 'segmented' | 'dropdown';
  /** Field must be filled in (used for 'text' fields). */
  required?: boolean;
  placeholder?: string;
  /** Default value for this field. */
  default?: number | string | boolean;
  /** Also show this field when the quick-result mode is selected (default: scorecard only). */
  showInQuickMode?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: ({ value: string; label: string } | string)[];
}

export interface StandingEntry {
  playerId: number;
  rank: number;
  isWinner: boolean;
  score: number;
  scoreFormatted: string;
  secondaryBadge?: string;
}

export interface QuickResultEntry {
  playerId: number;
  placement: number;
  score: number | null;
}

export interface QuickModeState {
  kind: 'quick';
  placements: QuickResultEntry[];
}

export interface LeaderboardColumnDef {
  key: string;
  label: string;
  tooltip?: string;
  align?: 'left' | 'right' | 'center';
  format: 'integer' | 'decimal' | 'percent';
  aggregate: 'sum' | 'max' | 'min' | 'avg' | 'ratio_percent';
  statKey: string;
  denominatorStatKey?: string;
}

export interface ScoreboardColumnDef {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'integer' | 'decimal' | 'text' | 'badge';
  badgeColor?: string;
}

export interface ChartDef {
  key: string;
  title: string;
  type: 'line' | 'bar';
  dataKey: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  yAxisMin?: number;
  yAxisMax?: number;
  color?: string;
}

export interface GameMetadata {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  rulesSummary: string[];
  minPlayers: number;
  maxPlayers: number;
  supportedModes: GameMode[];
  defaultMode: GameMode;
  scoringDirection: 'highest_wins' | 'lowest_wins';
  gameType?: GameType;
  cooperative?: boolean;
  themeColor: 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan';
  iconName: 'wand' | 'layers' | 'flame' | 'hat' | 'dice';
  configFields: ConfigField[];
  roundInputFields?: ConfigField[];
  roundFields?: ConfigField[];
  scoreboardColumns?: ScoreboardColumnDef[];
  roundTableColumns?: ScoreboardColumnDef[];
  charts?: ChartDef[];
  leaderboardColumns: LeaderboardColumnDef[];
}

export interface GameDefinition<
  TConfig = Record<string, any>,
  TState = any,
  TRoundInput = any
> extends GameMetadata {
  getDefaultConfig: (playerCount: number) => TConfig;
  createInitialState: (
    playerIds: number[],
    config: TConfig,
    mode: GameMode
  ) => TState | QuickModeState;
  addRound: (
    state: TState,
    roundInput: TRoundInput,
    playerIds: number[],
    config: TConfig
  ) => TState;
  undoLastRound: (
    state: TState,
    playerIds: number[],
    config: TConfig
  ) => TState;
  /**
   * Optional: replace an already recorded round (1-based roundNumber) and
   * recompute everything after it. Games that implement this get edit buttons.
   */
  editRound?: (
    state: TState,
    roundNumber: number,
    roundInput: TRoundInput,
    playerIds: number[],
    config: TConfig
  ) => TState;
  /** Optional: validate a merged config before a session is created. Throw to reject. */
  validateConfig?: (config: TConfig) => void;
  /** Optional: display name for a session (e.g. misc game uses the custom name). */
  getSessionTitle?: (config: TConfig) => string | null;
  isGameComplete: (
    state: TState | QuickModeState,
    playerIds: number[],
    config: TConfig,
    mode: GameMode
  ) => boolean;
  computeStandings: (
    state: TState | QuickModeState,
    playerIds: number[],
    config: TConfig,
    mode: GameMode
  ) => StandingEntry[];
  extractPlayerStats: (
    state: TState | QuickModeState,
    playerId: number,
    standing: StandingEntry,
    config: TConfig,
    mode: GameMode
  ) => Record<string, number | string | boolean | null | undefined>;
}

export interface SessionParticipant {
  playerId: number;
  displayName: string;
  avatarColor: string;
  isGuest: boolean;
  seatOrder: number;
  finalScore: number | null;
  placement: number | null;
  isWinner: boolean;
  stats: Record<string, number | string | boolean | null>;
}

export interface GameSession {
  id: number;
  gameSlug: string;
  mode: GameMode;
  status: SessionStatus;
  config: Record<string, any>;
  state: any;
  notes: string | null;
  createdByPlayerId: number | null;
  startedAt: string;
  completedAt: string | null;
  participants: SessionParticipant[];
  standings?: StandingEntry[];
  isComplete?: boolean;
}

export interface OverallLeaderboardRow {
  rank: number;
  playerId: number;
  displayName: string;
  avatarColor: string;
  isGuest: boolean;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  podiums: number;
  distinctGamesPlayed: number;
  favoriteGameSlug: string | null;
}

export interface GameLeaderboardRow {
  rank: number;
  playerId: number;
  displayName: string;
  avatarColor: string;
  isGuest: boolean;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  avgPlacement: number;
  bestScore: number | null;
  avgScore: number | null;
  customMetrics: Record<string, number | null>;
}

export interface GameLeaderboardResponse {
  game: GameMetadata;
  totalSessions: number;
  rows: GameLeaderboardRow[];
}

/** A user-given name for a calendar day (e.g. "Ski trip evening"). Key: YYYY-MM-DD. */
export interface DayLabel {
  day: string;
  title: string;
}

/** A directory account as offered when linking a guest to LDAP. */
export interface LdapDirectoryAccount {
  uid: string;
  username: string;
  displayName: string;
  email: string | null;
  /** Existing StayGames player already bound to this account (null = not imported yet). */
  linkedPlayerId: number | null;
}

export interface PluginRecord {
  slug: string;
  name: string;
  version: string;
  description: string | null;
  codeJs: string;
  author: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
