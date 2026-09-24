import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Building2,
  FolderKanban,
  Plus,
  Search,
  Trash2,
  Pencil,
  UserPlus,
  Loader2,
  Inbox,
  Mail,
  CalendarDays,
  RefreshCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminLayout from '../components/layout/AdminLayout';
import AdminCleanup from './AdminCleanup';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { api, getApiErrorMessage } from '../lib/apiMiddleware';

// How often the admin dashboard re-fetches users and organizations.
const ADMIN_REFRESH_INTERVAL = 30000;

const AdminDashboard = () => {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [userFilter, setUserFilter] = useState('active');


  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ firstName: '', middleName: '', lastName: '', email: '', password: '', organization: '' });
  const [creatingUser, setCreatingUser] = useState(false);

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUser, setEditUser] = useState({ id: '', firstName: '', middleName: '', lastName: '', email: '', role: 'user', org_id: '', organization: '', status: 'active' });
  const [savingUser, setSavingUser] = useState(false);


  const [deleteUserDialog, setDeleteUserDialog] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [deleteUserName, setDeleteUserName] = useState('');

  const [permanentDeleteDialog, setPermanentDeleteDialog] = useState(false);
  const [permanentDeleteUserId, setPermanentDeleteUserId] = useState(null);
  const [permanentDeleteUserName, setPermanentDeleteUserName] = useState('');
  const [deletingUserPermanent, setDeletingUserPermanent] = useState(false);


  // `silent` refreshes in the background without the loading state or error toasts.
  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [usersRes, orgsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/organizations'),
      ]);
      setUsers(usersRes.data || []);
      setOrganizations(orgsRes.data || []);
    } catch (error) {
      console.error('Admin data fetch error:', error);
      if (!silent) toast.error(getApiErrorMessage(error, 'Failed to load admin data. Make sure the backend is running.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Keep users and organizations current (e.g. a user changing their
  // organization) without a manual reload: refresh periodically and whenever
  // the tab regains focus.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') fetchData({ silent: true });
    };
    const timer = setInterval(refresh, ADMIN_REFRESH_INTERVAL);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [fetchData]);

  // --- USER TABLE PAGINATION ---
  const [userPage, setUserPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);

  useEffect(() => { setUserPage(1); }, [searchQuery, userFilter, usersPerPage]);

  // --- USER CRUD ---
  const handleCreateUser = async () => {
    if (!newUser.firstName.trim() || !newUser.lastName.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      toast.error('Please fill in all required fields'); return;
    }
    setCreatingUser(true);
    try {
      const payload = { first_name: newUser.firstName.trim(), middle_name: newUser.middleName.trim(), last_name: newUser.lastName.trim(), email: newUser.email.trim(), password: newUser.password, organization: newUser.organization.trim(), role: 'user' };
      await api.post('/admin/users', payload);
      setAddUserOpen(false);
      setNewUser({ firstName: '', middleName: '', lastName: '', email: '', password: '', organization: '' });
      toast.success('User account created successfully');
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to create user'); }
    finally { setCreatingUser(false); }
  };

  const openEditUser = (u) => {
    const parts = (u.full_name || '').split(' ');
    setEditUser({
      id: u.id || u.uid,
      firstName: parts[0] || '',
      middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
      lastName: parts[parts.length - 1] || '',
      email: u.email || '',
      role: u.role || 'user',
      org_id: u.org_id || '',
      organization: u.organization || '',
      status: u.status || 'active',
    });
    setEditUserOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editUser.firstName.trim() || !editUser.lastName.trim() || !editUser.email.trim()) {
      toast.error('First name, last name, and email are required'); return;
    }
    setSavingUser(true);
    try {
      await api.put(`/admin/users/${editUser.id}`, {
        first_name: editUser.firstName.trim(),
        middle_name: editUser.middleName.trim(),
        last_name: editUser.lastName.trim(),
        email: editUser.email.trim(),
        role: editUser.role,
        org_id: editUser.org_id || null,
        status: editUser.status,
      });
      setEditUserOpen(false);
      toast.success('User updated successfully');
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to update user'); }
    finally { setSavingUser(false); }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    try {
      await api.delete(`/admin/users/${deleteUserId}`);
      setUsers((prev) => prev.map((u) => (u.id || u.uid) === deleteUserId ? { ...u, status: 'deleted' } : u));
      toast.success('User deleted');
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to delete user'); }
    setDeleteUserDialog(false); setDeleteUserId(null); setDeleteUserName('');
  };

  const handleRestoreUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/restore`);
      setUsers((prev) => prev.map((u) => (u.id || u.uid) === userId ? { ...u, status: 'active', deleted_at: null } : u));
      toast.success('User restored');
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to restore user'); }
  };

  const handlePermanentDeleteUser = async () => {
    if (!permanentDeleteUserId) return;
    setDeletingUserPermanent(true);
    try {
      await api.delete(`/admin/users/${permanentDeleteUserId}/permanent`);
      setUsers((prev) => prev.filter((u) => (u.id || u.uid) !== permanentDeleteUserId));
      toast.success('User permanently deleted');
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to permanently delete user'); }
    finally {
      setDeletingUserPermanent(false);
      setPermanentDeleteDialog(false);
      setPermanentDeleteUserId(null);
      setPermanentDeleteUserName('');
    }
  };

  const getOrgName = (orgId) => {
    if (!orgId) return 'Unassigned';
    const org = organizations.find((o) => o.id === orgId);
    return org?.name || orgId;
  };

  // The assigned organization, or else the one the user wrote on their profile.
  const getUserOrgLabel = (u) => (u.org_id ? getOrgName(u.org_id) : u.organization || 'Unassigned');

  const filteredUsers = users.filter((u) => {
    if (userFilter === 'active' && u.status === 'deleted') return false;
    if (userFilter === 'deleted' && u.status !== 'deleted') return false;
    const q = searchQuery.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || getUserOrgLabel(u).toLowerCase().includes(q);
  });

  // Pagination over the filtered user list
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));
    if (userPage > maxPage) setUserPage(maxPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredUsers.length, usersPerPage, userPage]);

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));
  const safeUserPage = Math.min(userPage, totalUserPages);
  const pageStart = (safeUserPage - 1) * usersPerPage;
  const paginatedUsers = filteredUsers.slice(pageStart, pageStart + usersPerPage);

  const getPageNumbers = (current, total) => {
    const pages = new Set([1, total]);
    for (let p = Math.max(2, current - 2); p <= Math.min(total - 1, current + 2); p++) pages.add(p);
    return [...pages].sort((a, b) => a - b);
  };

  // Organizations come from users' profiles, so count the distinct ones in use.
  const organizationsInUse = new Set(
    users
      .filter((u) => u.status !== 'deleted')
      .map((u) => (u.org_id || u.organization ? getUserOrgLabel(u).trim().toLowerCase() : ''))
      .filter(Boolean)
  ).size;

  const totalProjects = users.reduce((sum, u) => sum + (u.project_count || 0), 0);

  const formatDate = (value) => {
    if (!value) return 'N/A';
    let date;
    if (typeof value === 'object' && typeof value._seconds === 'number') { date = new Date(value._seconds * 1000); }
    else { date = new Date(value); }
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderStatus = (u) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${u.status === 'deleted' ? 'bg-rose-50 text-rose-700 ring-rose-200' : u.status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${u.status === 'deleted' ? 'bg-rose-500' : u.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />{u.status || 'active'}
    </span>
  );

  // `labeled` shows text next to the icons (mobile cards, where there is no
  // hover tooltip and bigger tap targets help).
  const renderUserActions = (u, labeled = false) => {
    const uid = u.id || u.uid;
    const base = labeled
      ? 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition'
      : 'rounded-lg p-2 text-slate-400 transition';
    return u.status === 'deleted' ? (
      <>
        <button onClick={() => handleRestoreUser(uid)} className={`${base} hover:bg-emerald-50 hover:text-emerald-600`} title="Restore user"><RotateCcw className="h-4 w-4" />{labeled && 'Restore'}</button>
        <button onClick={() => { setPermanentDeleteUserId(uid); setPermanentDeleteUserName(u.full_name || u.email); setPermanentDeleteDialog(true); }} className={`${base} hover:bg-red-50 hover:text-red-600`} title="Permanently delete user"><Trash2 className="h-4 w-4" />{labeled && 'Delete permanently'}</button>
      </>
    ) : (
      <>
        <button onClick={() => openEditUser(u)} className={`${base} hover:bg-violet-50 hover:text-violet-600`} title="Edit user"><Pencil className="h-4 w-4" />{labeled && 'Edit'}</button>
        <button onClick={() => { setDeleteUserId(uid); setDeleteUserName(u.full_name || u.email); setDeleteUserDialog(true); }} className={`${base} hover:bg-rose-50 hover:text-rose-600`} title="Delete user"><Trash2 className="h-4 w-4" />{labeled && 'Delete'}</button>
      </>
    );
  };

  const userInitialsOf = (u) => (u.full_name || u.email || 'U').split(/[\s@._]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'U';

  return (
    <AdminLayout title="Admin Dashboard" subtitle="System Administration">
      <div className="space-y-5">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900 px-5 py-4 sm:px-7 text-white shadow-lg shadow-slate-900/20 text-left">
            <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-violet-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-purple-500/15 blur-3xl" />
            <div className="relative flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-0.5 text-xs font-medium uppercase tracking-[0.2em] text-violet-300">Welcome, Admin</p>
                <h2 className="text-xl font-bold leading-tight sm:text-2xl">System Overview</h2>
                <p className="mt-0.5 max-w-2xl text-sm text-slate-300">Monitor all users and their organizations across the platform from one central dashboard.</p>
              </div>
            </div>
          </section>

          {/* Stats */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total Users', value: users.filter((u) => u.status !== 'deleted').length, icon: Users, bg: 'bg-cyan-500', iconBg: 'bg-cyan-50', iconText: 'text-cyan-600' },
              { label: 'Organizations', value: organizationsInUse, icon: Building2, bg: 'bg-indigo-500', iconBg: 'bg-indigo-50', iconText: 'text-indigo-600' },
              { label: 'Total Projects', value: totalProjects, icon: FolderKanban, bg: 'bg-emerald-500', iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
              { label: 'Active Users', value: users.filter((u) => u.status === 'active').length, icon: UserPlus, bg: 'bg-amber-500', iconBg: 'bg-amber-50', iconText: 'text-amber-600' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className={`absolute inset-y-0 left-0 w-1 ${stat.bg}`} />
                  <div className="pl-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.iconBg}`}><Icon className={`h-4 w-4 ${stat.iconText}`} /></div>
                    </div>
                    <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                    <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Tabs + Search + Actions */}
          <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveTab('users')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Users className="mr-1.5 inline h-4 w-4" /> Users ({users.filter((u) => u.status !== 'deleted').length})
                </button>
                <button onClick={() => setActiveTab('data-maintenance')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === 'data-maintenance' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Database className="mr-1.5 inline h-4 w-4" /> Data Maintenance
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {activeTab !== 'data-maintenance' && (
                  <div className="relative w-full sm:w-72">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search users or organizations..." className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100" />
                  </div>
                )}
                <Button onClick={fetchData} variant="outline" size="sm" className="border-slate-200 text-slate-600 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /></Button>
                {activeTab === 'users' && userFilter !== 'deleted' && (
                  <Button onClick={() => setAddUserOpen(true)} className="bg-violet-600 text-white hover:bg-violet-700">
                    <Plus className="mr-1.5 h-4 w-4" /> Add User
                  </Button>
                )}
              </div>
            </div>
            {activeTab === 'users' && (
              <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3">
                {[
                  { key: 'active', label: 'Active', count: users.filter((u) => u.status !== 'deleted').length },
                  { key: 'deleted', label: 'Deleted', count: users.filter((u) => u.status === 'deleted').length },
                  { key: 'all', label: 'All', count: users.length },
                ].map((f) => (
                  <button key={f.key} onClick={() => setUserFilter(f.key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${userFilter === f.key ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Content */}
          {activeTab === 'data-maintenance' ? (
            <AdminCleanup embedded />
          ) : loading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (<div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="h-full w-full rounded-2xl bg-slate-100/80" /></div>))}
            </div>
          ) : activeTab === 'users' ? (
            filteredUsers.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-left">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Inbox className="h-8 w-8" /></div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">No users found</h3>
                <p className="mx-auto mb-6 max-w-md text-sm text-slate-500">{searchQuery ? 'No users match your search.' : 'No users registered yet.'}</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                {/* Phones: one card per user so every action is reachable without sideways scrolling. */}
                <ul className="divide-y divide-slate-100 md:hidden">
                  {paginatedUsers.map((u) => (
                    <li key={u.id || u.uid} className="space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">{userInitialsOf(u)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">{u.full_name || 'Unnamed'}</p>
                            {u.role === 'admin' && <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-600 ring-1 ring-violet-200">Admin</span>}
                          </div>
                          <p className="mt-0.5 flex items-center gap-1.5 break-all text-sm text-slate-600"><Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />{u.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-slate-400" /><span className={u.org_id || u.organization ? 'text-slate-700' : 'italic text-slate-400'}>{getUserOrgLabel(u)}</span></span>
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-slate-400" />{formatDate(u.created_at || u.createdAt)}</span>
                        {renderStatus(u)}
                      </div>
                      <div className="flex flex-wrap gap-2">{renderUserActions(u, true)}</div>
                    </li>
                  ))}
                </ul>
                {/* Tablets and up: the table, scrollable sideways if the screen is narrow. */}
                <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">User</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Email</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Organization</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Joined</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedUsers.map((u) => {
                      const uid = u.id || u.uid;
                      const userInitials = userInitialsOf(u);
                      return (
                        <tr key={uid} className="transition hover:bg-slate-50/80">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">{userInitials}</div>
                              <div>
                                <p className="font-semibold text-slate-900">{u.full_name || 'Unnamed'}</p>
                                {u.role === 'admin' && <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-600 ring-1 ring-violet-200">Admin</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4"><div className="flex items-center gap-2 text-slate-600"><Mail className="h-3.5 w-3.5 text-slate-400" />{u.email}</div></td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              <span
                                className={u.org_id ? 'text-slate-700 font-medium' : u.organization ? 'text-slate-700' : 'text-slate-400 italic'}
                              >
                                {getUserOrgLabel(u)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {renderStatus(u)}
                          </td>
                          <td className="px-6 py-4"><div className="flex items-center gap-2 text-slate-500"><CalendarDays className="h-3.5 w-3.5 text-slate-400" />{formatDate(u.created_at || u.createdAt)}</div></td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1">{renderUserActions(u)}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                {totalUserPages > 1 && (
                  <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      Showing <span className="font-semibold text-slate-700">{pageStart + 1}</span>–
                      <span className="font-semibold text-slate-700">{Math.min(pageStart + usersPerPage, filteredUsers.length)}</span> of{' '}
                      <span className="font-semibold text-slate-700">{filteredUsers.length}</span> users
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => setUserPage(1)}
                        disabled={safeUserPage === 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
                        title="First page"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setUserPage(Math.max(1, safeUserPage - 1))}
                        disabled={safeUserPage === 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
                        title="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {getPageNumbers(safeUserPage, totalUserPages).map((p, i, arr) => (
                        <React.Fragment key={p}>
                          {i > 0 && arr[i - 1] !== p - 1 && <span className="px-0.5 text-xs text-slate-400">…</span>}
                          <button
                            onClick={() => setUserPage(p)}
                            className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold transition ${p === safeUserPage ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      ))}
                      <button
                        onClick={() => setUserPage(Math.min(totalUserPages, safeUserPage + 1))}
                        disabled={safeUserPage === totalUserPages}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
                        title="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setUserPage(totalUserPages)}
                        disabled={safeUserPage === totalUserPages}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
                        title="Last page"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </button>
                      <select
                        value={usersPerPage}
                        onChange={(e) => setUsersPerPage(Number(e.target.value))}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                        title="Rows per page"
                      >
                        {[10, 25, 50].map((n) => (<option key={n} value={n}>{n} / page</option>))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )
          ) : null}
        </div>

      {/* Add User */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Add New User</DialogTitle><DialogDescription>Create a user account. The organization you enter appears in the Users table.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label className="text-sm font-medium text-slate-700">First Name *</Label><Input value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} placeholder="Juan" className="mt-1.5" /></div>
              <div><Label className="text-sm font-medium text-slate-700">Middle Name</Label><Input value={newUser.middleName} onChange={(e) => setNewUser({ ...newUser, middleName: e.target.value })} placeholder="Dela Cruz" className="mt-1.5" /></div>
            </div>
            <div><Label className="text-sm font-medium text-slate-700">Last Name *</Label><Input value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} placeholder="Santos" className="mt-1.5" /></div>
            <div><Label className="text-sm font-medium text-slate-700">Email *</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@example.com" className="mt-1.5" /></div>
            <div><Label className="text-sm font-medium text-slate-700">Password *</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 6 characters" className="mt-1.5" /></div>
            <div><Label className="text-sm font-medium text-slate-700">Organization</Label><Input value={newUser.organization} onChange={(e) => setNewUser({ ...newUser, organization: e.target.value })} placeholder="e.g. Bureau of Fisheries and Aquatic Resources" className="mt-1.5" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddUserOpen(false); setNewUser({ firstName: '', middleName: '', lastName: '', email: '', password: '', organization: '' }); }} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreateUser} disabled={creatingUser} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
              {creatingUser ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Creating...</span> : <><UserPlus className="mr-1.5 h-4 w-4" />Create Account</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Edit User</DialogTitle><DialogDescription>Update user details, role, and status.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label className="text-sm font-medium text-slate-700">First Name *</Label><Input value={editUser.firstName} onChange={(e) => setEditUser({ ...editUser, firstName: e.target.value })} className="mt-1.5" /></div>
              <div><Label className="text-sm font-medium text-slate-700">Middle Name</Label><Input value={editUser.middleName} onChange={(e) => setEditUser({ ...editUser, middleName: e.target.value })} className="mt-1.5" /></div>
            </div>
            <div><Label className="text-sm font-medium text-slate-700">Last Name *</Label><Input value={editUser.lastName} onChange={(e) => setEditUser({ ...editUser, lastName: e.target.value })} className="mt-1.5" /></div>
            <div><Label className="text-sm font-medium text-slate-700">Email *</Label><Input type="email" value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} className="mt-1.5" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-sm font-medium text-slate-700">Role</Label>
                <select value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Status</Label>
                <select value={editUser.status} onChange={(e) => setEditUser({ ...editUser, status: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10">
                  <option value="active">Active</option>
                  <option value="verifying">Verifying</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Organization</Label>
              <p className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                {editUser.organization || <span className="italic text-slate-400">Wala pang organization</span>}
              </p>
              <p className="mt-1 text-xs text-slate-400">Galing sa profile ng user; siya ang nagpapalit nito sa Settings.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleUpdateUser} disabled={savingUser} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
              {savingUser ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving...</span> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={deleteUserDialog} onOpenChange={setDeleteUserDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete "{deleteUserName}"?</AlertDialogTitle>
            <AlertDialogDescription>This user will be deactivated and cannot log in. You can restore them later from the Deleted tab.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-rose-600 text-white hover:bg-rose-700" onClick={handleDeleteUser}>Yes, delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete User Confirmation */}
      <AlertDialog open={permanentDeleteDialog} onOpenChange={setPermanentDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Permanently delete "{permanentDeleteUserName}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the user account and all of their projects, forms, and responses. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={deletingUserPermanent}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-700 text-white hover:bg-red-800"
              onClick={handlePermanentDeleteUser}
              disabled={deletingUserPermanent}
            >
              {deletingUserPermanent ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Deleting...</span>
              ) : 'Yes, permanently delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AdminLayout>
  );
};

export default AdminDashboard;
