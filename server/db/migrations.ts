import { config } from '../config.js';
import { getPool } from './pool.js';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ldap_uid VARCHAR(191) UNIQUE NULL,
    ldap_dn VARCHAR(512) NULL,
    username VARCHAR(191) UNIQUE NULL,
    display_name VARCHAR(191) NOT NULL,
    email VARCHAR(255) NULL,
    avatar_color VARCHAR(32) NOT NULL DEFAULT '#6366f1',
    is_guest TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_synced_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_players_active (is_active),
    INDEX idx_players_display_name (display_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS game_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_slug VARCHAR(64) NOT NULL,
    mode ENUM('scorecard', 'quick') NOT NULL DEFAULT 'scorecard',
    status ENUM('in_progress', 'completed', 'abandoned') NOT NULL DEFAULT 'in_progress',
    config_json JSON NOT NULL,
    state_json JSON NOT NULL,
    notes TEXT NULL,
    created_by_player_id INT NULL,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    CONSTRAINT fk_sessions_creator
      FOREIGN KEY (created_by_player_id) REFERENCES players(id)
      ON DELETE SET NULL,
    INDEX idx_sessions_game_status (game_slug, status),
    INDEX idx_sessions_status_started (status, started_at),
    INDEX idx_sessions_completed (completed_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS session_players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    player_id INT NOT NULL,
    seat_order INT NOT NULL,
    final_score DECIMAL(10, 2) NULL,
    placement INT NULL,
    is_winner TINYINT(1) NOT NULL DEFAULT 0,
    stats_json JSON NULL,
    CONSTRAINT fk_sp_session
      FOREIGN KEY (session_id) REFERENCES game_sessions(id)
      ON DELETE CASCADE,
    CONSTRAINT fk_sp_player
      FOREIGN KEY (player_id) REFERENCES players(id)
      ON DELETE RESTRICT,
    UNIQUE KEY uq_session_player (session_id, player_id),
    INDEX idx_sp_player (player_id),
    INDEX idx_sp_winner (player_id, is_winner)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS day_labels (
    day DATE PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    updated_by_player_id INT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_day_labels_player
      FOREIGN KEY (updated_by_player_id) REFERENCES players(id)
      ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS plugins (
    slug VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    description TEXT NULL,
    code_js MEDIUMTEXT NOT NULL,
    author VARCHAR(128) NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForDatabaseAndMigrate(): Promise<void> {
  const pool = getPool();
  const maxRetries = config.db.connectRetries;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await pool.getConnection();
      try {
        await conn.ping();
        for (const sql of SCHEMA_STATEMENTS) {
          await conn.query(sql);
        }
        console.log('[DB] Connected to MySQL and verified schema.');
        return;
      } finally {
        conn.release();
      }
    } catch (err: any) {
      console.warn(
        `[DB] Connection attempt ${attempt}/${maxRetries} failed: ${err?.message || err}`
      );
      if (attempt === maxRetries) {
        throw err;
      }
      await sleep(config.db.connectRetryDelayMs);
    }
  }
}
