import vm from 'node:vm';
import { RowDataPacket } from 'mysql2/promise';
import {
  computeQuickStandings,
  createCooperativeStandings,
  createEmptyQuickState,
  createSimplePointsGame,
  isQuickState,
  rankEntries,
  registerGame,
  toGameMetadata,
  unregisterGame,
  getAllGames,
  getGameBySlug,
} from '../../shared/games/index.js';
import { GameDefinition, GameMetadata } from '../../shared/types.js';
import { getPool } from '../db/pool.js';

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

export interface PluginUploadInput {
  slug?: string;
  codeJs: string;
  author?: string;
  version?: string;
}

const BUILT_IN_SLUGS = new Set(['wizard', 'phase-10', 'uno', 'thats-not-a-hat', 'misc']);

/**
 * Sandboxed execution environment for game plugins.
 * Exposes shared helper functions and core primitives while isolating globals.
 */
export function compilePluginCode(codeJs: string): GameDefinition<any, any, any> {
  const sandbox = {
    module: { exports: {} as any },
    exports: {} as any,
    helpers: {
      computeQuickStandings,
      createCooperativeStandings,
      createEmptyQuickState,
      createSimplePointsGame,
      isQuickState,
      rankEntries,
    },
    // Safe standard globals
    console: {
      log: (...args: any[]) => console.log('[Plugin]', ...args),
      warn: (...args: any[]) => console.warn('[Plugin]', ...args),
      error: (...args: any[]) => console.error('[Plugin]', ...args),
    },
    Math,
    Date,
    Object,
    Array,
    Number,
    String,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
  };

  vm.createContext(sandbox);

  try {
    vm.runInContext(codeJs, sandbox, {
      timeout: 2000,
      displayErrors: true,
    });
  } catch (err: any) {
    throw new Error(`Plugin syntax/execution error: ${err?.message || err}`);
  }

  let exported = sandbox.module.exports;
  // If nothing on module.exports, check exports.default or exports
  if (!exported || (typeof exported === 'object' && Object.keys(exported).length === 0)) {
    exported = sandbox.exports?.default || sandbox.exports;
  }

  let definition: GameDefinition<any, any, any>;
  if (typeof exported === 'function') {
    definition = exported(sandbox.helpers);
  } else if (typeof exported === 'object' && exported !== null) {
    definition = exported;
  } else {
    throw new Error(
      'Plugin must export a GameDefinition object or a factory function (e.g. module.exports = function(helpers) { ... })'
    );
  }

  // Validate required GameDefinition fields
  validateGameDefinition(definition);

  return definition;
}

function validateGameDefinition(def: any): asserts def is GameDefinition<any, any, any> {
  if (!def || typeof def !== 'object') {
    throw new Error('Plugin export must be an object.');
  }
  const requiredStrings = ['slug', 'name', 'tagline', 'description'];
  for (const field of requiredStrings) {
    if (!def[field] || typeof def[field] !== 'string') {
      throw new Error(`Plugin missing required string field: "${field}".`);
    }
  }

  // Slug sanity check
  if (!/^[a-z0-9-_]+$/.test(def.slug)) {
    throw new Error(
      `Invalid plugin slug "${def.slug}". Must contain only lowercase letters, numbers, hyphens, and underscores.`
    );
  }

  if (typeof def.minPlayers !== 'number' || typeof def.maxPlayers !== 'number') {
    throw new Error('Plugin must specify numeric minPlayers and maxPlayers.');
  }

  if (!Array.isArray(def.supportedModes) || def.supportedModes.length === 0) {
    throw new Error('Plugin must specify non-empty supportedModes array.');
  }

  const requiredFunctions = [
    'getDefaultConfig',
    'createInitialState',
    'addRound',
    'undoLastRound',
    'isGameComplete',
    'computeStandings',
    'extractPlayerStats',
  ];

  for (const fn of requiredFunctions) {
    if (typeof def[fn] !== 'function') {
      throw new Error(`Plugin missing required function: "${fn}()".`);
    }
  }

  // Ensure arrays and defaults
  def.rulesSummary = Array.isArray(def.rulesSummary) ? def.rulesSummary : [];
  def.configFields = Array.isArray(def.configFields) ? def.configFields : [];
  def.roundInputFields = Array.isArray(def.roundInputFields)
    ? def.roundInputFields
    : Array.isArray(def.roundFields)
    ? def.roundFields
    : [];
  def.roundFields = def.roundInputFields;
  def.scoreboardColumns = Array.isArray(def.scoreboardColumns)
    ? def.scoreboardColumns
    : Array.isArray(def.roundTableColumns)
    ? def.roundTableColumns
    : undefined;
  def.roundTableColumns = def.scoreboardColumns;
  def.charts = Array.isArray(def.charts) ? def.charts : undefined;
  def.leaderboardColumns = Array.isArray(def.leaderboardColumns) ? def.leaderboardColumns : [];
  def.themeColor = def.themeColor || 'indigo';
  def.iconName = def.iconName || 'dice';
  def.gameType = def.gameType || (def.cooperative ? 'cooperative' : 'competitive');
  def.cooperative = Boolean(def.cooperative || def.gameType === 'cooperative');
}

