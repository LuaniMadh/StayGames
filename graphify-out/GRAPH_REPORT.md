# Graph Report - StayGames  (2026-11-04)

## Corpus Check
- 69 files · ~43,831 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .css 1)

## Summary
- 483 nodes · 1190 edges · 25 communities (16 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- types.ts
- leaderboardService.ts
- types.ts
- sessionService.ts
- compilerOptions
- devDependencies
- compilerOptions
- StayGames — Implementation Plan
- openldap
- dependencies
- scripts
- react
- package.json
- ref_node_path
- postcss@^8.4.49
- StayGames 🎲
- vite.config.ts
- @types/cookie-parser@^1.4.7
- @types/express@^4.17.21
- StayGames Plugin API Feedback: Cooperative Games & Hanabi Implementation
- @types/jsonwebtoken@^9.0.7
- @types/react@^18.3.18

## God Nodes (most connected - your core abstractions)
1. `getPool()` - 31 edges
2. `react` - 20 edges
3. `getGameBySlug()` - 19 edges
4. `lucide-react` - 18 edges
5. `Avatar()` - 17 edges
6. `useGames()` - 17 edges
7. `rankEntries()` - 15 edges
8. `GameBadge()` - 14 edges
9. `compilerOptions` - 14 edges
10. `App()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `The Problem` --references--> `rankEntries()`  [INFERRED]
  pluginFeedback.md → shared/games/helpers.ts
- `Option B: Complex Game with Custom Rules & State` --references--> `GameDefinition`  [INFERRED]
  README.md → shared/types.ts
- `StayGames Plugin API Feedback: Cooperative Games & Hanabi Implementation` --references--> `createCooperativeStandings()`  [INFERRED]
  pluginFeedback.md → shared/games/helpers.ts
- `StayGames Plugin API Feedback: Cooperative Games & Hanabi Implementation` --references--> `rankEntries()`  [INFERRED]
  pluginFeedback.md → shared/games/helpers.ts
- `Recommendation` --references--> `ConfigField`  [INFERRED]
  pluginFeedbackV1.1.md → shared/types.ts

## Import Cycles
- None detected.

## Communities (25 total, 9 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.06
Nodes (60): GamesContext, GamesProvider(), registerPluginInClient(), escapeHtml(), PLUGIN_SPECIFICATION, renderHtmlDocumentation(), BUILT_IN_SLUGS, compilePluginCode() (+52 more)

### Community 1 - "leaderboardService.ts"
Cohesion: 0.07
Nodes (55): AuthContextValue, RFC-4515, mysql2@^3.11.5, express, jsonwebtoken, mysql2, createApp(), config (+47 more)

### Community 2 - "types.ts"
Cohesion: 0.11
Nodes (49): api, ApiError, request(), App(), Avatar(), GameBadge(), GameIcon(), THEME_CLASSES (+41 more)

### Community 4 - "sessionService.ts"
Cohesion: 0.37
Nodes (16): getPool(), appendSessionRound(), completeSession(), createSession(), deleteSession(), editSessionRound(), getSessionById(), hydrateSessions() (+8 more)

### Community 5 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+7 more)

### Community 6 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer@^10.4.20, supertest@^7.0.0, tailwindcss@^3.4.17, tsx@^4.19.2, @types/cors@^2.8.17, @types/node@^22.10.2, @types/react-dom@^18.3.5 (+7 more)

### Community 7 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir, resolveJsonModule (+5 more)

### Community 8 - "StayGames — Implementation Plan"
Cohesion: 0.15
Nodes (12): 1. Overview & Goals, 2. Technology Stack, 3. Architecture & Directory Structure, 4. Modular Game Inclusion Design, 5. Database Schema (MySQL 8.0), 6. LDAP Integration Flow, 7. Implementation Milestones, `game_sessions` (+4 more)

### Community 9 - "openldap"
Cohesion: 0.05
Nodes (48): build, container_name, depends_on, environment, ports, restart, context, dockerfile (+40 more)

### Community 10 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, cookie-parser@^1.4.7, cors@^2.8.5, dotenv@^16.4.7, express@^4.21.2, jsonwebtoken@^9.0.2, ldapts@^7.3.1, lucide-react@^0.468.0 (+10 more)

### Community 11 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, build:client, build:server, dev:client, dev:server, start, test (+1 more)

### Community 12 - "react"
Cohesion: 0.14
Nodes (24): PlayerHeader(), ScorecardProps, SplitScoreStepper(), zeroMap(), GenericPointsScorecard(), getDefaultCustomValues(), ProgressionChart(), CARD_BUTTONS (+16 more)

### Community 13 - "package.json"
Cohesion: 0.17
Nodes (11): description, @types/supertest@^6.0.2, typescript@^5.7.2, vitest@^2.1.8, name, private, type, version (+3 more)

### Community 16 - "StayGames 🎲"
Cohesion: 0.15
Nodes (12): 1. Copy Environment Configuration, 2. Launch with Docker Compose, 🧩 Adding a New Game (Modular System), Install & Run, 🛠️ Local Development, Option A: Standard Points Game (Zero UI Code Required), Option B: Complex Game with Custom Rules & State, 👥 Player Management & LDAP (+4 more)

### Community 17 - "vite.config.ts"
Cohesion: 0.40
Nodes (4): vite@^6.0.5, @vitejs/plugin-react@^4.3.4, vite, @vitejs/plugin-react

### Community 21 - "StayGames Plugin API Feedback: Cooperative Games & Hanabi Implementation"
Cohesion: 0.08
Nodes (27): 1. Primary Issue: Lack of Native Support for Cooperative Games, 2. Inability to Define Custom Round Inputs (Tips & Failures), 3. Ambiguities in Type Definitions & Helper Contracts, 4. Single-Round vs. Multi-Round Game Workflow, 5. Development & Testing Workflow, Recommended Solution, Recommended Solution, StayGames Plugin API Feedback: Cooperative Games & Hanabi Implementation (+19 more)

## Knowledge Gaps
- **1 isolated node(s):** `RFC-4515`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 162 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ConfigField` connect `StayGames Plugin API Feedback: Cooperative Games & Hanabi Implementation` to `types.ts`, `types.ts`, `react`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `RFC-4515` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06185919343814081 - nodes in this community are weakly interconnected._
- **Why does `react` connect `types.ts` to `types.ts`, `dependencies`, `react`, `package.json`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `leaderboardService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0669710806697108 - nodes in this community are weakly interconnected._
- **Why does `GameDefinition` connect `types.ts` to `StayGames 🎲`, `leaderboardService.ts`, `types.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11082693947144075 - nodes in this community are weakly interconnected._