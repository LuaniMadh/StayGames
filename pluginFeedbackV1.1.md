# StayGames Plugin API Feedback (v1.1): Scoreboard Customization & Visual Analytics

This document provides feedback on the StayGames Plugin API (v1.1.0) based on implementing button-based turn action selection, user-friendly scoreboard formatting, remaining clues and current errors tracking, and hint history tracking for the **Hanabi** plugin.

---

## 1. Input Widget: Button Groups / Radio Buttons (`ConfigField`)

### Context
In games like Hanabi, each player turn consists of choosing exactly one mutually exclusive action from a small set:
- **Correct Fireworks Play** (adds 1 fireworks point)
- **Incorrect Fireworks Play** (adds 1 strike/error)
- **Give Clue** (spends 1 clue/hint token)
- **Discard Card** (recovers 1 clue/hint token)

### The Issue
* In `ConfigField`, `type` is officially documented as `"number" | "boolean" | "select" | "text"`.
* Using `type: "select"` forces a dropdown menu. For rapid gameplay on mobile devices or tablets, dropdowns require two taps and hide available options from view.
* What is needed is **buttons with the behavior of radio buttons** (a segmented button group), where all options are visible simultaneously and selecting one highlights it and unselects the others.

### Recommendation
1. Officially add `type: "radio"` to `ConfigField`.
2. Alternatively (or additionally), support a `display` or `widget` property on `type: "select"`:
   ```json
   {
     "key": "action",
     "label": "Turn Action",
     "type": "radio",
     "display": "buttons",
     "options": [
       { "value": "correct_play", "label": "Correct Fireworks Play" },
       { "value": "incorrect_play", "label": "Incorrect Fireworks Play" },
       { "value": "give_clue", "label": "Give Clue" },
       { "value": "discard", "label": "Discard Card" }
     ],
     "default": "correct_play"
   }
   ```
3. The frontend should render these options as a styled horizontal button group / segmented control.

---

## 2. Scoreboard Option Label Resolution (Internal IDs vs. Display Labels)

### The Issue
* When an option field is defined with `{ value: "correct_play", label: "Correct Fireworks Play" }`, the form payload submitted to `addRound` contains the internal `value` (`"correct_play"`).
* In the session scoreboard table, the UI currently renders the raw internal ID string (`"correct_play"`) instead of the human-readable label (`"Correct Fireworks Play"`).
* This forces plugins to manually maintain a mapping table in `addRound` to rewrite or duplicate properties (e.g. `action: "Correct Fireworks Play"`, `actionLabel: "Correct Fireworks Play"`).

### Recommendation
* The scoreboard renderer should automatically look up the option `label` for fields defined in `roundInputFields` when displaying values in round rows.
* If a plugin defines `{ value, label }`, the UI should display `label` by default, preserving `value` only in the data model.

---

## 3. Scoreboard Column Customization (`scoreboardColumns` / `roundTableColumns`)

### The Issue
* The manifest currently supports `leaderboardColumns` for aggregate lifetime stats, but has **no manifest configuration for the active session's scoreboard table**.
* For Hanabi, players need the scoreboard to display:
  - **Action Taken** (user-friendly label)
  - **Remaining Hints / Clues** (e.g. 8 → 7 → 8)
  - **Current Errors / Strikes** (e.g. 0 → 1)
  - **Fireworks Score** (e.g. 0 → 1 → 2)
* Without a manifest declaration, plugins have to inject numerous fallback property keys into round records (`remainingClues`, `cluesRemaining`, `hints`, `currentErrors`, `errors`, `strikes`) in hopes that the UI picks them up.

### Recommendation
* Add `scoreboardColumns` (or `scorecardColumns`) to `manifestFields`:
  ```json
  "scoreboardColumns": [
    { "key": "action", "label": "Action", "align": "left" },
    { "key": "remainingClues", "label": "Remaining Clues", "align": "center", "format": "integer" },
    { "key": "currentErrors", "label": "Current Errors", "align": "center", "format": "integer" },
    { "key": "teamScore", "label": "Fireworks Score", "align": "right", "format": "integer" }
  ]
  ```

---

## 4. Visual Graphs & Charts for Session Progression

### The Issue
* In Hanabi and other resource-management cooperative games, tracking the **history of available hints/clues over time** is a core visualization requirement.
* Currently, the StayGames Plugin API has no manifest fields, helpers, or hooks to define charts or graphs.
* Plugins can accumulate history arrays in state (e.g., `state.hintHistory = [8, 7, 8, 7, 6, ...]`), but the platform provides no built-in mechanism to display this as a line chart in the session dashboard.

### Recommendation
* Introduce a `charts` manifest property or a `getCharts(state, config)` lifecycle hook:
  ```json
  "charts": [
    {
      "key": "hintHistory",
      "title": "Available Hints History",
      "type": "line",
      "dataKey": "hintHistory",
      "xAxisLabel": "Round",
      "yAxisLabel": "Hints Remaining",
      "yAxisMin": 0,
      "yAxisMax": 8
    },
    {
      "key": "scoreHistory",
      "title": "Fireworks Progress",
      "type": "line",
      "dataKey": "scoreHistory",
      "yAxisMin": 0,
      "yAxisMax": 25
    }
  ]
  ```
* The session view can render interactive SVG/Canvas sparklines or charts above or alongside the scoreboard table using these definitions.
