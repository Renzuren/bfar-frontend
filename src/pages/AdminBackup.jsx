// src/pages/AdminBackup.jsx
// ============================================================
// SYSTEM BACKUP & RESTORE (admin only)
// Backs up the whole system -- accounts, organizations, projects,
// questionnaires, responses, reports and logs -- to one JSON file,
// and restores the whole system from such a file. Unlike the
// per-project backup (ProjectBackup.js) this replaces everything.
// ============================================================

import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileJson,
  Loader2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, getApiErrorMessage } from '../lib/apiMiddleware';
import { formatDate } from '../lib/dates';
import { CardSection } from '../components/AppShell';

const BACKUP_TYPE = 'system-backup';
const SCHEMA_VERSION = 1;
// The whole database travels in one request, so allow far longer than usual.
const BACKUP_TIMEOUT = 10 * 60 * 1000;
const CONFIRM_WORD = 'RESTORE';

// Collections shown in the summary, in order; anything else is "Other".
const SUMMARY = [
  { key: 'users', label: 'Accounts' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'projects', label: 'Projects' },
  { key: 'forms', label: 'Questionnaires' },
  { key: 'responses', label: 'Responses' },
];

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const summarize = (counts = {}) => {
  const known = new Set(SUMMARY.map((s) => s.key));
  const other = Object.entries(counts).reduce((sum, [key, n]) => (known.has(key) ? sum : sum + n), 0);
  return [
    ...SUMMARY.map((s) => ({ label: s.label, count: counts[s.key] || 0 })),
    { label: 'Other (reports, logs…)', count: other },
  ];
};

