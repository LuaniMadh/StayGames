import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { Player } from '../../shared/types.js';
import { getPool } from '../db/pool.js';
import { fetchAllLdapUsers, LdapDirectoryUser } from './ldapService.js';

const AVATAR_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#3b82f6', // blue
];

export function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function mapPlayerRow(row: RowDataPacket): Player {
  return {
    id: Number(row.id),
    ldapUid: row.ldap_uid ?? null,
    username: row.username ?? null,
    displayName: String(row.display_name),
    email: row.email ?? null,
    avatarColor: String(row.avatar_color || '#6366f1'),
    isGuest: Boolean(row.is_guest),
    isActive: Boolean(row.is_active),
    lastSyncedAt: row.last_synced_at
      ? new Date(row.last_synced_at).toISOString()
      : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function getPlayerById(id: number): Promise<Player | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM players WHERE id = ? LIMIT 1',
    [id]
  );
  if (rows.length === 0) return null;
  return mapPlayerRow(rows[0]);
}

export async function listPlayers(includeInactive = false): Promise<Player[]> {
  const pool = getPool();
  const sql = includeInactive
    ? 'SELECT * FROM players ORDER BY is_guest ASC, display_name ASC'
    : 'SELECT * FROM players WHERE is_active = 1 ORDER BY is_guest ASC, display_name ASC';
  const [rows] = await pool.query<RowDataPacket[]>(sql);
  return rows.map(mapPlayerRow);
}

export async function upsertLdapPlayer(
  user: LdapDirectoryUser
): Promise<Player> {
  const pool = getPool();
  const avatarColor = pickAvatarColor(user.uid);

  await pool.query(
    `INSERT INTO players (ldap_uid, ldap_dn, username, display_name, email, avatar_color, is_guest, is_active, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 1, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       ldap_dn = VALUES(ldap_dn),
       username = VALUES(username),
       display_name = VALUES(display_name),
       email = VALUES(email),
       is_guest = 0,
       last_synced_at = UTC_TIMESTAMP()`,
    [user.uid, user.dn, user.username, user.displayName, user.email, avatarColor]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM players WHERE ldap_uid = ? OR username = ? LIMIT 1',
    [user.uid, user.username]
  );
  if (rows.length === 0) {
    throw new Error('Failed to retrieve upserted LDAP player.');
  }
  return mapPlayerRow(rows[0]);
}

export async function syncRosterFromLdap(): Promise<{
  totalSynced: number;
  players: Player[];
}> {
  const directoryUsers = await fetchAllLdapUsers();
  for (const u of directoryUsers) {
    await upsertLdapPlayer(u);
  }
  const players = await listPlayers(false);
  return {
    totalSynced: directoryUsers.length,
    players,
  };
}

export async function createGuestPlayer(displayName: string): Promise<Player> {
  const trimmed = displayName.trim();
  if (!trimmed || trimmed.length > 100) {
    throw new Error('Guest display name must be between 1 and 100 characters.');
  }

  const pool = getPool();
  const avatarColor = pickAvatarColor(`guest:${trimmed}:${Date.now()}`);
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO players (display_name, avatar_color, is_guest, is_active)
     VALUES (?, ?, 1, 1)`,
    [trimmed, avatarColor]
  );

  const created = await getPlayerById(result.insertId);
  if (!created) {
    throw new Error('Failed to load newly created guest player.');
  }
  return created;
}

export async function updatePlayerActiveStatus(
  id: number,
  isActive: boolean
): Promise<Player | null> {
  const pool = getPool();
  await pool.query('UPDATE players SET is_active = ? WHERE id = ?', [
    isActive ? 1 : 0,
    id,
  ]);
  return getPlayerById(id);
}

export async function linkGuestToLdapAccount(
  guestPlayerId: number,
  ldapUid: string
): Promise<Player> {
  const guest = await getPlayerById(guestPlayerId);
  if (!guest) {
    throw new Error('Guest player not found.');
  }
  if (!guest.isGuest) {
    throw new Error('Player is already linked to an account.');
  }

  const directoryUsers = await fetchAllLdapUsers();
  const match = directoryUsers.find(
    (u) => u.uid.toLowerCase() === ldapUid.trim().toLowerCase()
  );
  if (!match) {
    throw new Error(`LDAP account "${ldapUid}" not found in directory.`);
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check if another player row already has this ldap_uid
    const [existing] = await conn.query<RowDataPacket[]>(
      'SELECT id, is_guest FROM players WHERE (ldap_uid = ? OR username = ?) AND id != ? LIMIT 1',
      [match.uid, match.username, guestPlayerId]
    );

    if (existing.length > 0) {
      const otherId = Number(existing[0].id);
      // Merge: reassign sessions/participations from other player to this guest, then delete other
      await conn.query(
        'UPDATE IGNORE session_players SET player_id = ? WHERE player_id = ?',
        [guestPlayerId, otherId]
      );
      await conn.query('DELETE FROM session_players WHERE player_id = ?', [otherId]);
      await conn.query(
        'UPDATE game_sessions SET created_by_player_id = ? WHERE created_by_player_id = ?',
        [guestPlayerId, otherId]
      );
      await conn.query('DELETE FROM players WHERE id = ?', [otherId]);
    }

    // Now update the guest record to become the official LDAP player
    await conn.query(
      `UPDATE players
       SET ldap_uid = ?,
           ldap_dn = ?,
           username = ?,
           email = ?,
           is_guest = 0,
           is_active = 1,
           last_synced_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [match.uid, match.dn, match.username, match.email, guestPlayerId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const updated = await getPlayerById(guestPlayerId);
  if (!updated) throw new Error('Failed to reload linked player.');
  return updated;
}
