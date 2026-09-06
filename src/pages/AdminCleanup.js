import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Activity,
  Users,
  History,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  SlidersHorizontal,
  BarChart3,
  HardDrive,
  Gauge,
  Clock,
  ClipboardList,
  FileSpreadsheet,
  Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, getApiErrorMessage } from '../lib/apiMiddleware';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
const EXPECTED_AUDIT_MSG =
  'Core business data (users, sessions, projects, forms, responses, reports, organizations) is NEVER cleaned. Only activity/log records, temp files, and unreferenced storage files are removed.';

const CATEGORY_OPTIONS = [
  {
    key: 'activity_logs',
    label: 'Unified Activity Logs',
    description: 'Single combined log of every user and admin action: logins, logouts, account, forms, projects, reports, admin actions.',
    icon: Activity,
    color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    storage: false,
  },
  {
    key: 'responses_old',
    label: 'Survey Responses (old)',
    description: 'Complete response records older than the selected age, across all questionnaires. Referenced photos are also removed. The single biggest database consumer.',
    icon: ClipboardList,
    color: 'text-sky-600 bg-sky-50 border-sky-200',
    storage: false,
    needsAge: true,
  },
  {
    key: 'responses_empty',
    label: 'Empty / No-Answer Responses',
    description: 'Draft/testing/blank responses that carry no meaningful answers but still occupy a database record.',
    icon: FileSpreadsheet,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    storage: false,
  },
  {
    key: 'profile_photos',
    label: 'Profile Photos (storage)',
    description: 'Respondent profile photos on the local uploads disk. Large/orphaned photos are removed — the top disk-space consumer.',
    icon: HardDrive,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    storage: true,
  },
  {
    key: 'orphan_files',
    label: 'Unused / Orphaned Files',
    description: 'Uploaded photos not linked to any response record. Referenced photos are always kept.',
    icon: FileX2,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    storage: true,
  },
];

const AGE_PRESETS = [
  { value: '7', label: 'Older than 7 days' },
  { value: '30', label: 'Older than 30 days' },
  { value: '60', label: 'Older than 60 days' },
  { value: '90', label: 'Older than 90 days' },
  { value: '180', label: 'Older than 6 months' },
  { value: '365', label: 'Older than 1 year' },
];

const ACTIVITY_CATEGORY_LABELS = {
  auth: 'Authentication',
  account: 'Account',
  form: 'Forms',
  project: 'Projects',
  report: 'Reports',
  admin: 'Admin Mgmt',
  cleanup: 'Cleanup',
  system: 'System',
};

const USER_TYPE_LABELS = {
  admin: 'Admins',
  user: 'Registered Users',
};

const COLORS = [
  'bg-cyan-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-slate-500',
];

