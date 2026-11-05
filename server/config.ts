import dotenv from 'dotenv';

dotenv.config();

function parseBool(value: string | undefined, defaultVal: boolean): boolean {
  if (value === undefined || value === '') return defaultVal;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret:
      process.env.JWT_SECRET ||
      'staygames-change-this-secret-in-production-env',
    expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS || 60 * 60 * 24 * 14), // 14 days
    cookieName: 'staygames_token',
    cookieSecure: parseBool(process.env.COOKIE_SECURE, false),
  },

  db: {
    host: process.env.DB_HOST || 'mysql',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'staygames',
    password: process.env.DB_PASSWORD || 'staygames_secret',
    database: process.env.DB_NAME || 'staygames',
    connectRetries: Number(process.env.DB_CONNECT_RETRIES || 20),
    connectRetryDelayMs: Number(process.env.DB_CONNECT_RETRY_DELAY_MS || 2500),
  },

  ldap: {
    url: process.env.LDAP_URL || 'ldap://openldap:389',
    baseDn: process.env.LDAP_BASE_DN || 'dc=staygames,dc=local',
    bindDn: process.env.LDAP_BIND_DN || '',
    bindPassword: process.env.LDAP_BIND_PASSWORD || '',
    userSearchBase:
      process.env.LDAP_USER_SEARCH_BASE ||
      process.env.LDAP_BASE_DN ||
      'dc=staygames,dc=local',
    userSearchFilter:
      process.env.LDAP_USER_SEARCH_FILTER ||
      '(&(objectClass=inetOrgPerson)(uid=%s))',
    syncFilter:
      process.env.LDAP_SYNC_FILTER || '(objectClass=inetOrgPerson)',
    attrUid: process.env.LDAP_ATTR_UID || 'uid',
    attrUsername: process.env.LDAP_ATTR_USERNAME || 'uid',
    attrDisplayName: process.env.LDAP_ATTR_DISPLAY_NAME || 'cn',
    attrEmail: process.env.LDAP_ATTR_EMAIL || 'mail',
    tlsRejectUnauthorized: parseBool(
      process.env.LDAP_TLS_REJECT_UNAUTHORIZED,
      true
    ),
    syncOnStartup: parseBool(process.env.LDAP_SYNC_ON_STARTUP, true),
    connectTimeoutMs: Number(process.env.LDAP_CONNECT_TIMEOUT_MS || 8000),
    timeoutMs: Number(process.env.LDAP_TIMEOUT_MS || 10000),
    mockMode: parseBool(process.env.LDAP_MOCK_MODE, false),
    mockPassword: process.env.LDAP_MOCK_PASSWORD || 'password',
  },
};
