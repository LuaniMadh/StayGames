# StayGames Plugin API Feedback: Cooperative Games & Hanabi Implementation

> [!NOTE]
> **Resolution Status (API v1.1.0): RESOLVED**
> All primary feedback points below have been addressed in StayGames Plugin API v1.1.0:
> - Added `gameType: "cooperative"` and `cooperative: true` flags for shared team scores and outcomes.
> - Added `roundInputFields` / `roundFields` to dynamically render custom round controls (e.g. clue tokens, strikes).
> - Added `helpers.createCooperativeStandings()` and cooperative tie/win evaluation in `helpers.rankEntries()`.
> - Documented `ConfigField`, `LeaderboardColumnDef`, `StandingEntry`, `TRoundInput`, and `TState` schemas.
> - Added unauthenticated validation endpoint `POST /plugins/api/validate`.

---

## 1. Primary Issue: Lack of Native Support for Cooperative Games

The StayGames scorecard and plugin architecture is currently built around a **competitive, per-player scoring paradigm**, which creates friction for cooperative board/card games such as Hanabi, Pandemic, The Crew, or Just One.

### The Problem
* **Individual Scorecard Inputs in UI:** In scorecard mode, the platform UI prompts for individual scores per player (`roundInput.pointsByPlayer`). In a cooperative game, players work as a single unit towards a **shared team score**. Expecting users to input individual scores per player for each round or splitting team fireworks progress across player columns is unnatural and confusing to players.
* **Manifest Lacks Game Type Flag:** `manifestFields` only provides `scoringDirection: "highest_wins" | "lowest_wins"`. There is no `gameType: "competitive" | "cooperative" | "team"` or `isCooperative: boolean` property to tell the UI and backend that the session is cooperative.
* **Placement & Standings Semantics:** Lifecycle hook `computeStandings` returns an array of `StandingEntry[]` where `helpers.rankEntries` sorts players by score and assigns ordinal ranks (1st, 2nd, etc.) with a single winner flag. In cooperative games:
  * All players share the same team outcome (Win/Loss, or team score tier).
  * There should not be 1st/2nd/3rd place rankings or individual winners vs. losers among teammates.
* **Leaderboards & Player Statistics:** `leaderboardColumns` are aggregated per player rather than per team session. In cooperative games, players want to view team statistics (e.g. highest team fireworks score, team win/loss rate, perfect 25-point games) rather than artificial individual standings.

### Recommended Solution
1. **Manifest Cooperative Flag:** Add `cooperative: true` (or `gameType: "cooperative"`) to `manifestFields`.
2. **Team Score Entry Mode:** When `cooperative: true` is set, the scorecard entry form in the UI should render a **single Team Score / Round Score input** rather than separate columns/fields for each player, passing `{ teamScore: number }` or `{ roundScore: number }` in `roundInput`.
3. **Cooperative Standings Helper:** Provide a helper such as `helpers.createCooperativeStandings(playerIds, teamScore, { isWin })` or support cooperative evaluation in `helpers.rankEntries(entries, { cooperative: true })` where all participants share Rank 1 or a shared win/loss banner.

---

## 2. Inability to Define Custom Round Inputs (Tips & Failures)

The Hanabi implementation requires tracking **clue/tip tokens** (starting with 8, consumed when giving clues, restored when discarding cards) and **strikes/failures** (fuse tokens, 3 strikes triggering an explosion and loss).

### The Problem
* **No `roundInputFields` in Manifest:** While `manifestFields` allows `configFields` (for initial session settings), there is no schema to declare round-level inputs (e.g., `roundInputFields` or `roundSchema`).
* **Unclear `TRoundInput` Schema:** The documentation references `roundInput: TRoundInput` in `addRound` and `editRound`, but the schema is undocumented. In practice, only `pointsByPlayer` is provided by the scorecard UI.
* **No UI Mechanism to Record Tips or Failures:** Because plugins cannot tell the UI what fields exist for each round, the user interface cannot render controls (e.g., steppers or toggles for "Clues Used", "Clue Recovered", or "Strike / Misplay"). Any tip and failure tracking in the plugin code remains invisible or inaccessible unless manually encoded by users into player point inputs.

### Recommended Solution
* Add a `roundFields` or `roundInputFields` array to `manifestFields`, supporting field definitions similar to `configFields`:
  ```json
  "roundFields": [
    { "key": "teamScore", "label": "Points Scored", "type": "number", "min": 0, "max": 25 },
    { "key": "clueAction", "label": "Clue Action", "type": "select", "options": ["none", "give_clue", "discard_recover"] },
    { "key": "isStrike", "label": "Strike / Failure", "type": "boolean" }
  ]
  ```
* The UI can dynamically generate these controls in the "Add Round" dialog and pass the resulting object into `addRound(state, roundInput, playerIds, config)`.

---

## 3. Ambiguities in Type Definitions & Helper Contracts

The specification at `/plugins/api` omits field definitions for several core types:

1. **`ConfigField`:** What property types are supported? (e.g., `number`, `boolean`, `select`, `text`?) Do `select` fields take `options: string[]` or `{ value, label }[]`? What are valid validation keys (`min`, `max`, `step`, `default`)?
2. **`LeaderboardColumnDef`:** What formats are valid for `format` (only `'integer'`, or also `'float'`, `'percentage'`, `'string'`)? What aggregates are supported for `aggregate` (only `'sum'`, or also `'max'`, `'min'`, `'avg'`, `'last'`)?
3. **`StandingEntry`:** What properties does `computeStandings` expect in each entry? (`playerId`, `score`, `rank`, `isWinner`?)
4. **`helpers.rankEntries(entries, options)`:** What options are accepted beyond `{ scoringDirection }`? Does it accept custom tie-breaking or cooperative flags?
5. **Scorecard State Representation (`TState`):** Does the frontend scorecard table expect specific properties on `state` (e.g. `state.totals`, `state.rounds[].points[playerId]`) to render table cells? If so, those required property contracts should be formally specified.

---

## 4. Single-Round vs. Multi-Round Game Workflow

* In Hanabi and similar card/board games, games are often scored only **once at the end of the game** (evaluating final fireworks columns 0–25, remaining clues, and strikes) rather than turn-by-turn.
* The API specification currently only documents multi-round incremental scorecard models (like Skyjo and Coin Toss) or Quick Placement mode. Clarification on how to best model single-tally or final-score cooperative games within the scorecard framework would improve plugin UX.

---

## 5. Development & Testing Workflow

* The validation endpoint `/api/plugins/validate` requires LDAP authentication, preventing automated local test suites or CI verification without active user credentials.
* Having an unauthenticated sandbox validation endpoint or an offline CLI validator package would streamline third-party plugin development.