const formatFreed = (bytes) => {
  if (!bytes || bytes <= 0) return '~0 KB';
  if (bytes >= 1048576) return `~${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `~${(bytes / 1024).toFixed(1)} KB`;
  return `~${bytes} B`;
};

const formatCount = (n) => (typeof n === 'number' ? n.toLocaleString() : '0');

const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || '';
  }
};

const formatEpoch = (ts) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
};

const activityLabel = (entry) => {
  const map = {
    login: 'Login',
    login_failed: 'Failed Login',
    logout: 'Logout',
    register: 'Register',
    cleanup: 'Cleanup',
  };
  return map[entry] || entry || '—';
};

const emptyStats = {
  activity_count: 0,
  cleanup_history_count: 0,
  temp_files: { count: 0, bytes: 0 },
  orphan_files: { count: 0, bytes: 0 },
  profile_photos: { count: 0, bytes: 0 },
  activity_breakdown: { by_category: {}, by_user_type: {} },
  cleanable: {},
};

export default function AdminCleanup({ embedded = false }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(emptyStats);
  const [statsLoading, setStatsLoading] = useState(true);

  const [spaceReport, setSpaceReport] = useState(null);
  const [spaceReportLoading, setSpaceReportLoading] = useState(false);

  // Unified cleanup builder state
  const [selectedCategories, setSelectedCategories] = useState(['activity_logs', 'responses_empty', 'orphan_files']);
  const [rangeMode, setRangeMode] = useState('age'); // 'age' | 'custom'
  const [ageDays, setAgeDays] = useState('90');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [executeOpen, setExecuteOpen] = useState(false);

  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Unified activity-log viewer state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFilter, setLogsFilter] = useState({ user_type: '', search: '' });
  const [retentionDays, setRetentionDays] = useState('30');
  const [running, setRunning] = useState(null);
  const [pending, setPending] = useState(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/cleanup/stats');
      setStats({ ...emptyStats, ...(res.data || {}) });
    } catch (error) {
      // Non-fatal — stats are informational.
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchSpaceReport = useCallback(async () => {
    setSpaceReportLoading(true);
    try {
      const res = await api.get('/admin/cleanup/space-report');
      setSpaceReport(res.data || null);
    } catch (error) {
      // Non-fatal — space report is informational.
    } finally {
      setSpaceReportLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await api.get('/admin/cleanup/activity-logs', { params: logsFilter });
      setLogs(res.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to load activity logs'));
    } finally {
      setLogsLoading(false);
    }
  }, [logsFilter]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/admin/cleanup/history');
      setHistory(res.data?.history || []);
    } catch (error) {
      // Non-fatal.
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchStats();
    fetchSpaceReport();
    fetchHistory();
  }, [fetchStats, fetchSpaceReport, fetchHistory]);

  useEffect(() => {
    fetchStats();
    fetchSpaceReport();
    fetchLogs();
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Preview / Execute ----
  const buildFilterBody = () => {
    if (rangeMode === 'custom') {
      if (!fromDate || !toDate) {
        toast.error('Select both a start and end date for the custom range.');
        return null;
      }
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      return { from: from.getTime(), to: to.getTime() };
    }
    return { age_days: Number(ageDays) };
  };

  const runPreview = async () => {
    if (selectedCategories.length === 0) {
      toast.error('Select at least one category to preview.');
      return;
    }
    const filter = buildFilterBody();
    if (!filter) return;
    setPreviewing(true);
    setPreview(null);
    setExecutionResult(null);
    try {
      const res = await api.post('/admin/cleanup/preview', {
        categories: selectedCategories,
        ...filter,
      });
      setPreview(res.data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to preview cleanup'));
    } finally {
      setPreviewing(false);
    }
  };

  const performExecute = async () => {
    const filter = buildFilterBody();
    if (!filter) return;
    setExecuting(true);
    try {
      const res = await api.post('/admin/cleanup/execute', {
        categories: selectedCategories,
        ...filter,
      });
      const data = res.data || {};
      setExecutionResult(data);
      setPreview(null);
      refreshAll();
      toast.success(`Cleanup complete — ${formatCount(data.total_deleted)} item(s) removed, ${formatFreed(data.freed_bytes)} freed.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Cleanup failed'));
    } finally {
      setExecuting(false);
    }
  };

  const previewTotal = useMemo(() => preview?.total_records ?? 0, [preview]);
  const previewSelectedCounts = useMemo(() => {
    const map = {};
    (preview?.categories || []).forEach((c) => {
      map[c.category] = { records: c.records, est_bytes: c.est_bytes, affected_users: c.affected_users, oldest: c.oldest, newest: c.newest };
    });
    return map;
  }, [preview]);

  const storedCount = (key) => {
    if (key === 'profile_photos') return stats.profile_photos?.count ?? 0;
    if (key === 'orphan_files') return stats.orphan_files?.count ?? 0;
    if (key === 'temp_files') return stats.temp_files?.count ?? 0;
    if (key === 'responses_empty') return stats.cleanable?.responses_empty ?? 0;
    return stats.cleanable?.[key] ?? 0;
  };

  const storedBytes = (key) => {
    if (key === 'profile_photos') return stats.profile_photos?.bytes ?? 0;
    if (key === 'orphan_files') return stats.orphan_files?.bytes ?? 0;
    if (key === 'temp_files') return stats.temp_files?.bytes ?? 0;
    return 0;
  };

  // ---- Quick actions ----
  const runCleanup = async (key, request, onSuccess) => {
    setRunning(key);
    try {
      const res = await request();
      const data = res.data || {};
      const deleted = data.deleted || 0;
      const bytes = data.freed_bytes || 0;
      if (onSuccess) onSuccess();
      toast.success(`Deleted ${deleted} ${deleted === 1 ? 'item' : 'items'} | Freed ${formatFreed(bytes)}`);
      setRunning(null);
      refreshAll();
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
    refreshAll();
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleLogout = () => {
    window.dispatchEvent(new Event('bfar:unauthorized'));
  };

  const openConfirm = (key, title, description, confirmLabel = 'Yes, continue', onConfirm) => {
    setPending({ key, title, description, confirmLabel, onConfirm });
  };

  const maxCategoryCount = useMemo(
    () => Math.max(1, ...Object.values(stats.activity_breakdown?.by_category || {}).map((v) => Number(v) || 0)),
    [stats.activity_breakdown]
  );
  const maxUserTypeCount = useMemo(
    () => Math.max(1, ...Object.values(stats.activity_breakdown?.by_user_type || {}).map((v) => Number(v) || 0)),
    [stats.activity_breakdown]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FDFF]">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  const content = (
    <div className="space-y-4">
          {/* ================= HERO ================= */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 px-6 py-6 text-white shadow-2xl shadow-slate-900/20 sm:px-10 sm:py-7">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" />
            <div className="relative">
              <Badge className="mb-3 border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
                <Sparkles className="mr-1 h-3 w-3" /> Admin-only · Space-maximizing data maintenance
              </Badge>
              <h2 className="mb-2 text-2xl font-bold leading-tight sm:text-3xl">Reclaim Data &amp; Storage</h2>
              <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
                A single data-maintenance tool driven by the <strong className="text-white">real contents of your database and storage</strong> —
                it ranks the biggest storage consumers (response documents, form metadata, photo files), lets you
                <strong className="text-white"> preview and remove old/empty responses, logs and unreferenced files</strong>, and records
                every run. Core business data is never touched.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-2 text-xs text-cyan-200">
                  <ShieldCheck className="h-4 w-4" /> Admin-only (server enforced)
                </div>
                <div className="flex items-center gap-2 text-xs text-cyan-200">
                  <Clock className="h-4 w-4" /> Age or custom date range
                </div>
                <div className="flex items-center gap-2 text-xs text-cyan-200">
                  <Gauge className="h-4 w-4" /> Preview before any deletion
                </div>
                <div className="flex items-center gap-2 text-xs text-cyan-200">
                  <Database className="h-4 w-4" /> Single unified activity log
                </div>
              </div>
            </div>
          </section>

          {/* ================= MONITOR & ANALYZE ================= */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-cyan-600" />
                <h3 className="text-lg font-bold text-slate-900">Monitor &amp; Analyze</h3>
              </div>
              <Button variant="ghost" size="sm" className="text-slate-500" onClick={refreshAll} disabled={statsLoading}>
                <RefreshCw className={`mr-1 h-3.5 w-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Survey Responses', value: spaceReport?.total_responses ?? 0, hint: formatFreed(spaceReport?.total_response_bytes || 0), icon: ClipboardList, color: 'from-sky-500 to-cyan-600' },
                { label: 'Questionnaires', value: spaceReport?.total_forms ?? 0, hint: formatFreed(spaceReport?.total_form_bytes || 0), icon: FileSpreadsheet, color: 'from-indigo-500 to-blue-600' },
                { label: 'Activity Records', value: stats.activity_count ?? 0, hint: 'all users & admins', icon: Activity, color: 'from-cyan-500 to-teal-600' },
                { label: 'Profile Photos', value: stats.profile_photos?.count ?? 0, hint: formatFreed(stats.profile_photos?.bytes || 0), icon: HardDrive, color: 'from-amber-500 to-orange-600' },
                { label: 'Orphan Files', value: stats.orphan_files?.count ?? 0, hint: formatFreed(stats.orphan_files?.bytes || 0), icon: FileX2, color: 'from-rose-500 to-red-600' },
                { label: 'Cleanup Runs', value: stats.cleanup_history_count ?? 0, hint: 'recorded in history', icon: History, color: 'from-emerald-500 to-green-600' },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${card.color} text-white shadow-md`}>
                    <card.icon className="h-4 w-4" />
                  </div>
                  <p className="text-lg font-bold tabular-nums text-slate-900">{formatCount(card.value)}</p>
                  <p className="text-xs font-semibold text-slate-600">{card.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{card.hint}</p>
                </div>
              ))}
            </div>

            {/* Space report: biggest consumers */}
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardHeader className="px-4 py-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-cyan-600" /> Storage Breakdown — Biggest Consumers
                </CardTitle>
                <CardDescription>
                  Ranked by database bytes. 317 responses currently hold ~{formatFreed(spaceReport?.total_response_bytes || 0)} of raw question answers — the top target for space savings.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {spaceReportLoading ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                ) : !spaceReport || (spaceReport.forms || []).length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400">No questionnaires found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Questionnaire</th>
                          <th className="px-3 py-2 text-right">Responses</th>
                          <th className="px-3 py-2 text-right">Response Size</th>
                          <th className="px-3 py-2 text-right">Form Metadata</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {spaceReport.forms.slice(0, 8).map((f) => (
                          <tr key={f.form_id} className="hover:bg-slate-50/60">
                            <td className="max-w-[200px] truncate px-3 py-2 font-medium text-slate-800">{f.title}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatCount(f.response_count)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatFreed(f.response_bytes)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-500">{formatFreed(f.form_bytes)}</td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">{formatFreed(f.response_bytes + f.form_bytes)}</td>
                            <td className="px-3 py-2 text-center">
                              {f.likely_test ? (
                                <Badge className="bg-amber-50 text-amber-700">Likely test</Badge>
                              ) : (
                                <Badge className="bg-emerald-50 text-emerald-700">Active</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {(spaceReport?.likely_test_forms || []).length > 0 && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      <strong>{spaceReport.likely_test_forms.length}</strong> questionnaire(s) look like tests
                      ({spaceReport.likely_test_forms.map((t) => <span key={t.form_id} title={t.form_id}><code>{t.title}</code> · {formatCount(t.response_count)} resp · {formatFreed(t.response_bytes)}</span>).join(', ')}). Removing them frees ~{formatFreed(spaceReport.test_response_bytes || 0)}. Delete via the <strong>Survey Responses (old)</strong> category.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Breakdowns */}
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-cyan-600" /> Activity by Category
                  </CardTitle>
                  <CardDescription>Distribution of activity records by action type</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pb-4 pt-0">
                  {statsLoading ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                  ) : (
                    Object.entries(ACTIVITY_CATEGORY_LABELS).map(([key, label], idx) => {
                      const value = Number(stats.activity_breakdown?.by_category?.[key]) || 0;
                      const pct = value ? Math.max(4, Math.round((value / maxCategoryCount) * 100)) : 0;
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 text-xs font-medium text-slate-600">{label}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${COLORS[idx % COLORS.length]}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{formatCount(value)}</span>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-emerald-600" /> Activity by User Type
                  </CardTitle>
                  <CardDescription>How activity records are spread across users</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pb-4 pt-0">
                  {statsLoading ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                  ) : (
                    Object.entries(USER_TYPE_LABELS).map(([key, label], idx) => {
                      const value = Number(stats.activity_breakdown?.by_user_type?.[key]) || 0;
                      const pct = value ? Math.max(4, Math.round((value / maxUserTypeCount) * 100)) : 0;
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 text-xs font-medium text-slate-600">{label}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${COLORS[(idx + 2) % COLORS.length]}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{formatCount(value)}</span>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex items-start gap-2.5 rounded-2xl border border-cyan-100 bg-cyan-50/60 px-4 py-3 text-sm text-cyan-800">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <strong>Safety guarantee:</strong> {EXPECTED_AUDIT_MSG} Cleanup runs are logged to <strong>Cleanup History</strong> which is
                pruned automatically (newest 500 entries, older than 1 year dropped).
              </p>
            </div>
          </section>

          {/* ================= SPACE MAXIMIZATION ================= */}
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <SlidersHorizontal className="h-5 w-5 text-cyan-600" /> Data Maintenance
              </CardTitle>
              <CardDescription>
                Select what to clean and how old it must be, then preview before deleting. <strong>Survey responses</strong> are the biggest
                database consumer — deleting old ones (and their photos) maximizes reclaimed space.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4 pt-0">
              {/* Category selection */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Categories to clean</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CATEGORY_OPTIONS.map((cat) => {
                    const checked = selectedCategories.includes(cat.key);
                    return (
                      <label
                        key={cat.key}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                          checked ? `${cat.color.split(' ').slice(1).join(' ')} border-current` : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelectedCategories((prev) => (v ? [...prev, cat.key] : prev.filter((k) => k !== cat.key)));
                            setPreview(null);
                            setExecutionResult(null);
                          }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800">{cat.label}</p>
                            <Badge variant="outline" className="shrink-0 text-[11px] text-slate-500">
                              {formatCount(storedCount(cat.key))} {cat.storage ? formatFreed(storedBytes(cat.key)) : 'records'}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">{cat.description}</p>
                          {cat.needsAge && (
                            <p className="mt-1 text-[11px] font-medium text-sky-600">Uses the age or date-range filter below.</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Date range filter */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Filter by date</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => { setRangeMode('age'); setPreview(null); setExecutionResult(null); }}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${rangeMode === 'age' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Age
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRangeMode('custom'); setPreview(null); setExecutionResult(null); }}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${rangeMode === 'custom' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Custom range
                    </button>
                  </div>

                  {rangeMode === 'age' ? (
                    <Select value={ageDays} onValueChange={(v) => { setAgeDays(v); setPreview(null); setExecutionResult(null); }}>
                      <SelectTrigger className="w-44 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AGE_PRESETS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        <Input
                          type="date"
                          value={fromDate}
                          onChange={(e) => { setFromDate(e.target.value); setPreview(null); setExecutionResult(null); }}
                          className="w-40 rounded-xl"
                        />
                        <span className="text-slate-400">→</span>
                        <Input
                          type="date"
                          value={toDate}
                          onChange={(e) => { setToDate(e.target.value); setPreview(null); setExecutionResult(null); }}
                          className="w-40 rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview */}
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={runPreview} disabled={previewing || selectedCategories.length === 0} className="rounded-xl bg-cyan-600 text-white hover:bg-cyan-700">
                  {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                  {previewing ? 'Analyzing...' : 'Preview Cleanup'}
                </Button>
                <Button onClick={() => setExecuteOpen(true)} disabled={executing || !preview || previewTotal === 0} variant="destructive" className="rounded-xl">
                  {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {executing ? 'Deleting...' : 'Delete Selected Data'}
                </Button>
              </div>

              {/* Preview results */}
              {previewing && (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 py-8 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" /> Analyzing selected categories...
                </div>
              )}

              {!previewing && preview && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-50/60 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Preview ready — {formatCount(previewTotal)} item(s) would be removed
                    </div>
                    <div className="text-xs text-slate-500">{formatFreed(preview.total_bytes || 0)} estimated</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 text-right">Records</th>
                          <th className="px-4 py-3 text-right">Affected Users</th>
                          <th className="px-4 py-3">Date Range</th>
                          <th className="px-4 py-3 text-right">Est. Size</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(preview.categories || []).map((c) => (
                          <tr key={c.category} className="hover:bg-slate-50/60">
                            <td className="px-4 py-3 font-medium text-slate-800">{c.label}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCount(c.records)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.affected_users ? formatCount(c.affected_users) : '—'}</td>
                            <td className="px-4 py-3 text-slate-500">
                              {c.oldest ? `${formatEpoch(c.oldest)} → ${formatEpoch(c.newest)}` : 'N/A (filesystem)'}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatFreed(c.est_bytes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(preview.categories || []).some((c) => c.breakdown && Object.keys(c.breakdown).length) && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-3">
                      <p className="mb-2 text-xs font-semibold text-slate-500">Per-questionnaire breakdown:</p>
                      <div className="flex flex-wrap gap-2">
                        {preview.categories
                          .filter((c) => c.breakdown && Object.keys(c.breakdown).length)
                          .map((c) =>
                            Object.entries(c.breakdown).map(([form, count]) => (
                              <Badge key={form} className="bg-white text-slate-600 ring-1 ring-slate-200">{form} · {formatCount(count)}</Badge>
                            ))
                          )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Execution result */}
              {executionResult && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-50/60 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Cleanup complete
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatCount(executionResult.total_deleted)} item(s) · {formatFreed(executionResult.freed_bytes)} freed
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 text-right">Deleted</th>
                          <th className="px-4 py-3 text-right">Freed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(executionResult.tallies || []).map((t) => (
                          <tr key={t.category} className="hover:bg-slate-50/60">
                            <td className="px-4 py-3 font-medium text-slate-800">{t.label}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCount(t.deleted)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatFreed(t.freed_bytes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex items-center gap-2 text-xs text-slate-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Deleting is permanent. The confirmation dialog shows exactly what was previewed.
            </CardFooter>
          </Card>

          {/* ================= UNIFIED ACTIVITY LOG VIEWER ================= */}
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-cyan-600" /> Unified Activity Log
                <Badge className="bg-cyan-50 text-cyan-700">{logs.length}</Badge>
              </CardTitle>
              <CardDescription>
                One log of <strong>every action by all users and admins</strong> (logins, form submissions, project/report/admin actions,
                cleanup runs). The old separate "Legacy Admin Audit Log" is merged here — no duplicate log collections remain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-0">
              {/* Filters + bulk delete */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Select
                    value={logsFilter.user_type || 'all'}
                    onValueChange={(v) => { setLogsFilter((f) => ({ ...f, user_type: v === 'all' ? '' : v })); setLogs([]); }}
                  >
                    <SelectTrigger className="w-44 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users &amp; admins</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                      <SelectItem value="user">Registered users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={logsFilter.search}
                    onChange={(e) => { setLogsFilter((f) => ({ ...f, search: e.target.value })); setLogs([]); }}
                    placeholder="Search email / detail"
                    className="w-56 rounded-xl pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl text-slate-700"
                  disabled={running === 'logs-old'}
                  onClick={() =>
                    openConfirm(
                      'logs-old',
                      `Delete Activity Logs Older Than ${retentionDays} Days?`,
                      `${STANDARD_WARNING} All activity log entries older than ${retentionDays} days (users and admins) will be permanently removed.`
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

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                {logsLoading ? (
                  <div className="flex items-center justify-center gap-2 p-6 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading logs...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">No activity logs found{logsFilter.user_type || logsFilter.search ? ' for the current filter' : ''}.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Action</th>
                          <th className="px-4 py-3">Detail</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/60">
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatTime(log.created_at)}</td>
                            <td className="max-w-[160px] truncate px-4 py-3 text-slate-700">{log.user_email || log.admin_email}</td>
                            <td className="px-4 py-3"><Badge className="bg-slate-100 text-slate-700">{log.user_type || '—'}</Badge></td>
                            <td className="px-4 py-3"><Badge className="bg-cyan-50 text-cyan-700">{log.action_label || activityLabel(log.action)}</Badge></td>
                            <td className="max-w-[240px] truncate px-4 py-3 text-slate-500">{log.detail}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                title="Delete this log"
                                disabled={running === `log-${log.id}`}
                                onClick={() =>
                                  openConfirm(
                                    `log-${log.id}`,
                                    'Delete This Log Entry?',
                                    `${STANDARD_WARNING} This single activity log entry will be permanently removed.`
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

          {/* ================= CLEANUP HISTORY ================= */}
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-blue-600" /> Cleanup History
                <Badge className="bg-blue-50 text-blue-700">{history.length}</Badge>
              </CardTitle>
              <CardDescription>
                Every executed cleanup run is recorded. History is pruned automatically (newest 500, older than 1 year dropped).
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                {historyLoading ? (
                  <div className="flex items-center justify-center gap-2 p-6 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading history...
                  </div>
                ) : history.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">No cleanup runs yet — run a Data Maintenance operation to see it here.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Time</th>
                          <th className="px-3 py-2">Admin</th>
                          <th className="px-3 py-2">Range</th>
                          <th className="px-3 py-2">Categories</th>
                          <th className="px-3 py-2 text-right">Deleted</th>
                          <th className="px-3 py-2 text-right">Freed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.map((h) => (
                          <tr key={h.id} className="hover:bg-slate-50/60">
                            <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatTime(h.created_at)}</td>
                            <td className="px-3 py-2 text-slate-700">{h.admin_email}</td>
                            <td className="max-w-[160px] truncate px-3 py-2 text-slate-500">{h.range_label}</td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {(h.categories || []).map((c) => (
                                  <Badge key={c.category} className="bg-slate-100 text-slate-600">{c.label}</Badge>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatCount(h.total_deleted)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatFreed(h.freed_bytes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ================= QUICK ACTIONS ================= */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-slate-500" />
              <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
            </div>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-slate-500" /> Cache Management
                </CardTitle>
                <CardDescription>
                  Clears locally cached data on this device (browser storage). Your login session is preserved and server data is unaffected.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                Temporary/browser data only. No projects, forms, responses, or database records are modified.
              </CardFooter>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileX2 className="h-4 w-4 text-rose-600" /> Direct Storage Cleanup
                </CardTitle>
                <CardDescription>
                  Run the individual storage tools immediately. Files still linked to responses are never touched.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  className="rounded-xl border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800"
                  disabled={running === 'photos'}
                  onClick={() =>
                    openConfirm(
                      'photos',
                      'Delete Profile Photos?',
                      `${STANDARD_WARNING} All profile photos on the local uploads disk will be permanently removed. This reclaims the most disk space but leaves every response's photo link broken.`
                    )
                  }
                >
                  {running === 'photos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
                  Delete All Profile Photos
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
                Candidates: {stats.profile_photos?.count ?? 0} photos ({formatFreed(stats.profile_photos?.bytes || 0)}) · {stats.orphan_files?.count ?? 0} orphan
              </CardFooter>
            </Card>
          </div>

          {!embedded && (
            <div className="flex items-center gap-2 pt-2 text-sm text-slate-500">
              <ArrowLeft className="h-4 w-4" />
              <button onClick={() => navigate('/admin')} className="font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline">
                Back to Admin Dashboard
              </button>
            </div>
          )}
      </div>
  );

  return (
    <div>
      {embedded ? (
        content
      ) : (
        <main className="w-full px-3 pb-24 pt-0 sm:px-4">{content}</main>
      )}

      {/* ================= CONFIRM: Execute cleanup ================= */}
      <AlertDialog open={executeOpen} onOpenChange={setExecuteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete {formatCount(previewTotal)} Record(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the data shown in your preview.
              {EXPECTED_AUDIT_MSG} A cleanup history entry will be recorded with your admin account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Records</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(preview?.categories || []).map((c) => {
                  const cnt = previewSelectedCounts[c.category];
                  return (
                    <tr key={c.category}>
                      <td className="px-3 py-2 font-medium text-slate-800">{c.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatCount(cnt?.records ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={executing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              disabled={executing || previewTotal === 0}
              onClick={(e) => {
                e.preventDefault();
                setExecuteOpen(false);
                performExecute();
              }}
            >
              {executing ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Deleting...</> : 'Confirm & Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ================= CONFIRM: generic (quick actions) ================= */}
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
                      return api.delete(`/admin/cleanup/activity-logs/${id}`);
                    }
                    if (key === 'logs-old') return api.delete(`/admin/cleanup/activity-logs`, { params: { days: retentionDays } });
                    if (key === 'logs-all') return api.delete('/admin/cleanup/activity-logs/all');
                    if (key === 'photos') return api.delete('/admin/cleanup/profile-photos');
                    if (key === 'orphan') return api.delete('/admin/cleanup/orphan-files');
                    return Promise.reject(new Error('Unknown action'));
                  },
                  () => {
                    if (key.startsWith('log-') || key === 'logs-old' || key === 'logs-all') {
                      fetchLogs();
                    }
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
            <AlertDialogTitle className="text-xl">Delete ALL Logs?</AlertDialogTitle>
            <AlertDialogDescription>
              {STANDARD_WARNING} This permanently removes every unified activity log entry. Type <strong>DELETE</strong> to confirm.
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
                  'Final confirmation: every unified activity log entry will be permanently removed. This cannot be undone.'
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