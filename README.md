# StayGames 🎲

> [!NOTE]
> **AI-Generated Project:** The entire sourcecode of this repository was AI-generated using the **Antigravity CLI**.

A containerized web platform designed for game nights with your friend group. Manage board and card game sessions, track live round-by-round scorecards, record quick game results, authenticate via LDAP directory accounts, and view overall and per-game leaderboards.

Persisted in **MySQL 8.0** with a modular game architecture.

---

## 🕹️ Supported Games

| Game | Scorecard Features | Quick Mode | Custom Leaderboard Metrics |
| :--- | :--- | :--- | :--- |
| **Wizard** | Bids & Tricks validation, dealer indicator, round trick totals, ±1 forbidden bid rule, undo round. | Winner & placements | Exact Bid Accuracy (%), 0-Bids Hit, Highest Score |
| **Phase 10** | Interactive Phase 1–10 checklist, Phase reference cheat sheet, quick card penalty point calculator, sequential or free-choice order. | Winner & placements | Avg Phases Completed, Phase 10 Clears (10/10) |
| **Uno** | Cumulative score tracking up to target (500 pts), official "Winner Collects" or house-rule "Penalty Hand" modes, card value calculator. | Winner & placements | Hands Won, Win Rate |
| **That's Not A Hat** | Penalty card counter with threshold warning (e.g. 3 penalties), note logging per bluff/mistake, lowest penalties wins. | Winner & placements | Flawless Games (0 penalties), Avg Penalties Taken |

---

## 🚀 Quick Start with Docker

You can run StayGames anywhere without cloning the code repository, just using `docker-compose.yml` and `.env`.

### Standalone Deployment (Recommended)

1. **Download the Compose file and demo configuration:**
   ```bash
   curl -O https://raw.githubusercontent.com/LuaniMadh/StayGames/main/docker-compose.yml
   curl -o .env https://raw.githubusercontent.com/LuaniMadh/StayGames/main/.env.example
   ```

2. **Customize `.env` (optional):**
   Open `.env` and set your preferred passwords, JWT secret, or LDAP credentials.
   *(The demo default works out-of-the-box with pre-seeded users!)*

3. **Pull and launch the container stack:**
   ```bash
   docker compose pull
   docker compose up -d
   ```

This starts:
1. `staygames-app`: React + Express Node application from `ghcr.io/luanimadh/staygames:latest` (port `3000`)
2. `staygames-mysql`: MySQL 8.0 database (port `3306`)
3. `staygames-openldap`: OpenLDAP server pre-seeded with `admin` / `admin` and friend accounts (port `389`)

Access the application in your browser at:
👉 **`http://localhost:3000`**

Sign in with:
- **Username:** `admin`
- **Password:** `admin`

*(Other pre-seeded test friends: `alice`, `bob`, `charlie`, `diana`, `erik` with password `password`)*

---

## 🧩 Adding a New Game (Modular System)

The game system is fully modular and does not require modifying MySQL database tables or creating custom database migrations.

### Option A: Standard Points Game (Zero UI Code Required)
Add a single declaration to `shared/games/index.ts`:

```typescript
import { createSimplePointsGame, registerGame } from './index.js';

registerGame(
  createSimplePointsGame({
    slug: 'skyjo',
    name: 'Skyjo',
    tagline: 'Get the lowest score across card columns',
    description: 'Flip and swap cards to collect the lowest column score.',
    minPlayers: 2,
    maxPlayers: 8,
    scoringDirection: 'lowest_wins',
    defaultTargetScore: 100,
    allowNegative: true,
  })
);
```
It immediately shows up in the New Game picker, uses the generic round scorecard, and calculates standings and leaderboards automatically!

### Option B: Complex Game with Custom Rules & State
1. Implement the `GameDefinition` interface in `shared/games/myGame.ts`.
2. Register it with `registerGame(myGame)` in `shared/games/index.ts`.
3. (Optional) Provide a dedicated React scorecard in `client/src/components/scorecards/` and register it in `ScorecardHost.tsx`.

---

## 🛠️ Local Development

### Prerequisites
- Node.js 22 LTS
- MySQL 8.0 running locally

### Install & Run
```bash
# Install dependencies
npm install

# Run Vitest test suite
npm test

# Typecheck both frontend and backend
npm run typecheck

# Build frontend and server for production
npm run build
```

---

## 👥 Player Management & LDAP
- **Directory Sync:** Users can log in using their LDAP credentials. You can also sync the directory roster anytime via the **Players** screen or automatically on server startup.
- **Guest Players:** Friends outside LDAP can be added on-the-fly from the New Game setup or Players screen without LDAP accounts.
- **Mock Mode:** Set `LDAP_MOCK_MODE=true` in `.env` if you want to develop or test without any LDAP server.
