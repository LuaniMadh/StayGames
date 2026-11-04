import { createApp } from './app.js';
import { config } from './config.js';
import { waitForDatabaseAndMigrate } from './db/migrations.js';
import { closePool } from './db/pool.js';
import { syncRosterFromLdap } from './services/playerService.js';
import { loadInstalledPlugins } from './services/pluginService.js';

async function bootstrap() {
  await waitForDatabaseAndMigrate();
  await loadInstalledPlugins();

  if (config.ldap.syncOnStartup && !config.ldap.mockMode) {
    // Retry LDAP sync a few times on startup to allow the LDAP server to finish initializing
    const maxLdapAttempts = 5;
    for (let attempt = 1; attempt <= maxLdapAttempts; attempt++) {
      try {
        const { totalSynced } = await syncRosterFromLdap();
        console.log(`[LDAP] Initial roster sync imported/updated ${totalSynced} users.`);
        break;
      } catch (err: any) {
        if (attempt < maxLdapAttempts) {
          console.log(`[LDAP] Waiting for LDAP server to be ready (attempt ${attempt}/${maxLdapAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } else {
          console.warn(
            `[LDAP] Startup roster sync skipped (server will still accept logins / manual sync once LDAP is ready): ${
              err?.message || err
            }`
          );
        }
      }
    }
  } else if (config.ldap.mockMode) {
    try {
      const { totalSynced } = await syncRosterFromLdap();
      console.log(`[LDAP] Mock roster sync initialized ${totalSynced} users.`);
    } catch (err: any) {
      console.warn(`[LDAP] Mock roster sync warning:`, err?.message || err);
    }
  }

  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[StayGames] Server listening on http://0.0.0.0:${config.port}`);
  });

  const shutdown = async () => {
    console.log('[StayGames] Shutting down...');
    server.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[StayGames] Fatal startup error:', err);
  process.exit(1);
});
