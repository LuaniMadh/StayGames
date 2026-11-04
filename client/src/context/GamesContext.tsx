import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  computeQuickStandings,
  createCooperativeStandings,
  createEmptyQuickState,
  createSimplePointsGame,
  isQuickState,
  rankEntries,
  registerGame,
} from '../../../shared/games/index';
import type { GameMetadata } from '../../../shared/types';
import { api } from '../api/client';

interface GamesContextValue {
  games: GameMetadata[];
  bySlug: Record<string, GameMetadata>;
  loading: boolean;
  refreshGames: () => Promise<void>;
}

const GamesContext = createContext<GamesContextValue>({
  games: [],
  bySlug: {},
  loading: true,
  refreshGames: async () => {},
});

export function registerPluginInClient(codeJs: string): void {
  try {
    const mod = { exports: {} as any };
    const exp = {} as any;
    const helpers = {
      computeQuickStandings,
      createCooperativeStandings,
      createEmptyQuickState,
      createSimplePointsGame,
      isQuickState,
      rankEntries,
    };
    const fn = new Function('module', 'exports', 'helpers', codeJs);
    fn(mod, exp, helpers);
    let exported = mod.exports;
    if (!exported || (typeof exported === 'object' && Object.keys(exported).length === 0)) {
      exported = exp.default || exp;
    }
    const def = typeof exported === 'function' ? exported(helpers) : exported;
    if (def && typeof def === 'object' && def.slug) {
      registerGame(def);
    }
  } catch (err) {
    console.warn('[GamesContext] Client plugin evaluation notice:', err);
  }
}

export function GamesProvider({ children }: { children: ReactNode }) {
  const [games, setGames] = useState<GameMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshGames = useCallback(async () => {
    try {
      // Also fetch and evaluate installed plugins into the client registry
      try {
        const { plugins } = await api.listPlugins();
        for (const p of plugins) {
          if (p.enabled && p.codeJs) {
            registerPluginInClient(p.codeJs);
          }
        }
      } catch {
        // Non-fatal if plugins endpoint isn't accessible yet
      }

      const res = await api.listGames();
      setGames(res.games);
    } catch {
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshGames();
  }, [refreshGames]);

  const bySlug = useMemo(
    () => Object.fromEntries(games.map((g) => [g.slug, g])),
    [games]
  );

  return (
    <GamesContext.Provider value={{ games, bySlug, loading, refreshGames }}>
      {children}
    </GamesContext.Provider>
  );
}

export function useGames(): GamesContextValue {
  return useContext(GamesContext);
}
