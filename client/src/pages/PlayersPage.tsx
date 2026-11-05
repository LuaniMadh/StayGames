import { useEffect, useState } from 'react';
import { Link2, RefreshCw, Trash2, UserPlus, X } from 'lucide-react';
import type { LdapDirectoryAccount, Player } from '../../../shared/types';
import { api } from '../api/client';
import { Avatar } from '../components/Avatar';

export function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [directoryAccounts, setDirectoryAccounts] = useState<LdapDirectoryAccount[]>([]);
  const [guestName, setGuestName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Guest linking modal state (Feedback #17)
  const [linkingGuest, setLinkingGuest] = useState<Player | null>(null);
  const [selectedLdapUid, setSelectedLdapUid] = useState<string>('');
  const [linkingBusy, setLinkingBusy] = useState(false);

  const load = () =>
    api.listPlayers(true).then((r) => setPlayers(r.players)).catch((e) => setMsg({ type: 'err', text: e.message }));

  useEffect(() => {
    load();
  }, []);

  const sync = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.syncLdap();
      let text = `Synced ${r.totalSynced} users from LDAP.`;
      if (r.totalDeleted) text += ` Removed ${r.totalDeleted} stale account(s).`;
      if (r.totalDeactivated) text += ` Deactivated ${r.totalDeactivated} account(s) with match history.`;
      setMsg({ type: 'ok', text });
      await load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const addGuest = async () => {
    if (!guestName.trim()) return;
    try {
      await api.createGuest(guestName.trim());
      setGuestName('');
      await load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message });
    }
  };

  const toggleActive = async (p: Player) => {
    await api.setPlayerActive(p.id, !p.isActive).catch((e) => setMsg({ type: 'err', text: e.message }));
    await load();
  };

  const deletePlayer = async (p: Player) => {
    if (!window.confirm(`Are you sure you want to remove "${p.displayName}"?`)) return;
    try {
      const res = await api.deletePlayer(p.id);
      setMsg({ type: 'ok', text: res.message });
      await load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message });
    }
  };

  const openLinkModal = async (guest: Player) => {
    setLinkingGuest(guest);
    setSelectedLdapUid('');
    try {
      const res = await api.listDirectoryAccounts();
      setDirectoryAccounts(res.accounts);
      if (res.accounts.length > 0) {
        setSelectedLdapUid(res.accounts[0].uid);
      }
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message });
    }
  };

  const handleLinkGuest = async () => {
    if (!linkingGuest || !selectedLdapUid) return;
    setLinkingBusy(true);
    try {
      await api.linkGuestToLdap(linkingGuest.id, selectedLdapUid);
      setMsg({
        type: 'ok',
        text: `Successfully linked ${linkingGuest.displayName} to LDAP account "${selectedLdapUid}". Past play history and stats have been preserved!`,
      });
      setLinkingGuest(null);
      await load();
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setLinkingBusy(false);
    }
  };

  const ldapPlayers = players.filter((p) => !p.isGuest);
  const guests = players.filter((p) => p.isGuest);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Players & Accounts</h1>
          <p className="text-xs text-slate-400">
            Manage friend profiles, guest accounts, and directory synchronization.
          </p>
        </div>
        <button className="btn-primary" onClick={sync} disabled={busy}>
          <RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Sync from LDAP
        </button>
      </div>

      {msg && (
        <div
          className={`rounded-xl p-3 ${
            msg.type === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Feedback #17 Modal: Link Guest to LDAP Account */}
      {linkingGuest && (
        <div className="card space-y-4 border-indigo-500/50 bg-slate-900/95 ring-2 ring-indigo-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 size={20} className="text-indigo-400" />
              <div>
                <h3 className="font-bold text-slate-100">
                  Link Guest &ldquo;{linkingGuest.displayName}&rdquo; to LDAP Account
                </h3>
                <p className="text-xs text-slate-400">
                  All past scores, games played, and leaderboards under this guest will automatically merge into the LDAP user profile.
                </p>
              </div>
            </div>
            <button className="text-slate-400 hover:text-white" onClick={() => setLinkingGuest(null)}>
              <X size={18} />
            </button>
          </div>

          <div className="space-y-2">
            <label className="label">Choose LDAP Directory Account</label>
            <select
              className="input w-full"
              value={selectedLdapUid}
              onChange={(e) => setSelectedLdapUid(e.target.value)}
              disabled={linkingBusy}
            >
              {directoryAccounts.map((acc) => (
                <option key={acc.uid} value={acc.uid}>
                  {acc.displayName} (@{acc.username}) {acc.linkedPlayerId ? '· (already linked to a profile)' : '· (available)'}
                </option>
              ))}
            </select>
            {directoryAccounts.length === 0 && (
              <p className="text-xs text-slate-500">Loading LDAP directory accounts…</p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
            <button
              className="btn-secondary px-3 py-1.5 text-xs"
              disabled={linkingBusy}
              onClick={() => setLinkingGuest(null)}
            >
              Cancel
            </button>
            <button
              className="btn-primary px-3 py-1.5 text-xs"
              disabled={linkingBusy || !selectedLdapUid}
              onClick={handleLinkGuest}
            >
              {linkingBusy ? 'Merging…' : 'Confirm & Link Account'}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Directory Members */}
        <section className="card">
          <h2 className="mb-3 font-bold">Directory members ({ldapPlayers.length})</h2>
          <ul className="space-y-2">
            {ldapPlayers.map((p) => (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-xl bg-slate-800/50 p-2 ${
                  p.isActive ? '' : 'opacity-50'
                }`}
              >
                <Avatar name={p.displayName} color={p.avatarColor} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.displayName}</div>
                  <div className="truncate text-xs text-slate-500">
                    @{p.username}
                    {p.email ? ` · ${p.email}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button className="btn-secondary px-3 py-1 text-xs" onClick={() => toggleActive(p)}>
                    {p.isActive ? 'Hide' : 'Show'}
                  </button>
                  <button
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-700/50 transition-colors"
                    onClick={() => deletePlayer(p)}
                    title="Remove player"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {ldapPlayers.length === 0 && (
            <p className="text-sm text-slate-500">No LDAP users synced yet.</p>
          )}
        </section>

        {/* Guests with Link option */}
        <section className="card">
          <h2 className="mb-3 font-bold">Guests ({guests.length})</h2>
          <div className="mb-3 flex gap-2">
            <input
              className="input"
              placeholder="Guest name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGuest()}
            />
            <button className="btn-secondary" onClick={addGuest} disabled={!guestName.trim()}>
              <UserPlus size={16} /> Add
            </button>
          </div>
          <ul className="space-y-2">
            {guests.map((p) => (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-xl bg-slate-800/50 p-2 ${
                  p.isActive ? '' : 'opacity-50'
                }`}
              >
                <Avatar name={p.displayName} color={p.avatarColor} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.displayName}</div>
                  <div className="truncate text-xs text-slate-500">Guest player</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    className="btn bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 px-2.5 py-1 text-xs"
                    onClick={() => openLinkModal(p)}
                    title="Link this guest to an LDAP directory account"
                  >
                    <Link2 size={13} /> Link LDAP
                  </button>
                  <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => toggleActive(p)}>
                    {p.isActive ? 'Hide' : 'Show'}
                  </button>
                  <button
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-700/50 transition-colors"
                    onClick={() => deletePlayer(p)}
                    title="Remove guest"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="text-xs text-slate-500">
        Hidden players are kept in history and leaderboards but don’t appear when starting a new game.
      </p>
    </div>
  );
}
