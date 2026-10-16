// What the signed-in user may do on a project, from the `my_role` the backend
// sends with every project: owner > admin > editor > viewer. The backend
// enforces the same rules; these only decide what the screens offer.

const RANK = { viewer: 1, editor: 2, admin: 3, owner: 4 };

export const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS = {
  owner: 'Full control, including deleting the project and transferring ownership.',
  admin: 'Can edit everything and manage editors and viewers.',
  editor: 'Can edit questionnaires, settings, analysis and reports.',
  viewer: 'View only. Cannot change anything.',
};

export const ROLE_BADGE = {
  owner: 'bg-slate-900 text-white ring-slate-900',
  admin: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  editor: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  viewer: 'bg-slate-100 text-slate-600 ring-slate-200',
};

// Projects from an older backend have no my_role; they are the user's own.
export const roleOf = (project) => project?.my_role || 'owner';

const atLeast = (project, role) => (RANK[roleOf(project)] || 0) >= RANK[role];

export const isOwner = (project) => roleOf(project) === 'owner';
export const canEdit = (project) => atLeast(project, 'editor');
export const canManageMembers = (project) => atLeast(project, 'admin');
export const isViewOnly = (project) => !canEdit(project);
