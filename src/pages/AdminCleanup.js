import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Shield,
  Trash2,
  FolderKanban,
  Settings,
  LogOut,
  Loader2,
  Brush,
  FileX2,
  Database,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, getApiErrorMessage } from '../lib/apiMiddleware';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const AUTH_KEYS = ['token', 'refreshToken', 'expiresIn', 'user'];
const STANDARD_WARNING = 'This action cannot be undone. Are you sure you want to proceed?';

const formatFreed = (bytes) => {
  if (!bytes || bytes <= 0) return 'approx. 0 MB';
  if (bytes >= 1048576) return `approx. ${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `approx. ${(bytes / 1024).toFixed(1)} KB`;
  return `approx. ${bytes} B`;
};

const summary = (deleted, bytes) =>
  `Deleted ${deleted} ${deleted === 1 ? 'item' : 'items'} | Freed ${formatFreed(bytes)}`;

const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || '';
  }
};

const actionLabel = (action) => {
  const map = {
    'cleanup.delete_old_logs': 'Delete old logs',
    'cleanup.delete_log': 'Delete single log',
    'cleanup.temp_files': 'Delete temp files',
    'cleanup.orphan_files': 'Delete orphan files',
  };
  return map[action] || action || '—';
};

export default function AdminCleanup() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [stats, setStats] = useState({ log_count: 0, temp_files: { count: 0, bytes: 0 }, orphan_files: { count: 0, bytes: 0 } });
  const [retentionDays, setRetentionDays] = useState('30');
  const [running, setRunning] = useState(null);

  const [pending, setPending] = useState(null); // { key, title, description, confirmLabel }
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');

  const fetchLogs = async () => {
    try {
      const res = await api.get('/admin/cleanup/logs');
      setLogs(res.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to load audit logs'));
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/cleanup/stats');
      setStats(res.data || { log_count: 0, temp_files: { count: 0, bytes: 0 }, orphan_files: { count: 0, bytes: 0 } });
    } catch (error) {
      // Non-fatal — stats are informational.
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runCleanup = async (key, request, onSuccess) => {
    setRunning(key);
    try {
      const res = await request();
      const data = res.data || {};
      const deleted = data.deleted || 0;
      const bytes = data.freed_bytes || 0;
      if (onSuccess) onSuccess();
      toast.success(`${summary(deleted, bytes)}`);
      setRunning(null);
      return data;
    } catch (error) {
      setRunning(null);
      throw error;
    }
  };

  const confirmAndRun = async (key, request, onSuccess) => {
    try {
      await runCleanup(key, request, onSuccess);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Operation failed'));
    }
  };

  const clearBrowserCache = async () => {
    let before = 0;
    let after = 0;
    try {
      const est = await navigator.storage?.estimate?.();
      before = est?.usage || 0;
    } catch {}

    let cleared = 0;

    for (const store of [localStorage, sessionStorage]) {
      const keys = [];
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key && !AUTH_KEYS.includes(key)) keys.push(key);
      }
      keys.forEach((key) => store.removeItem(key));
      cleared += keys.length;
    }

    if ('caches' in window) {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        cleared += cacheKeys.length;
      } catch {}
    }

    try {
      const est = await navigator.storage?.estimate?.();
      after = est?.usage || 0;
    } catch {}

    const freed = Math.max(0, before - after);
    toast.success(`Cleared app & browser cache (${cleared} cached item${cleared === 1 ? '' : 's'}) | Freed ${formatFreed(freed)}`);
  };

  const handleLogout = () => {
    window.dispatchEvent(new Event('bfar:unauthorized'));
  };

  const openConfirm = (key, title, description, confirmLabel = 'Yes, continue', onConfirm) => {
    setPending({ key, title, description, confirmLabel, onConfirm });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FDFF]">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#F8FDFF]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-3 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/20">
              <Brush className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">System Administration</p>
              <h1 className="text-lg font-bold text-slate-900">Data Maintenance</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => navigate('/admin')} className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 sm:inline-flex">
              <Shield className="h-3.5 w-3.5" /> Admin Dashboard
            </button>
            <button onClick={() => navigate('/dashboard')} className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 sm:inline-flex">
              <FolderKanban className="h-3.5 w-3.5" /> Projects
            </button>
            <Button variant="outline" size="sm" onClick={() => navigate('/settings')} className="text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600">
              <Settings className="h-4 w-4" /><span className="hidden sm:inline">Settings</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
              <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full px-3 pb-24 pt-6 sm:px-4">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 px-6 py-8 text-white shadow-2xl shadow-slate-900/20 sm:px-10 sm:py-10">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" />
            <div className="relative">
              <Badge className="mb-3 border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
                <Sparkles className="mr-1 h-3 w-3" /> Admin-only · Manual cleanup tools
              </Badge>
              <h2 className="mb-3 text-3xl font-bold leading-tight">Manual Cleanup Tools</h2>
              <p className="max-w-2xl text-base text-slate-300">
                Clear device cache, manage audit logs, and remove temporary or orphaned files.
                These tools only touch logs, temp files, and cache — core business data
                (beneficiaries, projects, assessments) is never affected.
              </p>
            </div>
          </section>

          {/* Stats */}
          <section className="grid grid-cols-3 gap-4">
            {[
              { label: 'Audit Logs', value: stats.log_count ?? 0, hint: 'stored entries', icon: Database, color: 'from-violet-500 to-purple-600' },
              { label: 'Temp Files', value: stats.temp_files?.count ?? 0, hint: formatFreed(stats.temp_files?.bytes || 0), icon: Brush, color: 'from-amber-500 to-orange-600' },
              { label: 'Orphan Files', value: stats.orphan_files?.count ?? 0, hint: formatFreed(stats.orphan_files?.bytes || 0), icon: FileX2, color: 'from-rose-500 to-red-600' },
            ].map((card) => (
              <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.color} text-white shadow-md`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                <p className="text-sm font-semibold text-slate-600">{card.label}</p>
                <p className="text-xs text-slate-400">{card.hint}</p>
              </div>
            ))}
          </section>

          {/* Cache Management */}
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-cyan-600" /> Cache Management
              </CardTitle>
              <CardDescription>
                Clears locally cached data on this device (browser storage). Your login session is preserved and server data is unaffected.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                className="rounded-xl border-cyan-200 bg-cyan-50 text-cyan-700 hover:border-cyan-300 hover:bg-cyan-100 hover:text-cyan-800"
                disabled={running === 'cache'}
                onClick={() =>
                  openConfirm(
                    'cache',
                    'Clear App & Browser Cache?',
                    `${STANDARD_WARNING} This clears local cached data such as saved analyses and browser caches. You will stay logged in.`
                  )
                }
              >
                {running === 'cache' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brush className="h-4 w-4" />}
                Clear App & Browser Cache
              </Button>
            </CardContent>
            <CardFooter className="text-xs text-slate-400">
              Temporary/browser data only. No Firestore, projects, forms, or responses are modified.
            </CardFooter>
          </Card>

          {/* Audit Logs */}
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-violet-600" /> Audit Logs Management
                <Badge className="bg-violet-50 text-violet-700">{logs.length}</Badge>
              </CardTitle>
              <CardDescription>
                Audit log entries record admin maintenance actions. Delete old entries by age, remove individual rows, or wipe the entire log.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">Older than:</span>
                  <Select value={retentionDays} onValueChange={setRetentionDays}>
                    <SelectTrigger className="w-28 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['30', '60', '90'].map((d) => (
                        <SelectItem key={d} value={d}>{d} days</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl text-slate-700"
                  disabled={running === 'logs-old'}
                  onClick={() =>
                    openConfirm(
                      'logs-old',
                      `Delete Logs Older Than ${retentionDays} Days?`,
                      `${STANDARD_WARNING} All audit log entries older than ${retentionDays} days will be permanently removed.`
                    )
                  }
                >
                  {running === 'logs-old' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete Logs Older Than {retentionDays} Days
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-xl"
                  disabled={running === 'logs-all'}
                  onClick={() => setDeleteAllOpen(true)}
                >
                  {running === 'logs-all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete All Logs
                </Button>
              </div>

              {/* Log table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                {logsLoading ? (
                  <div className="flex items-center justify-center gap-2 p-8 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading logs...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">No audit logs yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">Action</th>
                          <th className="px-4 py-3">Admin</th>
                          <th className="px-4 py-3">Detail</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/60">
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatTime(log.created_at)}</td>
                            <td className="px-4 py-3"><Badge className="bg-slate-100 text-slate-700">{actionLabel(log.action)}</Badge></td>
                            <td className="px-4 py-3 text-slate-700">{log.admin_email}</td>
                            <td className="max-w-[220px] truncate px-4 py-3 text-slate-500">{log.detail}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                title="Delete this log"
                                disabled={running === `log-${log.id}`}
                                onClick={() =>
                                  openConfirm(
                                    `log-${log.id}`,
                                    'Delete This Log Entry?',
                                    `${STANDARD_WARNING} This single audit log entry will be permanently removed.`
                                  )
                                }
                              >
                                {running === `log-${log.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Storage cleanup */}
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileX2 className="h-5 w-5 text-rose-600" /> File Storage Cleanup
              </CardTitle>
              <CardDescription>
                Removes temporary uploads and unreferenced (orphaned) files from storage. Files still linked to responses are never touched.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                className="rounded-xl border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800"
                disabled={running === 'temp'}
                onClick={() =>
                  openConfirm(
                    'temp',
                    'Delete Temporary Files?',
                    `${STANDARD_WARNING} Temporary/trash files under the uploads directory will be permanently removed.`
                  )
                }
              >
                {running === 'temp' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brush className="h-4 w-4" />}
                Delete Temporary Files
              </Button>
              <Button
                variant="outline"
                className="rounded-xl border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800"
                disabled={running === 'orphan'}
                onClick={() =>
                  openConfirm(
                    'orphan',
                    'Delete Unused / Orphaned Files?',
                    `${STANDARD_WARNING} Files in storage not linked to any response record will be permanently removed. Referenced photos are kept.`
                  )
                }
              >
                {running === 'orphan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileX2 className="h-4 w-4" />}
                Delete Unused / Orphaned Files
              </Button>
            </CardContent>
            <CardFooter className="text-xs text-slate-400">
              Candidates: {stats.temp_files?.count ?? 0} temp · {stats.orphan_files?.count ?? 0} orphan
            </CardFooter>
          </Card>

          <div className="flex items-center gap-2 pt-2 text-sm text-slate-500">
            <ArrowLeft className="h-4 w-4" />
            <button onClick={() => navigate('/admin')} className="font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline">
              Back to Admin Dashboard
            </button>
          </div>
        </div>
      </main>

      {/* Single generic confirmation dialog */}
      <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">{pending?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={running === pending?.key}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              disabled={running === pending?.key}
              onClick={async (e) => {
                e.preventDefault();
                const key = pending?.key;
                const onConfirm = pending?.onConfirm;
                setPending(null);
                if (!key) return;
                if (key === 'cache') {
                  await clearBrowserCache();
                  return;
                }
                await confirmAndRun(
                  key,
                  () => {
                    if (key.startsWith('log-')) {
                      const id = key.slice(4);
                      return api.delete(`/admin/cleanup/logs/${id}`);
                    }
                    if (key === 'logs-old') return api.delete(`/admin/cleanup/logs`, { params: { days: retentionDays } });
                    if (key === 'logs-all') return api.delete('/admin/cleanup/logs/all');
                    if (key === 'temp') return api.delete('/admin/cleanup/temp-files');
                    if (key === 'orphan') return api.delete('/admin/cleanup/orphan-files');
                    return Promise.reject(new Error('Unknown action'));
                  },
                  () => {
                    if (key.startsWith('log-') || key === 'logs-old' || key === 'logs-all') {
                      fetchLogs();
                    }
                    fetchStats();
                    if (onConfirm) onConfirm();
                  }
                );
              }}
            >
              {running === 'logs-all' ? 'Deleting...' : pending?.confirmLabel || 'Yes, continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Extra confirmation: Delete All Logs (must type DELETE) */}
      <AlertDialog open={deleteAllOpen} onOpenChange={(open) => { setDeleteAllOpen(open); if (!open) setDeleteAllConfirmText(''); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete ALL Audit Logs?</AlertDialogTitle>
            <AlertDialogDescription>
              {STANDARD_WARNING} This permanently removes every audit log entry. Type <strong>DELETE</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteAllConfirmText}
            onChange={(e) => setDeleteAllConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="rounded-xl"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              disabled={deleteAllConfirmText !== 'DELETE' || running === 'logs-all'}
              onClick={async (e) => {
                e.preventDefault();
                setDeleteAllOpen(false);
                setDeleteAllConfirmText('');
                openConfirm(
                  'logs-all',
                  'Confirm Delete All Logs',
                  'Final confirmation: every audit log entry will be permanently removed. This cannot be undone.'
                );
              }}
            >
              {running === 'logs-all' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