/**
 * Loads and registers all enabled plugins from the database on startup.
 */
export async function loadInstalledPlugins(): Promise<{ loaded: number; errors: string[] }> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM plugins WHERE enabled = 1 ORDER BY slug ASC'
  );

  let loaded = 0;
  const errors: string[] = [];

  for (const r of rows) {
    try {
      const def = compilePluginCode(String(r.code_js));
      registerGame(def);
      loaded++;
      console.log(`[Plugin] Successfully loaded and registered game plugin "${def.name}" (${def.slug}).`);
    } catch (err: any) {
      const msg = `Failed to load plugin "${r.slug}": ${err?.message || err}`;
      console.error(`[Plugin] ${msg}`);
      errors.push(msg);
    }
  }

  return { loaded, errors };
}

export async function listPlugins(): Promise<PluginRecord[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM plugins ORDER BY slug ASC'
  );

  return rows.map((r) => ({
    slug: String(r.slug),
    name: String(r.name),
    version: String(r.version || '1.0.0'),
    description: r.description ? String(r.description) : null,
    codeJs: String(r.code_js),
    author: r.author ? String(r.author) : null,
    enabled: Boolean(r.enabled),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

export async function getPluginBySlug(slug: string): Promise<PluginRecord | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM plugins WHERE slug = ? LIMIT 1',
    [slug]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    slug: String(r.slug),
    name: String(r.name),
    version: String(r.version || '1.0.0'),
    description: r.description ? String(r.description) : null,
    codeJs: String(r.code_js),
    author: r.author ? String(r.author) : null,
    enabled: Boolean(r.enabled),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function installOrUpdatePlugin(input: PluginUploadInput): Promise<{
  plugin: PluginRecord;
  game: GameMetadata;
}> {
  if (!input.codeJs || typeof input.codeJs !== 'string' || !input.codeJs.trim()) {
    throw new Error('Plugin codeJs is required.');
  }

  // 1. Compile and validate in sandbox
  const def = compilePluginCode(input.codeJs);

  if (BUILT_IN_SLUGS.has(def.slug)) {
    throw new Error(`Cannot overwrite built-in game slug "${def.slug}".`);
  }

  const pool = getPool();
  const version = input.version?.trim() || '1.0.0';
  const author = input.author?.trim() || null;

  // 2. Persist to database
  await pool.query(
    `INSERT INTO plugins (slug, name, version, description, code_js, author, enabled)
     VALUES (?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       version = VALUES(version),
       description = VALUES(description),
       code_js = VALUES(code_js),
       author = COALESCE(VALUES(author), author),
       enabled = 1,
       updated_at = UTC_TIMESTAMP()`,
    [def.slug, def.name, version, def.description, input.codeJs, author]
  );

  // 3. Register live in memory immediately (no restart needed!)
  registerGame(def);

  const saved = await getPluginBySlug(def.slug);
  if (!saved) throw new Error('Failed to load saved plugin.');

  return {
    plugin: saved,
    game: toGameMetadata(def),
  };
}

export async function uninstallPlugin(slug: string): Promise<boolean> {
  if (BUILT_IN_SLUGS.has(slug)) {
    throw new Error(`Cannot delete built-in game "${slug}".`);
  }

  const pool = getPool();
  await pool.query('DELETE FROM plugins WHERE slug = ?', [slug]);

  // Unregister in live memory
  unregisterGame(slug);
  return true;
}
