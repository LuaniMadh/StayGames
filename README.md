# StayGames 🎲

> [!NOTE]
> **AI-Generated Project:** The entire sourcecode of this repository was AI-generated using the **Antigravity CLI**.

A containerized, self-hosted web platform designed for game nights with your friend group. Manage board and card game sessions, track live round-by-round scorecards, record quick game results, authenticate via LDAP/Active Directory/LLDAP, and view overall and per-game leaderboards.

Persisted in **MySQL 8.0** with a modular game engine and sandboxed JavaScript plugin system.

---

## 🕹️ Supported Games

| Game | Scorecard Features | Quick Mode | Custom Leaderboard Metrics |
| :--- | :--- | :--- | :--- |
| **Wizard** | Bids & Tricks validation, dealer indicator, round trick totals, ±1 forbidden bid rule, undo round. | Winner & placements | Exact Bid Accuracy (%), 0-Bids Hit, Highest Score |
| **Phase 10** | Interactive Phase 1–10 checklist, Phase reference cheat sheet, quick card penalty point calculator, sequential or free-choice order. | Winner & placements | Avg Phases Completed, Phase 10 Clears (10/10) |
| **Uno** | Cumulative score tracking up to target (500 pts), official "Winner Collects" or house-rule "Penalty Hand" modes, card value calculator. | Winner & placements | Hands Won, Win Rate |
| **That's Not A Hat** | Penalty card counter with threshold warning (e.g. 3 penalties), note logging per bluff/mistake, lowest penalties wins. | Winner & placements | Flawless Games (0 penalties), Avg Penalties Taken |
| **Dynamic Plugins** *(e.g. Hanabi, Rock Paper Scissors)* | Custom round input fields, dynamic action tokens (clues, strikes), cooperative loss/victory detection, line chart trends. | Winner & placements | Defined per plugin manifest |

---

## 🚀 Quick Start with Docker

You can run StayGames anywhere without cloning the source code, using just `docker-compose.yml` and a `.env` file.

### Standalone Deployment (Zero Clone Required)

1. **Download the Compose file and demo configuration:**
   ```bash
   curl -O https://raw.githubusercontent.com/LuaniMadh/StayGames/main/docker-compose.yml
   curl -o .env https://raw.githubusercontent.com/LuaniMadh/StayGames/main/.env.example
   ```

2. **Customize `.env`:**
   Open `.env` and set your preferred database passwords, JWT secret, and LDAP configuration.
   *(The demo default works out-of-the-box with an inlined dummy OpenLDAP directory!)*

3. **Pull and launch the container stack:**
   ```bash
   docker compose pull
   docker compose up -d
   ```

Access the application in your browser at:
👉 **`http://localhost:3000`** (or your mapped port)

Default credentials (with internal demo LDAP):
- **Username:** `admin`
- **Password:** `admin`

*(Other pre-seeded test friends: `alice`, `bob`, `charlie`, `diana`, `erik` with password `password`)*

---

## 👥 Player Management & LDAP / LLDAP

StayGames connects seamlessly to OpenLDAP, Active Directory, FreeIPA, Authentik, and **LLDAP** (Light LDAP).

### Key Features:
- **Group Filtering (`memberOf`):** Restrict roster synchronization and login permissions strictly to a specific group (e.g. `cn=people,ou=groups,dc=example,dc=com`).
- **Auto-Pruning on Sync:** When a user is removed from your LDAP group:
  - Users with **0 match history** are automatically purged from the database.
  - Users with **existing match records** are soft-deactivated (`is_active = 0`) to preserve historical scores and leaderboards while hiding them from active game setups.
- **Guest Profiles:** Friends outside LDAP can be added on-the-fly from the New Game setup or Players screen.
- **Guest-to-LDAP Linking:** If a guest later gets an LDAP account, you can link their profile in **Players** → **Link LDAP** to preserve all past game history, wins, and stats under their new login.
- **Mock Mode:** Set `LDAP_MOCK_MODE=true` in `.env` to develop or test completely offline without any LDAP server.

