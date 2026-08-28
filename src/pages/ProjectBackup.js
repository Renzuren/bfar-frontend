// src/pages/ProjectBackup.js
// ============================================================
// DATA BACKUP & IMPORT
// Lets the user safely back up the whole project (metadata +
// questionnaires + all responses) to a single JSON file and
// restore it back into the current project at any time.
// Used from both the Baseline and No-Baseline dashboards
// (/projects/:id/backup).
// ============================================================

import React, { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileJson,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '../lib/apiMiddleware';
import { useProject } from '../context/ProjectContext';
import { PageHeader, CardSection } from '../components/AppShell';

const SCHEMA_VERSION = 1;

const slugify = (text) =>
  String(text || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 40) || 'project';

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const countResponses = (forms) =>
  (Array.isArray(forms) ? forms : []).reduce((sum, f) => sum + (Array.isArray(f?.responses) ? f.responses.length : 0), 0);

const ProjectBackup = () => {
  const { id } = useParams();
  const { currentProject, fetchProject } = useProject();
  const fileInputRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingBackup, setPendingBackup] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  // ---- Export -------------------------------------------------------
  const buildBackup = async () => {
    const project = (await api.get(`/projects/${id}`)).data;
    if (!project) throw new Error('Could not load project data');

    const formIds = [project.before_form, project.after_form].filter(Boolean);
    const uniqueIds = [...new Set(formIds)];

    const forms = [];
    for (const formId of uniqueIds) {
      let form = null;
      try {
        form = (await api.get(`/forms/${formId}`)).data || null;
      } catch (error) {
        toast.warning(`Skipped missing questionnaire (${formId}).`);
      }
      if (!form) continue;

      let responses = [];
      try {
        const res = await api.get(`/forms/${formId}/responses`);
        responses = res.data || [];
      } catch (error) {
        toast.warning(`Could not load responses for "${form.title || formId}".`);
      }
      forms.push({ form_id: form.id || formId, form, responses });
    }

    return {
      app: 'bfar',
      type: 'project-backup',
      schema_version: SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
      project_id: project.id || id,
      project,
      forms,
    };
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const backup = await buildBackup();
      const totalResponses = countResponses(backup.forms);
      const name = `bfar-backup-${slugify(backup.project.title)}-${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Backup saved · ${backup.forms.length} ${backup.forms.length === 1 ? 'questionnaire' : 'questionnaires'}, ${totalResponses} responses (${formatBytes(blob.size)})`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create backup');
    } finally {
      setExporting(false);
    }
  };

  // ---- Import -------------------------------------------------------
  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReadingFile(true);
    setPendingBackup(null);
    setConfirmed(false);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || parsed.type !== 'project-backup') {
        throw new Error('This file is not a valid project backup.');
      }
      if (!parsed.project || typeof parsed.project !== 'object') {
        throw new Error('The backup file is missing project data.');
      }
      if (!Array.isArray(parsed.forms)) {
        throw new Error('The backup file is missing questionnaire data.');
      }
      if (Number(parsed.schema_version || 1) > SCHEMA_VERSION) {
        throw new Error(`Backup uses an unsupported schema version (${parsed.schema_version}).`);
      }
      setPendingBackup({ ...parsed, fileName: file.name, fileBytes: file.size });
      toast.success(`Loaded backup of "${parsed.project.title || 'untitled project'}"`);
    } catch (error) {
      toast.error(error.message || 'Could not read the backup file');
    } finally {
      setReadingFile(false);
    }
  };

  const handleRestore = async () => {
    if (!pendingBackup || restoring) return;
    setRestoring(true);
    try {
      const res = await api.post(`/projects/${id}/backup/restore`, {
        schema_version: pendingBackup.schema_version,
        project: pendingBackup.project,
        forms: pendingBackup.forms,
      });
      toast.success(`Project restored · ${res.data.total_restored_responses} responses imported`);
      await fetchProject(id);
      setPendingBackup(null);
      setConfirmed(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const isForeignBackup =
    pendingBackup && String(pendingBackup.project_id) !== String(id);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-1 py-6">
      <PageHeader
        icon={DatabaseBackup}
        iconColor="from-teal-500 to-emerald-600"
        title="Data Backup & Import"
        subtitle={currentProject ? `Safeguard and restore all data for "${currentProject.title}"` : 'Safeguard and restore project data'}
      />

      {/* Export */}
      <CardSection
        title="Export Backup"
        subtitle="Download a portable copy of the entire project — metadata, questionnaires, and every response — as a single .json file. Keep it somewhere safe (e.g., a drive, email, or cloud folder)."
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Download className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Current project data</p>
              <p className="mt-0.5 text-sm text-slate-500">
                Includes metadata, questionnaires, respondent profiles, and all answers.
              </p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={exporting} className="h-10 shrink-0 gap-2 px-5">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Preparing backup…' : 'Download backup (.json)'}
          </Button>
        </div>
      </CardSection>

      {/* Import */}
      <CardSection
        title="Import & Restore"
        subtitle="Upload a previously saved backup file and bring its data back into this project. Restoring replaces the current questionnaires and responses with the ones from the file."
      >
        {/* File picker */}
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
              <p className="mt-0.5 text-sm text-slate-500">Choose a `.bfar` backup (.json) exported with this tool.</p>
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

        {/* Pending backup summary */}
        {pendingBackup && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900">Backup ready to restore</h4>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs font-medium text-slate-400">File</dt>
                  <dd className="mt-0.5 truncate font-medium text-slate-700" title={pendingBackup.fileName}>{pendingBackup.fileName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-400">Project</dt>
                  <dd className="mt-0.5 truncate font-medium text-slate-700">{pendingBackup.project.title || 'Untitled'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-400">Questionnaires</dt>
                  <dd className="mt-0.5 font-medium text-slate-700">{pendingBackup.forms.length}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-400">Responses</dt>
                  <dd className="mt-0.5 font-medium text-slate-700">{countResponses(pendingBackup.forms).toLocaleString()}</dd>
                </div>
              </dl>

              {isForeignBackup && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    This backup was exported from a different project. Restoring will still apply it to{' '}
                    <span className="font-semibold">{currentProject?.title || 'this project'}</span>, overwriting its
                    current data.
                  </p>
                </div>
              )}

              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Restoring <span className="font-semibold">replaces</span> the current project's questionnaires and
                  responses. This action cannot be undone — export a backup first if you need to keep the current data.
                </p>
              </div>
            </div>

            {confirmed ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleRestore} disabled={restoring} variant="destructive" className="h-10 gap-2 px-5">
                  {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseBackup className="h-4 w-4" />}
                  {restoring ? 'Restoring…' : 'Yes, restore now'}
                </Button>
                <Button variant="ghost" className="h-10 px-4" onClick={() => { setConfirmed(false); setPendingBackup(null); }} disabled={restoring}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button onClick={() => setConfirmed(true)} disabled={restoring} className="mt-4 h-10 gap-2 px-5">
                {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Restore this backup
              </Button>
            )}
          </div>
        )}
      </CardSection>

      <p className="px-1 text-xs text-slate-400">
        Backup schema version {SCHEMA_VERSION}
        {pendingBackup && ` · ${pendingBackup.fileName} · ${formatBytes(pendingBackup.fileBytes)}`}
      </p>
    </div>
  );
};

export default ProjectBackup;