// Older files may lack `counts`; derive them the way the server does.
const countDocuments = (documents) => {
  const counts = {};
  documents.forEach((doc) => {
    const segments = String(doc?.path || '').split('/');
    const key = segments.length > 2 ? segments[segments.length - 2] : segments[0];
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
};

const SummaryGrid = ({ counts }) => (
  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
    {summarize(counts).map((item) => (
      <div key={item.label}>
        <dt className="text-xs font-medium text-slate-400">{item.label}</dt>
        <dd className="mt-0.5 font-medium text-slate-700">{item.count.toLocaleString()}</dd>
      </div>
    ))}
  </dl>
);

export default function AdminBackup({ onRestored }) {
  const fileInputRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingBackup, setPendingBackup] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const backup = (await api.get('/admin/backup', { timeout: BACKUP_TIMEOUT })).data;
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bfar-system-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`System backup saved · ${backup.documents.length.toLocaleString()} records (${formatBytes(blob.size)})`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to create the system backup'));
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReadingFile(true);
    setPendingBackup(null);
    setConfirmText('');
    setLastResult(null);
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.type === 'project-backup') {
        throw new Error('This is a project backup. Import it from the project’s Data Backup & Import page instead.');
      }
      if (!parsed || parsed.type !== BACKUP_TYPE) {
        throw new Error('This file is not a system backup.');
      }
      if (!Array.isArray(parsed.documents) || parsed.documents.length === 0) {
        throw new Error('The backup file has no data.');
      }
      if (Number(parsed.schema_version || 1) > SCHEMA_VERSION) {
        throw new Error(`Backup uses an unsupported schema version (${parsed.schema_version}).`);
      }
      setPendingBackup({
        backup: parsed,
        counts: countDocuments(parsed.documents),
        fileName: file.name,
        fileBytes: file.size,
      });
    } catch (error) {
      toast.error(error instanceof SyntaxError ? 'The file is not valid JSON.' : error.message || 'Could not read the backup file');
    } finally {
      setReadingFile(false);
    }
  };

  const handleRestore = async () => {
    if (!pendingBackup || restoring || confirmText !== CONFIRM_WORD) return;
    setRestoring(true);
    try {
      const { type, schema_version, documents } = pendingBackup.backup;
      const res = await api.post(
        '/admin/backup/restore',
        { type, schema_version, documents },
        // A restore must never be sent twice.
        { timeout: BACKUP_TIMEOUT, retry: 0 }
      );
      setLastResult(res.data);
      setPendingBackup(null);
      setConfirmText('');
      toast.success(`System restored · ${res.data.restored_documents.toLocaleString()} records`);
      onRestored?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Restore failed'));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export */}
      <CardSection
        title="Download System Backup"
        subtitle="One .json file with everything in the system: accounts, organizations, projects, questionnaires, responses, reports and logs."
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Download className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Whole system</p>
              <p className="mt-0.5 text-sm text-slate-500">
                Itago ang file sa ligtas na lugar. May laman itong personal na impormasyon ng mga user at respondent.
              </p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={exporting || restoring} className="h-10 shrink-0 gap-2 px-5">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Preparing backup…' : 'Download backup (.json)'}
          </Button>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Hindi kasama: mga password (mananatili sa sign-in service) at mga na-upload na larawan ng respondents.
        </p>
      </CardSection>

      {/* Import */}
      <CardSection
        title="Restore System from Backup"
        subtitle="Upload a system backup file to bring the whole system back to how it was when the file was downloaded."
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Upload className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Restore from a backup file</p>
              <p className="mt-0.5 text-sm text-slate-500">Piliin ang system backup (.json) na na-download dito.</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="h-10 shrink-0 gap-2 px-5"
            onClick={() => fileInputRef.current?.click()}
            disabled={readingFile || restoring}
          >
            {readingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
            {readingFile ? 'Reading file…' : 'Choose backup file'}
          </Button>
        </div>

        {pendingBackup && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900">Backup ready to restore</h4>
              </div>
              <p className="mb-4 text-sm text-slate-500">
                <span className="font-medium text-slate-700">{pendingBackup.fileName}</span> · {formatBytes(pendingBackup.fileBytes)}
                {pendingBackup.backup.exported_at && ` · downloaded ${formatDate(pendingBackup.backup.exported_at)}`}
                {pendingBackup.backup.exported_by && ` by ${pendingBackup.backup.exported_by}`}
              </p>
              <SummaryGrid counts={pendingBackup.counts} />

              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p>
                    Restoring <span className="font-semibold">replaces everything</span> in the system with the contents of
                    this file. Accounts, projects and responses added after the backup was downloaded will be deleted. This
                    cannot be undone — download a backup of the current system first if you may need it.
                  </p>
                  <p>
                    Papalitan ng file na ito ang <span className="font-semibold">lahat</span> ng data ng system. Mabubura ang
                    anumang naidagdag pagkatapos ma-download ang backup.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="restore-confirm" className="text-sm font-medium text-slate-700">
                Type <span className="font-bold">{CONFIRM_WORD}</span> to confirm
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Input
                  id="restore-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  autoComplete="off"
                  disabled={restoring}
                  className="h-10 w-40"
                />
                <Button
                  onClick={handleRestore}
                  disabled={restoring || confirmText !== CONFIRM_WORD}
                  variant="destructive"
                  className="h-10 gap-2 px-5"
                >
                  {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseBackup className="h-4 w-4" />}
                  {restoring ? 'Restoring…' : 'Restore whole system'}
                </Button>
                <Button
                  variant="ghost"
                  className="h-10 px-4"
                  onClick={() => { setPendingBackup(null); setConfirmText(''); }}
                  disabled={restoring}
                >
                  Cancel
                </Button>
              </div>
              {restoring && (
                <p className="mt-2 text-xs text-slate-500">Huwag isara ang page habang nagre-restore.</p>
              )}
            </div>
          </div>
        )}

        {lastResult && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900">System restored</h4>
            </div>
            <SummaryGrid counts={lastResult.counts} />
            <ul className="mt-4 space-y-1 text-sm text-slate-600">
              {lastResult.kept_own_account && (
                <li>Wala sa backup ang admin account mo, kaya pinanatili ito para hindi ka ma-lock out.</li>
              )}
              {lastResult.auth?.recreated > 0 && (
                <li>
                  {lastResult.auth.recreated} sign-in account(s) were recreated without a password. Those users must use
                  “Forgot password” to set a new one.
                </li>
              )}
              {(lastResult.auth?.failed > 0 || lastResult.auth?.error) && (
                <li className="text-amber-700">
                  {lastResult.auth.error || `${lastResult.auth.failed} sign-in account(s) could not be recreated.`} Check
                  those accounts in the Users tab.
                </li>
              )}
            </ul>
          </div>
        )}
      </CardSection>
    </div>
  );
}
