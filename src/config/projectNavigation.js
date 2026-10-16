import {
  FileText,
  BarChart3,
  ListChecks,
  Layers,
  FileBarChart2,
  DatabaseBackup,
  ClipboardList,
  Users,
} from 'lucide-react';

// Sidebar and breadcrumb labels for a project's pages. Baseline projects
// compare Before vs After; No Baseline projects compare Beneficiary vs
// Non-Beneficiary groups (same routes, different names and order).

const item = (label, path, icon) => ({ label, path, icon });

const BASELINE = {
  sidebarItems: [
    item('Create Questionnaire', 'create-questionnaire', FileText),
    item('Before', 'before', Layers),
    item('After', 'after', ListChecks),
    item('Analysis Report', 'report', FileBarChart2),
    item('Narrative Report', 'narrative-report', BarChart3),
    item('Responses', 'all-responses', ClipboardList),
    item('Data Backup & Import', 'backup', DatabaseBackup),
    item('Members & Sharing', 'members', Users),
  ],
  slotLabels: { before: 'Before', after: 'After' },
};

const NO_BASELINE = {
  sidebarItems: [
    item('Create Questionnaire', 'create-questionnaire', FileText),
    item('Beneficiary', 'before', Layers),
    item('Non-Beneficiary', 'after', ListChecks),
    item('Responses', 'all-responses', ClipboardList),
    item('Analysis Report', 'report', FileBarChart2),
    item('Narrative Report', 'narrative-report', BarChart3),
    item('Data Backup & Import', 'backup', DatabaseBackup),
    item('Members & Sharing', 'members', Users),
  ],
  slotLabels: { before: 'Beneficiary', after: 'Non-Beneficiary' },
};

const breadcrumbLabels = (slotLabels) => ({
  'create-questionnaire': 'Edit Questionnaire',
  before: slotLabels.before,
  after: slotLabels.after,
  report: 'Analysis Report',
  'all-responses': 'All Responses',
  responses: 'View Responses',
  profiles: 'View Profiles',
  analytics: 'View Analytics',
  'narrative-report': 'Narrative Report',
  backup: 'Data Backup & Import',
  members: 'Members & Sharing',
  'group-report': 'Group Report',
});

const NAVIGATION = {
  baseline: { sidebarItems: BASELINE.sidebarItems, breadcrumbLabels: breadcrumbLabels(BASELINE.slotLabels) },
  noBaseline: { sidebarItems: NO_BASELINE.sidebarItems, breadcrumbLabels: breadcrumbLabels(NO_BASELINE.slotLabels) },
};

// Pages that only change the project; hidden from view-only members.
const EDIT_ONLY = new Set(['create-questionnaire']);

/** { sidebarItems, breadcrumbLabels } for a project page. */
export const getProjectNavigation = (hasBaseline, { viewOnly = false } = {}) => {
  const nav = hasBaseline ? NAVIGATION.baseline : NAVIGATION.noBaseline;
  return viewOnly ? { ...nav, sidebarItems: nav.sidebarItems.filter((i) => !EDIT_ONLY.has(i.path)) } : nav;
};
