import { useEffect, useMemo, useState } from 'react';
import { Calendar, Download, Edit2, Tag, Upload, X } from 'lucide-react';
import type { DayLabel, GameSession, Player, SessionStatus } from '../../../shared/types';
import { api } from '../api/client';
import { SessionCard } from '../components/SessionCard';
import { useGames } from '../context/GamesContext';

function toDayString(iso: string | null): string {
  if (!iso) return 'Unknown Date';
  return new Date(iso).toISOString().split('T')[0];
}

function formatDayHeader(dayStr: string): string {
  const d = new Date(dayStr + 'T12:00:00Z');
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function HistoryPage() {
  const { games } = useGames();
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [dayLabels, setDayLabels] = useState<Record<string, string>>({});
  const [gameSlug, setGameSlug] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [status, setStatus] = useState<SessionStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Day label editing
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [dayTitleDraft, setDayTitleDraft] = useState('');
  const [savingDay, setSavingDay] = useState(false);

  // Import / Export state
  const [exporting, setExporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ totalSessions: number; exportedAt?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    api.listPlayers(true).then((r) => setPlayers(r.players)).catch(() => undefined);
    api.listDayLabels().then((r) => {
      const map: Record<string, string> = {};
      for (const l of r.labels) map[l.day] = l.title;
      setDayLabels(map);
    }).catch(() => undefined);
  }, []);

  const loadSessions = () => {
    setLoading(true);
    api
      .listSessions({
        gameSlug: gameSlug || undefined,
        playerId: playerId ? Number(playerId) : undefined,
        status: status || undefined,
        limit: 200,
      })
      .then((r) => setSessions(r.sessions))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSessions();
  }, [gameSlug, playerId, status]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await api.exportSessions();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `staygames-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (!json || !Array.isArray(json.sessions)) {
          throw new Error('Invalid format: File does not contain a "sessions" array.');
        }
        setImportPreview({
          totalSessions: json.sessions.length,
          exportedAt: json.exportedAt,
        });
      } catch (err: any) {
        setError(err.message || 'Invalid JSON file.');
        setImportPreview(null);
        setImportFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      const payload = JSON.parse(text);
      const res = await api.importSessions(payload);
      setImportResult(
        `Import complete! Added ${res.importedCount} session(s) (${res.skippedCount} skipped as duplicate, ${res.createdPlayersCount} new player profiles created).`
      );
      setImportFile(null);
      setImportPreview(null);
      loadSessions();
    } catch (err: any) {
      setError(err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  // Group sessions by day (YYYY-MM-DD)
  const groupedSessions = useMemo(() => {
    const groups: { day: string; sessions: GameSession[] }[] = [];
    const map = new Map<string, GameSession[]>();

    for (const s of sessions) {
      const day = toDayString(s.completedAt ?? s.startedAt);
      if (!map.has(day)) {
        map.set(day, []);
        groups.push({ day, sessions: map.get(day)! });
      }
      map.get(day)!.push(s);
    }
    return groups;
  }, [sessions]);

  const saveDayTitle = async (day: string) => {
    setSavingDay(true);
    try {
      const title = dayTitleDraft.trim() || null;
      await api.setDayLabel(day, title);
      setDayLabels((prev) => {
        const next = { ...prev };
        if (title) next[day] = title;
        else delete next[day];
        return next;
      });
      setEditingDay(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingDay(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Play History</h1>
          <p className="text-xs text-slate-400">
            Past match results, day logs, and score progression.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
            onClick={handleExport}
            disabled={exporting}
            title="Export all played game sessions to JSON"
          >
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export JSON'}
          </button>
          <button
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
            onClick={() => {
              setShowImportModal(true);
              setImportResult(null);
              setError(null);
            }}
            title="Import played game sessions from JSON"
          >
            <Upload size={14} />
            Import Games
          </button>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="card space-y-4 border-indigo-500/40 bg-slate-900/90 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <Upload size={18} className="text-indigo-400" />
              Import Played Games
            </div>
            <button
              className="text-slate-400 hover:text-white"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
                setImportPreview(null);
              }}
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Upload a previously exported StayGames JSON file (`staygames-export-*.json`). Missing players will be automatically registered as guest profiles so match histories link correctly.
          </p>

          <div className="space-y-2">
            <input
              type="file"
              accept=".json,application/json"
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500 cursor-pointer text-xs"
              onChange={onFileSelected}
              disabled={importing}
            />
          </div>

          {importPreview && (
            <div className="rounded-xl bg-slate-800/60 p-3 text-xs space-y-1">
              <div className="font-semibold text-emerald-400">Valid Export File Ready</div>
              <div className="text-slate-300">
                Contains <span className="font-bold text-white">{importPreview.totalSessions}</span> game sessions
                {importPreview.exportedAt ? ` (exported on ${new Date(importPreview.exportedAt).toLocaleDateString()})` : ''}.
              </div>
            </div>
          )}

          {importResult && (
            <div className="rounded-xl bg-emerald-500/15 p-3 text-xs text-emerald-300">
              {importResult}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="btn-secondary px-3 py-1.5 text-xs font-semibold"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
                setImportPreview(null);
              }}
              disabled={importing}
            >
              Close
            </button>
            <button
              className="btn-primary px-3 py-1.5 text-xs font-semibold"
              onClick={handleConfirmImport}
              disabled={importing || !importPreview}
            >
              {importing ? 'Importing…' : 'Confirm Import'}
            </button>
          </div>
        </div>
      )}

      {/* Filter Card */}
      <div className="card grid gap-3 md:grid-cols-3">
        <div>
          <label className="label">Game</label>
          <select className="input" value={gameSlug} onChange={(e) => setGameSlug(e.target.value)}>
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.slug} value={g.slug}>{g.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Player</label>
          <select className="input" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Everyone</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as SessionStatus | '')}>
            <option value="">Any status</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In progress</option>
          </select>
        </div>
      </div>

      {error && <div className="rounded-xl bg-rose-500/15 p-3 text-rose-300">{error}</div>}

      {loading ? (
        <div className="text-slate-400">Loading sessions…</div>
      ) : groupedSessions.length === 0 ? (
        <div className="card text-slate-400">No games match these filters.</div>
      ) : (
        <div className="space-y-8">
          {groupedSessions.map(({ day, sessions: daySessions }) => {
            const label = dayLabels[day];
            const isEditing = editingDay === day;

            return (
              <section key={day} className="space-y-3">
                {/* Day Header with Feedback #12: Name a given date */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Calendar size={18} className="text-indigo-400" />
                    <span className="font-bold text-slate-200">{formatDayHeader(day)}</span>
                    {label && !isEditing && (
                      <span className="flex items-center gap-1 rounded-full bg-indigo-500/20 px-3 py-0.5 text-xs font-bold text-indigo-300 border border-indigo-500/30">
                        <Tag size={12} /> {label}
                      </span>
                    )}
                  </div>

                  {!isEditing && (
                    <button
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300"
                      onClick={() => {
                        setEditingDay(day);
                        setDayTitleDraft(label || '');
                      }}
                      title="Name this game night or session"
                    >
                      <Edit2 size={13} /> {label ? 'Rename day' : '+ Name this day'}
                    </button>
                  )}
                </div>

                {/* Day Title Edit Box */}
                {isEditing && (
                  <div className="card flex flex-wrap items-center gap-2 border-indigo-500/40 bg-slate-900/90 p-3">
                    <span className="text-xs text-slate-400">Session name:</span>
                    <input
                      className="input flex-1 min-w-[200px]"
                      placeholder="e.g. Ski Trip Game Night, Birthday Party, Friday Wizard Brawl…"
                      value={dayTitleDraft}
                      onChange={(e) => setDayTitleDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveDayTitle(day)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        className="btn-secondary px-3 py-1.5 text-xs"
                        disabled={savingDay}
                        onClick={() => setEditingDay(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn-primary px-3 py-1.5 text-xs"
                        disabled={savingDay}
                        onClick={() => saveDayTitle(day)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {/* Sessions in this day */}
                <div className="grid gap-3 md:grid-cols-2">
                  {daySessions.map((s) => (
                    <SessionCard key={s.id} session={s} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
