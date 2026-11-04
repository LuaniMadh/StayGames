# StayGames — Implementation Plan

## 1. Overview & Goals

**StayGames** is a containerized full-stack web application for tracking board and card game nights within a friend group. It provides interactive live scorecards, quick result logging, match history, and per-game + overall leaderboards, backed by **MySQL** for persistence and **LDAP** for authentication and player directory synchronization.

### Initial Supported Games
1. **Wizard** — Full round-by-round Bid & Tricks scorecard (automatic `+20 + 10×tricks` / `-10×|diff|` calculation, dealer rotation, optional ±1 forbidden-bid rule indicator, round trick count validation).
2. **Phase 10** — Interactive 10-phase scorecard with built-in Phase 1–10 reference guide, per-player phase advancement, card-point calculator helper, and tie-breaking by lowest penalty score.
3. **Uno** — Dual-mode support:
   - *Quick Log*: Record placements / winner directly.
   - *Multi-Round Scorecard*: Cumulative hand-points tracker (classic 500-point target or lowest-points variant) with card value quick-add helper.
4. **That's Not A Hat** — Dual-mode support:
   - *Quick Log*: Record placements / winner directly.
   - *Multi-Round Scorecard*: Penalty-card / mistake tracker across rounds until the configurable point threshold (default 3 penalty points) is reached; lowest penalty points wins.

---

## 2. Technology Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Router, Lucide React | Fast, responsive mobile-friendly UI (crucial at the game table) with strong typing shared with the backend. |
| **Backend** | Node.js 22 LTS, Express, TypeScript | Unified TypeScript codebase allowing shared modular game definitions between client and server. |
| **Database** | MySQL 8.0 (`mysql2/promise`) | Relational integrity for players, sessions, and leaderboards + JSON columns for modular game state and custom stats. Includes automatic startup migrations. |
| **Authentication & Roster** | LDAP (`ldapts`) + JWT (`jsonwebtoken`, HTTP-only cookie) | Pure TypeScript LDAP client (supports LDAP/LDAPS, bind authentication, and directory roster sync) with zero native C++ build issues in Docker. Supports guest players alongside LDAP users. |
| **Deployment** | Docker (multi-stage `Dockerfile`) + `docker-compose.yml` | Single `app` container (Express API + static React SPA) + `mysql` container, plus an optional `dev-ldap` Docker Compose profile (`osixia/openldap`) pre-seeded with test friends. |

---

## 3. Architecture & Directory Structure

```text
StayGames/
├── PLAN.md                      # Architecture and implementation plan
├── Dockerfile                   # Multi-stage build (shared + server + client -> slim runtime)
├── docker-compose.yml           # Orchestrates app + mysql (+ optional dev-ldap OpenLDAP service)
├── .env.example                 # Documented environment variables (MySQL, JWT, LDAP)
├── docker/
│   └── ldap/
│       └── bootstrap.ldif       # Sample LDAP organizational units & friend accounts for dev-ldap
├── package.json                 # Workspace scripts, shared dependencies, test runner
├── tsconfig.json                # Base TypeScript configuration
├── shared/                      # Isomorphic code shared by frontend & backend
│   ├── types.ts                 # Core interfaces (Player, Session, GameDefinition, Leaderboard)
│   └── games/                   # MODULAR GAME PLUGIN SYSTEM
│       ├── index.ts             # Central game registry & lookup helpers
│       ├── wizard.ts            # Wizard rules, round validator, scoring & custom stats
│       ├── phase10.ts           # Phase 10 phase definitions, progression & tie-break logic
│       ├── uno.ts               # Uno quick-log + 500pt multi-round scorecard engine
│       └── thatsNotAHat.ts      # That's Not A Hat quick-log + penalty round engine
├── server/                      # Express + MySQL + LDAP backend
│   ├── index.ts                 # Server entrypoint & static SPA serving
│   ├── config.ts                # Environment configuration loader & validator
│   ├── db/
│   │   ├── pool.ts              # MySQL connection pool with retry-on-startup logic
│   │   └── migrations.ts        # Idempotent SQL schema migrations
│   ├── services/
│   │   ├── ldapService.ts       # LDAP authentication bind & directory user sync
│   │   ├── playerService.ts     # LDAP user upsert, guest creation, roster queries
│   │   ├── sessionService.ts    # Match creation, live scorecard updates, completion
│   │   └── leaderboardService.ts# Per-game & overall leaderboard aggregation
│   ├── middleware/
│   │   └── auth.ts              # JWT session verification middleware
│   └── routes/
│       ├── auth.ts              # POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
│       ├── players.ts           # GET /api/players, POST /api/players/sync-ldap, POST /api/players/guest
│       ├── games.ts             # GET /api/games (registered modular game metadata)
│       ├── sessions.ts          # CRUD & state updates for live and completed matches
│       └── leaderboards.ts      # GET /api/leaderboards, GET /api/leaderboards/:gameSlug
├── client/                      # React + Vite + Tailwind frontend
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx              # Routing & auth guard
│       ├── api/client.ts        # Typed REST API client
│       ├── context/AuthContext.tsx
│       ├── components/
│       │   ├── Layout.tsx       # Navigation shell (mobile bottom nav + desktop sidebar)
│       │   └── scorecards/      # Modular scorecard UI registry
│       │       ├── ScorecardHost.tsx      # Resolves custom or generic scorecard for any game
│       │       ├── WizardScorecard.tsx    # Bid/Tricks input, dealer badge, round summary
│       │       ├── Phase10Scorecard.tsx   # Phase checklist, reference drawer, card calculator
│       │       ├── UnoScorecard.tsx       # Multi-round hand calculator & target progress bar
│       │       ├── ThatsNotAHatScorecard.tsx # Live penalty round counter & standings
│       │       └── QuickResultForm.tsx    # Reusable placement/score logger for quick games
│       └── pages/
│           ├── LoginPage.tsx        # LDAP sign-in screen
│           ├── DashboardPage.tsx    # Recent matches, resumable live games, quick stats
│           ├── NewGamePage.tsx      # Select game module, mode, config & players/seats
│           ├── ActiveSessionPage.tsx# Live interactive scorecard / match view
│           ├── LeaderboardsPage.tsx # Overall + per-game modular leaderboards
│           ├── HistoryPage.tsx      # Filterable archive of past plays & full scorecards
│           └── PlayersPage.tsx      # Friend roster, LDAP sync trigger & guest management
└── tests/                       # Automated unit & integration tests (Vitest)
    ├── games.test.ts            # Tests Wizard, Phase 10, Uno, That's Not A Hat engines
    └── ldapAndApi.test.ts       # Tests modular registry, leaderboard math & auth flows
```

