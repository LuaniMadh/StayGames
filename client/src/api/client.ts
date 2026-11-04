import type {
  AuthUser,
  DayLabel,
  GameLeaderboardResponse,
  GameMetadata,
  GameMode,
  GameSession,
  LdapDirectoryAccount,
  OverallLeaderboardRow,
  Player,
  PluginRecord,
  QuickResultEntry,
  SessionStatus,
} from '../../../shared/types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  // Auth
  authStatus: () =>
    request<{ authenticated: boolean; user: AuthUser | null; ldapInfo: { mockMode: boolean; baseDn: string } }>(
      'GET',
      '/api/auth/status'
    ),
  login: (username: string, password: string) =>
    request<{ user: AuthUser }>('POST', '/api/auth/login', { username, password }),
  logout: () => request<{ ok: true }>('POST', '/api/auth/logout'),

  // Players
  listPlayers: (includeInactive = false) =>
    request<{ players: Player[] }>(
      'GET',
      `/api/players${includeInactive ? '?includeInactive=true' : ''}`
    ),
  syncLdap: () =>
    request<{ totalSynced: number; players: Player[] }>('POST', '/api/players/sync-ldap'),
  listDirectoryAccounts: () =>
    request<{ accounts: LdapDirectoryAccount[] }>('GET', '/api/players/directory-accounts'),
  linkGuestToLdap: (guestPlayerId: number, ldapUid: string) =>
    request<{ player: Player }>('POST', `/api/players/${guestPlayerId}/link-ldap`, { ldapUid }),
  createGuest: (displayName: string) =>
    request<{ player: Player }>('POST', '/api/players/guest', { displayName }),
  setPlayerActive: (id: number, isActive: boolean) =>
    request<{ player: Player }>('PATCH', `/api/players/${id}/active`, { isActive }),

  // Games
  listGames: () => request<{ games: GameMetadata[] }>('GET', '/api/games'),

  // Sessions
  listSessions: (params: {
    gameSlug?: string;
    status?: SessionStatus;
    playerId?: number;
    limit?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<{ sessions: GameSession[] }>('GET', `/api/sessions${q ? `?${q}` : ''}`);
  },
  getSession: (id: number) =>
    request<{ session: GameSession }>('GET', `/api/sessions/${id}`),
  createSession: (input: {
    gameSlug: string;
    mode: GameMode;
    playerIds: number[];
    config?: Record<string, any>;
    notes?: string;
    quickPlacements?: QuickResultEntry[];
  }) => request<{ session: GameSession }>('POST', '/api/sessions', input),
  addRound: (id: number, roundInput: unknown) =>
    request<{ session: GameSession }>('POST', `/api/sessions/${id}/rounds`, { roundInput }),
  editRound: (id: number, roundNumber: number, roundInput: unknown) =>
    request<{ session: GameSession }>('PUT', `/api/sessions/${id}/rounds/${roundNumber}`, { roundInput }),
  updateNotes: (id: number, notes: string | null) =>
    request<{ session: GameSession }>('PATCH', `/api/sessions/${id}/notes`, { notes }),
  undoRound: (id: number) =>
    request<{ session: GameSession }>('POST', `/api/sessions/${id}/undo`),
  completeSession: (
    id: number,
    body: { notes?: string; quickPlacements?: QuickResultEntry[] } = {}
  ) => request<{ session: GameSession }>('POST', `/api/sessions/${id}/complete`, body),
  deleteSession: (id: number) =>
    request<{ ok: true }>('DELETE', `/api/sessions/${id}`),

  savePartialState: (id: number, state: unknown) =>
    request<{ session: GameSession }>('PUT', `/api/sessions/${id}/state`, { state }),

  // Plugins
  listPlugins: () =>
    request<{ plugins: PluginRecord[] }>('GET', '/api/plugins'),
  getPlugin: (slug: string) =>
    request<{ plugin: PluginRecord }>('GET', `/api/plugins/${slug}`),
  validatePlugin: (codeJs: string) =>
    request<{ valid: boolean; game?: GameMetadata; error?: string }>(
      'POST',
      '/plugins/api/validate',
      { codeJs }
    ),
  installPlugin: (input: { codeJs: string; version?: string; author?: string }) =>
    request<{ plugin: PluginRecord; game: GameMetadata }>('POST', '/api/plugins', input),
  deletePlugin: (slug: string) =>
    request<{ success: boolean; message: string }>('DELETE', `/api/plugins/${slug}`),

  // Leaderboards
  overallLeaderboard: () =>
    request<{ totalCompletedSessions: number; rows: OverallLeaderboardRow[] }>(
      'GET',
      '/api/leaderboards'
    ),
  gameLeaderboard: (slug: string) =>
    request<GameLeaderboardResponse>('GET', `/api/leaderboards/${slug}`),

  // Day Labels
  listDayLabels: () =>
    request<{ labels: DayLabel[] }>('GET', '/api/day-labels'),
  setDayLabel: (day: string, title: string | null) =>
    request<{ day: string; title: string | null }>('PUT', `/api/day-labels/${day}`, { title }),
};
