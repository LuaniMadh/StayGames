import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Play, UserPlus, X } from 'lucide-react';
import type { ConfigField, GameMode, Player } from '../../../shared/types';
import { getGameBySlug } from '../../../shared/games/index';
import { api } from '../api/client';
import { Avatar } from '../components/Avatar';
import { GameBadge, THEME_CLASSES } from '../components/GameIcon';
import { useGames } from '../context/GamesContext';

function ConfigInput({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: any;
  onChange: (v: any) => void;
}) {
  if (field.type === 'boolean') {
    return (
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 accent-indigo-500"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="font-medium">{field.label}</span>
      </label>
    );
  }
  if (field.type === 'radio' || field.display === 'buttons' || field.widget === 'buttons') {
    return (
      <>
        <label className="label">{field.label}</label>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {field.options?.map((o) => {
            const val = typeof o === 'object' && o !== null ? o.value : o;
            const lbl = typeof o === 'object' && o !== null ? o.label : o;
            const selected = (value ?? field.default) === val;
            return (
              <button
                key={val}
                type="button"
                onClick={() => onChange(val)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition border ${
                  selected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-400/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
                }`}
              >
                {lbl}
              </button>
            );
          })}
        </div>
      </>
    );
  }
  if (field.type === 'select') {
    return (
      <>
        <label className="label">{field.label}</label>
        <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => {
            const val = typeof o === 'object' && o !== null ? o.value : o;
            const lbl = typeof o === 'object' && o !== null ? o.label : o;
            return (
              <option key={val} value={val}>
                {lbl}
              </option>
            );
          })}
        </select>
      </>
    );
  }
  if (field.type === 'text') {
    return (
      <>
        <label className="label">{field.label}</label>
        <input
          type="text"
          className="input"
          placeholder={field.placeholder}
          required={field.required}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </>
    );
  }
  return (
    <>
      <label className="label">{field.label}</label>
      <input
        type="number"
        className="input"
        min={field.min}
        max={field.max}
        step={field.step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    </>
  );
}

export function NewGamePage() {
  const { games } = useGames();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [slug, setSlug] = useState<string>(params.get('game') || '');
  const [mode, setMode] = useState<GameMode>('scorecard');
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [configTouched, setConfigTouched] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const game = games.find((g) => g.slug === slug);

  useEffect(() => {
    api.listPlayers().then((r) => setPlayers(r.players)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!slug && games.length > 0) setSlug(games[0].slug);
  }, [games, slug]);

  // Reset mode/config when game changes
  useEffect(() => {
    if (!game) return;
    setMode(game.defaultMode);
    setConfigTouched(false);
  }, [game?.slug]);

  // Recompute defaults (some depend on player count) unless the user edited them
  useEffect(() => {
    if (!game || configTouched) return;
    const def = getGameBySlug(game.slug)?.getDefaultConfig(selected.length) ?? {};
    setConfig(def);
  }, [game?.slug, selected.length, configTouched]);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const move = (idx: number, dir: -1 | 1) =>
    setSelected((s) => {
      const next = [...s];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return s;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const addGuest = async () => {
    if (!guestName.trim()) return;
    try {
      const { player } = await api.createGuest(guestName.trim());
      setPlayers((p) => [...p, player]);
      setSelected((s) => [...s, player.id]);
      setGuestName('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const countOk = game ? selected.length >= game.minPlayers && selected.length <= game.maxPlayers : false;

  const start = async () => {
    if (!game) return;
    setBusy(true);
    setError(null);
    try {
      const { session } = await api.createSession({
        gameSlug: game.slug,
        mode,
        playerIds: selected,
        config,
      });
      navigate(`/sessions/${session.id}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">New Game</h1>

      {/* 1. Game */}
      <section>
        <h2 className="label">1 · Choose game</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {games.map((g) => {
            const t = THEME_CLASSES[g.themeColor];
            const active = g.slug === slug;
            return (
              <button
                key={g.slug}
                onClick={() => setSlug(g.slug)}
                className={`card flex items-center gap-3 text-left transition ${
                  active ? `${t.border} ring-2 ring-offset-0 ${t.soft}` : 'hover:border-slate-600'
                }`}
              >
                <GameBadge game={g} size="sm" />
                <span className="font-semibold">{g.name}</span>
              </button>
            );
          })}
        </div>
        {game && <p className="mt-2 text-sm text-slate-400">{game.description}</p>}
      </section>

      {game && (
        <>
          {/* 2. Mode */}
          <section>
            <h2 className="label">2 · Mode</h2>
            <div className="flex flex-wrap gap-2">
              {game.supportedModes.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={mode === m ? 'btn-primary' : 'btn-secondary'}
                >
                  {m === 'scorecard' ? '📋 Live scorecard' : '⚡ Quick result'}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {mode === 'scorecard'
                ? 'Track every round at the table; scores are calculated automatically.'
                : 'Just enter the final placements (and optional scores) after the game.'}
            </p>
          </section>

          {/* 3. Players */}
          <section>
            <h2 className="label">
              3 · Players ({selected.length}/{game.minPlayers}–{game.maxPlayers})
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card">
                <div className="mb-2 text-xs text-slate-500">Tap to add</div>
                <div className="flex flex-wrap gap-2">
                  {players.map((p) => {
                    const on = selected.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggle(p.id)}
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm transition ${
                          on ? 'bg-indigo-500/30 text-indigo-100' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <Avatar name={p.displayName} color={p.avatarColor} size={20} />
                        {p.displayName}
                        {p.isGuest && <span className="text-[10px] text-slate-500">guest</span>}
                      </button>
                    );
                  })}
                  {players.length === 0 && (
                    <span className="text-sm text-slate-500">No players yet – sync LDAP on the Players page or add a guest.</span>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    className="input"
                    placeholder="Add guest player…"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addGuest()}
                  />
                  <button className="btn-secondary" onClick={addGuest} disabled={!guestName.trim()}>
                    <UserPlus size={16} />
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="mb-2 text-xs text-slate-500">Seating order (first player deals first)</div>
                {selected.length === 0 && <div className="text-sm text-slate-500">No players selected.</div>}
                <ol className="space-y-1.5">
                  {selected.map((id, idx) => {
                    const p = playerById.get(id);
                    if (!p) return null;
                    return (
                      <li key={id} className="flex items-center gap-2 rounded-xl bg-slate-800/60 px-2 py-1.5">
                        <span className="w-5 text-center text-xs text-slate-500">{idx + 1}</span>
                        <Avatar name={p.displayName} color={p.avatarColor} size={24} />
                        <span className="flex-1 truncate text-sm">{p.displayName}</span>
                        <button className="text-slate-400 hover:text-white disabled:opacity-30" disabled={idx === 0} onClick={() => move(idx, -1)}>
                          <ArrowUp size={16} />
                        </button>
                        <button className="text-slate-400 hover:text-white disabled:opacity-30" disabled={idx === selected.length - 1} onClick={() => move(idx, 1)}>
                          <ArrowDown size={16} />
                        </button>
                        <button className="text-slate-400 hover:text-rose-400" onClick={() => toggle(id)}>
                          <X size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </section>

          {/* 4. Config */}
          {game.configFields.filter((f) => mode === 'scorecard' || f.showInQuickMode).length > 0 && (
            <section>
              <h2 className="label">4 · Rules & options</h2>
              <div className="card grid gap-4 md:grid-cols-2">
                {game.configFields
                  .filter((f) => mode === 'scorecard' || f.showInQuickMode)
                  .map((f) => (
                    <div key={f.key}>
                      <ConfigInput
                        field={f}
                        value={config[f.key]}
                        onChange={(v) => {
                          setConfigTouched(true);
                          setConfig((c) => ({ ...c, [f.key]: v }));
                        }}
                      />
                      {f.description && <p className="mt-1 text-xs text-slate-500">{f.description}</p>}
                    </div>
                  ))}
              </div>
            </section>
          )}

          {error && <div className="rounded-xl bg-rose-500/15 p-3 text-rose-300">{error}</div>}

          <button className="btn-primary w-full py-3 text-base md:w-auto" disabled={!countOk || busy} onClick={start}>
            <Play size={18} /> {busy ? 'Starting…' : mode === 'quick' ? 'Continue to results' : 'Start game'}
          </button>
          {!countOk && (
            <p className="text-xs text-slate-500">
              Select between {game.minPlayers} and {game.maxPlayers} players.
            </p>
          )}
        </>
      )}
    </div>
  );
}