---

## 4. Modular Game Inclusion Design

To ensure adding a new game requires minimal effort and **zero database schema changes**, every game implements the `GameDefinition<TConfig, TState, TRoundInput>` contract in `shared/games/`:

1. **Metadata & Constraints**:
   - `slug`, `name`, `tagline`, `minPlayers`, `maxPlayers`, `supportedModes` (`'scorecard' | 'quick'`), `scoringDirection` (`'highest_wins' | 'lowest_wins'`), `themeColor`, `iconName`.
2. **Configuration Schema (`configFields`)**:
   - Declarative options rendered automatically on the "New Game" setup screen (e.g., Wizard *Forbidden Total Bid Rule*, Uno *Target Points*, That's Not A Hat *Elimination Threshold*, Phase 10 *Phase Progression Mode*).
3. **Pure State & Scoring Engine**:
   - `createInitialState(players, config)` — Initializes round 1, dealer index, and player trackers.
   - `addRound(state, roundInput, config)` — Validates round inputs (e.g., total Wizard tricks must equal cards dealt) and returns updated immutable state.
   - `undoLastRound(state, config)` — Safely reverts mistakes made at the table.
   - `computeStandings(state, players, config)` — Computes current/final ranks, ties, winners, and display scores.
4. **Modular Leaderboard Metrics**:
   - `extractPlayerStats(state, playerId, standing, config)` — Extracts game-specific JSON metrics stored in `session_players.stats_json` when a game finishes (e.g., Wizard `exactBids`, `totalRounds`, `bestRound`; Phase 10 `phaseReached`, `completedAllPhases`).
   - `leaderboardColumns` — Declarative column definitions so the Leaderboard page automatically renders custom per-game columns (e.g., *Bid Accuracy %* for Wizard, *Avg Phase* for Phase 10) alongside Wins, Games Played, and Win Rate.
5. **UI Pluggability**:
   - `ScorecardHost.tsx` maps `game.slug` to a specialized React scorecard if registered, or falls back to a built-in generic round/quick-log scorecard—meaning simple point-based games work immediately with zero custom React code.

---

## 5. Database Schema (MySQL 8.0)

### `players`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` | Internal player ID |
| `ldap_uid` | `VARCHAR(191) UNIQUE NULL` | Unique LDAP identifier (`uid` / `sAMAccountName`) |
| `ldap_dn` | `VARCHAR(512) NULL` | Distinguished Name in LDAP |
| `username` | `VARCHAR(191) UNIQUE NULL` | Login username |
| `display_name` | `VARCHAR(191) NOT NULL` | Shown on scorecards & leaderboards |
| `email` | `VARCHAR(255) NULL` | Synced from LDAP `mail` attribute |
| `avatar_color` | `VARCHAR(32) NOT NULL` | Deterministic badge color |
| `is_guest` | ` TINYINT(1) NOT NULL DEFAULT 0` | `1` for non-LDAP guest friends |
| `is_active` | `TINYINT(1) NOT NULL DEFAULT 1` | Soft-disable flag |
| `last_synced_at` | `DATETIME NULL` | Timestamp of last LDAP sync/login |
| `created_at` | `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` | Creation timestamp |

### `game_sessions`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` | Match ID |
| `game_slug` | `VARCHAR(64) NOT NULL` | References `GameDefinition.slug` (indexed) |
| `mode` | `ENUM('scorecard', 'quick') NOT NULL` | Full scorecard vs. quick placement log |
| `status` | `ENUM('in_progress', 'completed', 'abandoned') NOT NULL` | Supports saving & resuming live games |
| `config_json` | `JSON NOT NULL` | Selected variant settings for this match |
| `state_json` | `JSON NOT NULL` | Complete round-by-round scorecard state |
| `notes` | `TEXT NULL` | Optional table notes / memorable moments |
| `created_by_player_id` | `INT NULL` | FK -> `players(id)` |
| `started_at` | `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` | Start timestamp |
| `completed_at` | `DATETIME NULL` | Completion timestamp (indexed) |

### `session_players`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` | Row ID |
| `session_id` | `INT NOT NULL` | FK -> `game_sessions(id) ON DELETE CASCADE` |
| `player_id` | `INT NOT NULL` | FK -> `players(id) ON DELETE RESTRICT` |
| `seat_order` | `INT NOT NULL` | Seating / dealer order (`0..N-1`) |
| `final_score` | `DECIMAL(10,2) NULL` | Final score upon completion |
| `placement` | `INT NULL` | `1` = 1st place (ties share rank) |
| `is_winner` | `TINYINT(1) NOT NULL DEFAULT 0` | `1` if winner (supports tied winners) |
| `stats_json` | `JSON NULL` | Modular game-specific metrics for leaderboards |

---

## 6. LDAP Integration Flow

1. **Configuration via Environment Variables**:
   - `LDAP_URL`, `LDAP_BASE_DN`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`
   - `LDAP_USER_SEARCH_BASE`, `LDAP_USER_SEARCH_FILTER` (e.g. `(&(objectClass=inetOrgPerson)(uid={{username}}))`), `LDAP_SYNC_FILTER` (e.g. `(objectClass=inetOrgPerson)`)
   - Attribute mappings: `LDAP_ATTR_UID`, `LDAP_ATTR_USERNAME`, `LDAP_ATTR_DISPLAY_NAME`, `LDAP_ATTR_EMAIL`
2. **User Sign-In**:
   - Backend binds with service credentials (or anonymous if unconfigured), searches for the user entry matching `username`, then performs an LDAP bind as that user's `dn` + supplied password.
   - Upon success, upserts the `players` row (`ldap_uid`, `display_name`, `email`, `last_synced_at`) and issues a signed JWT cookie.
3. **Directory Roster Sync**:
   - `POST /api/players/sync-ldap` queries all directory users matching `LDAP_SYNC_FILTER` and upserts them into `players` so friends appear in game setup even before their first login.
   - Also runs opportunistically on server startup if `LDAP_SYNC_ON_STARTUP=true`.
4. **Local Testing Profile (`dev-ldap`)**:
   - `docker-compose.yml` defines an optional `openldap` container (`docker compose --profile dev-ldap up --build`) seeded with `bootstrap.ldif` containing 5 friend accounts so LDAP login and directory sync can be tested out-of-the-box without external infrastructure.

---

## 7. Implementation Milestones

1. **Project Scaffolding & Shared Game Engine**
   - Initialize TypeScript config, dependencies, and `shared/games/` plugin system.
   - Implement **Wizard**, **Phase 10**, **Uno**, and **That's Not A Hat** modules + unit tests.
2. **Backend API, MySQL Persistence & LDAP Service**
   - Implement MySQL pool + auto-migrations (`players`, `game_sessions`, `session_players`).
   - Implement `ldapService` (`ldapts`), JWT authentication, roster sync, guest players, session lifecycle, and per-game leaderboard aggregation.
3. **React Frontend & Interactive Scorecards**
   - Build responsive UI shell, LDAP Login page, Dashboard, New Game wizard, Players & Sync page, History viewer, and modular Leaderboards page.
   - Build interactive table-ready scorecards for Wizard, Phase 10, Uno, That's Not A Hat, and Quick Result logging.
4. **Dockerization & Verification**
   - Create multi-stage `Dockerfile`, `docker-compose.yml`, `.env.example`, `docker/ldap/bootstrap.ldif`, and `README.md`.
   - Run automated tests, TypeScript checks, production frontend/backend builds, and Docker Compose config verification.
