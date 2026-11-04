import { Client, Entry } from 'ldapts';
import { config } from '../config.js';

export interface LdapDirectoryUser {
  uid: string;
  dn: string;
  username: string;
  displayName: string;
  email: string | null;
}

const MOCK_USERS: LdapDirectoryUser[] = [
  {
    uid: 'admin',
    dn: 'uid=admin,ou=users,dc=staygames,dc=local',
    username: 'admin',
    displayName: 'Admin',
    email: 'admin@staygames.local',
  },
  {
    uid: 'alice',
    dn: 'uid=alice,ou=users,dc=staygames,dc=local',
    username: 'alice',
    displayName: 'Alice Becker',
    email: 'alice@staygames.local',
  },
  {
    uid: 'bob',
    dn: 'uid=bob,ou=users,dc=staygames,dc=local',
    username: 'bob',
    displayName: 'Bob Lindner',
    email: 'bob@staygames.local',
  },
  {
    uid: 'charlie',
    dn: 'uid=charlie,ou=users,dc=staygames,dc=local',
    username: 'charlie',
    displayName: 'Charlie Novak',
    email: 'charlie@staygames.local',
  },
  {
    uid: 'diana',
    dn: 'uid=diana,ou=users,dc=staygames,dc=local',
    username: 'diana',
    displayName: 'Diana Weber',
    email: 'diana@staygames.local',
  },
  {
    uid: 'erik',
    dn: 'uid=erik,ou=users,dc=staygames,dc=local',
    username: 'erik',
    displayName: 'Erik Hoffmann',
    email: 'erik@staygames.local',
  },
];

/**
 * Escapes special characters in LDAP search filter values per RFC 4515.
 */
export function escapeLdapFilterValue(input: string): string {
  return input
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

function extractAttr(entry: Entry, attrName: string): string | null {
  // Perform case-insensitive attribute lookup on the LDAP entry
  const key = Object.keys(entry).find(
    (k) => k.toLowerCase() === attrName.toLowerCase()
  );
  if (!key) return null;
  const raw = entry[key];
  if (raw === undefined || raw === null) return null;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (first === undefined || first === null) return null;
  if (Buffer.isBuffer(first)) {
    return first.toString('utf8');
  }
  return String(first);
}

function mapEntryToUser(entry: Entry): LdapDirectoryUser | null {
  const uid =
    extractAttr(entry, config.ldap.attrUid) ||
    extractAttr(entry, config.ldap.attrUsername);
  const username =
    extractAttr(entry, config.ldap.attrUsername) || uid;
  if (!uid || !username) {
    return null;
  }
  const displayName =
    extractAttr(entry, config.ldap.attrDisplayName) ||
    extractAttr(entry, 'displayName') ||
    username;
  const email = extractAttr(entry, config.ldap.attrEmail);

  return {
    uid,
    dn: entry.dn,
    username,
    displayName,
    email,
  };
}

function createLdapClient(): Client {
  const isLdaps = config.ldap.url.startsWith('ldaps://');
  return new Client({
    url: config.ldap.url,
    timeout: config.ldap.timeoutMs,
    connectTimeout: config.ldap.connectTimeoutMs,
    ...(isLdaps
      ? {
          tlsOptions: {
            rejectUnauthorized: config.ldap.tlsRejectUnauthorized,
          },
        }
      : {}),
  });
}

function getRequestedAttributes(): string[] {
  return Array.from(
    new Set([
      'dn',
      config.ldap.attrUid,
      config.ldap.attrUsername,
      config.ldap.attrDisplayName,
      config.ldap.attrEmail,
      'displayName',
    ])
  );
}

export async function authenticateLdapUser(
  usernameInput: string,
  password: string
): Promise<LdapDirectoryUser | null> {
  const trimmedUser = usernameInput.trim();
  if (!trimmedUser || !password) {
    return null;
  }

  if (config.ldap.mockMode) {
    const found = MOCK_USERS.find(
      (u) => u.username.toLowerCase() === trimmedUser.toLowerCase()
    );
    if (!found) {
      return null;
    }
    // Allow either the standard mock password or "admin" if signing in as admin
    const expectedPassword = found.username === 'admin' ? 'admin' : config.ldap.mockPassword;
    if (password !== expectedPassword && password !== config.ldap.mockPassword) {
      return null;
    }
    return found;
  }

  const client = createLdapClient();
  try {
    if (config.ldap.bindDn) {
      await client.bind(config.ldap.bindDn, config.ldap.bindPassword);
    }

    const escaped = escapeLdapFilterValue(trimmedUser);
    const filter = config.ldap.userSearchFilter
      .replace(/\{\{username\}\}/g, escaped)
      .replace(/%s/g, escaped);

    let userEntry: Entry | null = null;

    try {
      const { searchEntries } = await client.search(
        config.ldap.userSearchBase,
        {
          scope: 'sub',
          filter,
          attributes: getRequestedAttributes(),
          sizeLimit: 2,
        }
      );
      if (searchEntries.length === 1) {
        userEntry = searchEntries[0];
      }
    } catch (searchErr) {
      // If anonymous search is disallowed and no bindDn was provided, fall back to direct DN bind
      if (config.ldap.bindDn) {
        throw searchErr;
      }
    }

    if (userEntry) {
      // Verify the user's password by binding as their DN
      await client.bind(userEntry.dn, password);
      return mapEntryToUser(userEntry);
    }

    // Fallback direct bind if bindDn wasn't set and anonymous search didn't find the entry
    const directDn = `${config.ldap.attrUsername}=${escaped},${config.ldap.userSearchBase}`;
    await client.bind(directDn, password);
    const { searchEntries } = await client.search(directDn, {
      scope: 'base',
      filter: '(objectClass=*)',
      attributes: getRequestedAttributes(),
    });
    if (searchEntries.length > 0) {
      return mapEntryToUser(searchEntries[0]);
    }

    return {
      uid: trimmedUser,
      dn: directDn,
      username: trimmedUser,
      displayName: trimmedUser,
      email: null,
    };
  } catch (err: any) {
    // InvalidCredentialsError or user not found returns null cleanly
    const code = err?.code ?? err?.status;
    if (code === 49 || /invalid credentials/i.test(String(err?.message))) {
      return null;
    }
    console.error('[LDAP] Authentication error:', err?.message || err);
    throw new Error(
      `LDAP server connection failed (${config.ldap.url}): ${err?.message || 'Unknown error'}`
    );
  } finally {
    try {
      await client.unbind();
    } catch {
      // Ignore unbind errors
    }
  }
}

export async function fetchAllLdapUsers(): Promise<LdapDirectoryUser[]> {
  if (config.ldap.mockMode) {
    return [...MOCK_USERS];
  }

  const client = createLdapClient();
  try {
    if (config.ldap.bindDn) {
      await client.bind(config.ldap.bindDn, config.ldap.bindPassword);
    }

    const { searchEntries } = await client.search(config.ldap.userSearchBase, {
      scope: 'sub',
      filter: config.ldap.syncFilter,
      attributes: getRequestedAttributes(),
    });

    const users: LdapDirectoryUser[] = [];
    for (const entry of searchEntries) {
      const mapped = mapEntryToUser(entry);
      if (mapped) {
        users.push(mapped);
      }
    }
    return users;
  } finally {
    try {
      await client.unbind();
    } catch {
      // Ignore unbind errors
    }
  }
}