### Example: Connecting to LLDAP
```env
LDAP_URL=ldap://lldap:3890
LDAP_BASE_DN=dc=negraszus,dc=eu

# Bind credentials (LLDAP user accounts reside in ou=people)
LDAP_BIND_DN=uid=staygames,ou=people,dc=negraszus,dc=eu
LDAP_BIND_PASSWORD=your_service_password

# Search base must target ou=people
LDAP_USER_SEARCH_BASE=ou=people,dc=negraszus,dc=eu

# Only allow and sync members of the "people" group:
LDAP_SYNC_FILTER=(&(objectClass=person)(memberOf=cn=people,ou=groups,dc=negraszus,dc=eu))
LDAP_USER_SEARCH_FILTER=(&(objectClass=person)(uid=%s)(memberOf=cn=people,ou=groups,dc=negraszus,dc=eu))

LDAP_ATTR_UID=uid
LDAP_ATTR_USERNAME=uid
LDAP_ATTR_DISPLAY_NAME=displayName
LDAP_ATTR_EMAIL=mail
```

---

## 🧩 Game Extensibility: Modular Types & Plugins

### 1. Dynamic JavaScript Plugins (`plugins/`)
Drop or upload `.js` or `.json` plugin files (see [`plugins/hanabi.js`](plugins/hanabi.js) and [`plugins/rps.js`](plugins/rps.js)):
- **Public Sandbox Validation API:** Verify your plugin before installing via:
  ```bash
  curl -X POST https://your-staygames-host/plugins/api/validate \
    -H "Content-Type: text/javascript" \
    --data-binary @plugins/mygame.js
  ```
- **Public API Documentation:** Inspect documentation and runtime helpers at `/plugins/api` (HTML or `?format=json`).
- Supports cooperative and competitive games, custom round input controls (radios, selects, numbers, booleans), custom score progression charts, and customized leaderboard aggregations.

### 2. Built-in Simple Points Games (Zero UI Code Required)
Add a single declaration to `shared/games/index.ts`:
```typescript
import { createSimplePointsGame, registerGame } from './index.js';

registerGame(
  createSimplePointsGame({
    slug: 'skyjo',
    name: 'Skyjo',
    tagline: 'Get the lowest score across card columns',
    minPlayers: 2,
    maxPlayers: 8,
    scoringDirection: 'lowest_wins',
    defaultTargetScore: 100,
    allowNegative: true,
  })
);
```

---

## 📦 Container Publishing & CI/CD (GHCR)

The production container image is published to GitHub Container Registry:
👉 **`ghcr.io/luanimadh/staygames:latest`**

### Automated Publishing (GitHub Actions)
Every `git push` to the `main` branch automatically runs Vitest tests, typechecks client and server, builds the container, and publishes it with tags:
- `:latest`
- `:sha-<commit>`
- `:main`

### Manual Publishing Script
You can build and publish directly to GHCR using the provided helper script:

```bash
# Using npm shortcut:
npm run publish:image

# Or execute script directly with options:
./scripts/publish-image.sh v1.0.1 --platform linux/amd64

# Fast publish skipping unit tests:
./scripts/publish-image.sh --skip-tests
```

#### What you need for manual publishing:
- Ensure your user is in the `docker` group (`sudo usermod -aG docker $USER`).
- Either have `gh auth login` completed, or set `export CR_PAT=your_github_token` (with `write:packages` scope).

---

## 🛠️ Local Development

### Prerequisites
- Node.js 22 LTS
- MySQL 8.0 running locally or in Docker

### Install & Run
```bash
# 1. Install dependencies
npm install

# 2. Run Vitest test suite
npm test

# 3. Typecheck both client and server TypeScript
npm run typecheck

# 4. Start backend with auto-reload (port 3000)
npm run dev:server

# 5. Start Vite frontend dev server (port 5173)
npm run dev:client
```

---

## 📜 License
Distributed under the MIT License.
