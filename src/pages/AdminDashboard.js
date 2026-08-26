import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Users,
  Building2,
  FolderKanban,
  Plus,
  Search,
  LogOut,
  Trash2,
  Pencil,
  UserPlus,
  Loader2,
  Inbox,
  Mail,
  CalendarDays,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { api } from '../lib/apiMiddleware';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [userFilter, setUserFilter] = useState('active');

  const [addOrgOpen, setAddOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDesc, setNewOrgDesc] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ firstName: '', middleName: '', lastName: '', email: '', password: '', org_id: '' });
  const [creatingUser, setCreatingUser] = useState(false);

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUser, setEditUser] = useState({ id: '', firstName: '', middleName: '', lastName: '', email: '', role: 'user', org_id: '', status: 'active' });
  const [savingUser, setSavingUser] = useState(false);

  const [editOrgOpen, setEditOrgOpen] = useState(false);
  const [editOrg, setEditOrg] = useState({ id: '', name: '', description: '' });
  const [savingOrg, setSavingOrg] = useState(false);

  const [deleteUserDialog, setDeleteUserDialog] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [deleteUserName, setDeleteUserName] = useState('');

  const [deleteOrgDialog, setDeleteOrgDialog] = useState(false);
  const [deleteOrgId, setDeleteOrgId] = useState(null);
  const [deleteOrgName, setDeleteOrgName] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, orgsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/organizations'),
      ]);
      setUsers(usersRes.data || []);
      setOrganizations(orgsRes.data || []);
    } catch (error) {
      console.error('Admin data fetch error:', error);
      toast.error(error.response?.data?.error || 'Failed to load admin data. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogout = () => { logout(); navigate('/'); toast.success('Logged out successfully'); };

  // --- ORG CRUD ---
  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) { toast.error('Organization name is required'); return; }
    setCreatingOrg(true);
    try {
      const res = await api.post('/admin/organizations', { name: newOrgName.trim(), description: newOrgDesc.trim() });
      setOrganizations((prev) => [...prev, res.data]);
      setAddOrgOpen(false); setNewOrgName(''); setNewOrgDesc('');
      toast.success('Organization created successfully');
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to create organization'); }
    finally { setCreatingOrg(false); }
  };

  const handleUpdateOrg = async () => {
    if (!editOrg.name.trim()) { toast.error('Organization name is required'); return; }
    setSavingOrg(true);
    try {
      const res = await api.put(`/admin/organizations/${editOrg.id}`, { name: editOrg.name.trim(), description: editOrg.description.trim() });
      setOrganizations((prev) => prev.map((o) => o.id === editOrg.id ? { ...o, name: editOrg.name.trim(), description: editOrg.description.trim() } : o));
      setEditOrgOpen(false);
      toast.success('Organization updated');
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to update organization'); }
    finally { setSavingOrg(false); }
  };

  const handleDeleteOrg = async () => {
    if (!deleteOrgId) return;
    try {
      await api.delete(`/admin/organizations/${deleteOrgId}`);
      setOrganizations((prev) => prev.filter((o) => o.id !== deleteOrgId));
      setUsers((prev) => prev.map((u) => u.org_id === deleteOrgId ? { ...u, org_id: null } : u));
      toast.success('Organization deleted');
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to delete organization'); }
    setDeleteOrgDialog(false); setDeleteOrgId(null); setDeleteOrgName('');
  };

  // --- USER CRUD ---
  const handleCreateUser = async () => {
    if (!newUser.firstName.trim() || !newUser.lastName.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      toast.error('Please fill in all required fields'); return;
    }
    setCreatingUser(true);
    try {
      const payload = { first_name: newUser.firstName.trim(), middle_name: newUser.middleName.trim(), last_name: newUser.lastName.trim(), email: newUser.email.trim(), password: newUser.password, role: 'user' };
      if (newUser.org_id) payload.org_id = newUser.org_id;
      await api.post('/admin/users', payload);
      setAddUserOpen(false);
      setNewUser({ firstName: '', middleName: '', lastName: '', email: '', password: '', org_id: '' });
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

  const getOrgName = (orgId) => {
    if (!orgId) return 'Unassigned';
    const org = organizations.find((o) => o.id === orgId);
    return org?.name || orgId;
  };

  const filteredUsers = users.filter((u) => {
    if (userFilter === 'active' && u.status === 'deleted') return false;
    if (userFilter === 'deleted' && u.status !== 'deleted') return false;
    const q = searchQuery.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || getOrgName(u.org_id).toLowerCase().includes(q);
  });

  const filteredOrgs = organizations.filter((o) => {
    const q = searchQuery.toLowerCase();
    return o.name?.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q);
  });

  const totalProjects = users.reduce((sum, u) => sum + (u.project_count || 0), 0);

  const formatDate = (value) => {
    if (!value) return 'N/A';
    let date;
    if (typeof value === 'object' && typeof value._seconds === 'number') { date = new Date(value._seconds * 1000); }
    else { date = new Date(value); }
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const initials = (user?.full_name || user?.email || 'A').split(/[\s@._]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'A';

  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-3 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">System Administration</p>
              <h1 className="text-lg font-bold text-slate-900">Admin Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => navigate('/dashboard')} className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 sm:inline-flex">
              <FolderKanban className="h-3.5 w-3.5" /> Projects
            </button>
            <div className="hidden items-center gap-3 rounded-full border border-slate-200/80 bg-white/90 py-1.5 pl-1.5 pr-3 shadow-sm backdrop-blur-sm sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white shadow-md">{initials}</div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900">{user?.full_name || 'Admin'}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
              <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full px-3 pb-24 pt-0 sm:px-4">
        <div className="space-y-8">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900 px-6 py-8 sm:px-10 sm:py-12 text-white shadow-2xl shadow-slate-900/20 text-left">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-violet-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />
            <div className="relative">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-violet-300">Welcome, Admin</p>
              <h2 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl">System Overview</h2>
              <p className="max-w-2xl text-base text-slate-300">Monitor all users and organizations across the platform from one central dashboard.</p>
            </div>
          </section>

          {/* Stats */}
          <section className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {[
              { label: 'Total Users', value: users.length, icon: Users, bg: 'bg-cyan-500', iconBg: 'bg-cyan-50', iconText: 'text-cyan-600' },
              { label: 'Organizations', value: organizations.length, icon: Building2, bg: 'bg-indigo-500', iconBg: 'bg-indigo-50', iconText: 'text-indigo-600' },
              { label: 'Total Projects', value: totalProjects, icon: FolderKanban, bg: 'bg-emerald-500', iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
              { label: 'Active Users', value: users.filter((u) => u.status === 'active').length, icon: UserPlus, bg: 'bg-amber-500', iconBg: 'bg-amber-50', iconText: 'text-amber-600' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className={`absolute inset-y-0 left-0 w-1 ${stat.bg}`} />
                  <div className="pl-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconBg}`}><Icon className={`h-5 w-5 ${stat.iconText}`} /></div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Tabs + Search + Actions */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveTab('users')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Users className="mr-1.5 inline h-4 w-4" /> Users ({users.length})
                </button>
                <button onClick={() => setActiveTab('organizations')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === 'organizations' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Building2 className="mr-1.5 inline h-4 w-4" /> Organizations ({organizations.length})
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={activeTab === 'users' ? 'Search users...' : 'Search organizations...'} className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100" />
                </div>
                <Button onClick={fetchData} variant="outline" size="sm" className="border-slate-200 text-slate-600 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /></Button>
                {activeTab === 'users' && userFilter !== 'deleted' && (
                  <Button onClick={() => setAddUserOpen(true)} className="bg-violet-600 text-white hover:bg-violet-700">
                    <Plus className="mr-1.5 h-4 w-4" /> Add User
                  </Button>
                )}
                {activeTab === 'organizations' && (
                  <Button onClick={() => setAddOrgOpen(true)} className="bg-violet-600 text-white hover:bg-violet-700">
                    <Plus className="mr-1.5 h-4 w-4" /> Add Organization
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
          {loading ? (
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
                <table className="w-full text-left text-sm">
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
                    {filteredUsers.map((u) => {
                      const uid = u.id || u.uid;
                      const userInitials = (u.full_name || u.email || 'U').split(/[\s@._]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'U';
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
                              <span className={u.org_id ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}>{getOrgName(u.org_id)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${u.status === 'deleted' ? 'bg-rose-50 text-rose-700 ring-rose-200' : u.status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
                              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${u.status === 'deleted' ? 'bg-rose-500' : u.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />{u.status || 'active'}
                            </span>
                          </td>
                          <td className="px-6 py-4"><div className="flex items-center gap-2 text-slate-500"><CalendarDays className="h-3.5 w-3.5 text-slate-400" />{formatDate(u.created_at || u.createdAt)}</div></td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1">
                              {u.status === 'deleted' ? (
                                <button onClick={() => handleRestoreUser(uid)} className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600" title="Restore user"><RotateCcw className="h-4 w-4" /></button>
                              ) : (
                                <>
                                  <button onClick={() => openEditUser(u)} className="rounded-lg p-2 text-slate-400 transition hover:bg-violet-50 hover:text-violet-600" title="Edit user"><Pencil className="h-4 w-4" /></button>
                                  <button onClick={() => { setDeleteUserId(uid); setDeleteUserName(u.full_name || u.email); setDeleteUserDialog(true); }} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Delete user"><Trash2 className="h-4 w-4" /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            filteredOrgs.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-left">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Inbox className="h-8 w-8" /></div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">No organizations found</h3>
                <p className="mx-auto mb-6 max-w-md text-sm text-slate-500">{searchQuery ? 'No organizations match your search.' : 'Create the first organization.'}</p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredOrgs.map((org) => {
                  const memberCount = users.filter((u) => u.org_id === org.id).length;
                  return (
                    <div key={org.id} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                      <div className="absolute inset-y-0 left-0 w-1 bg-indigo-500" />
                      <div className="p-6 pl-7">
                        <div className="mb-4 flex items-start justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Building2 className="h-5 w-5" /></div>
                          <div className="flex items-center gap-1 opacity-0 transition-all group-hover:opacity-100">
                            <button onClick={() => { setEditOrg({ id: org.id, name: org.name, description: org.description || '' }); setEditOrgOpen(true); }} className="rounded-lg p-2 text-slate-400 transition hover:bg-violet-50 hover:text-violet-600" title="Edit organization"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => { setDeleteOrgId(org.id); setDeleteOrgName(org.name); setDeleteOrgDialog(true); }} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Delete organization"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                        <h3 className="mb-1 text-lg font-bold text-slate-900">{org.name}</h3>
                        <p className="mb-4 text-sm leading-relaxed text-slate-500">{org.description || 'No description'}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                          {org.createdAt && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(org.createdAt)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </main>

      {/* ========== DIALOGS ========== */}

      {/* Add Organization */}
      <Dialog open={addOrgOpen} onOpenChange={setAddOrgOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Add Organization</DialogTitle><DialogDescription>Create a new organization for grouping users.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Organization Name *</label><Input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="e.g., Department of Social Welfare" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleCreateOrg(); }} /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label><Textarea value={newOrgDesc} onChange={(e) => setNewOrgDesc(e.target.value)} placeholder="Brief description..." rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOrgOpen(false); setNewOrgName(''); setNewOrgDesc(''); }} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreateOrg} disabled={creatingOrg} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
              {creatingOrg ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Creating...</span> : <><Plus className="mr-1.5 h-4 w-4" />Create Organization</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization */}
      <Dialog open={editOrgOpen} onOpenChange={setEditOrgOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Edit Organization</DialogTitle><DialogDescription>Update organization details.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Organization Name *</label><Input value={editOrg.name} onChange={(e) => setEditOrg({ ...editOrg, name: e.target.value })} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateOrg(); }} /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label><Textarea value={editOrg.description} onChange={(e) => setEditOrg({ ...editOrg, description: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrgOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleUpdateOrg} disabled={savingOrg} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
              {savingOrg ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving...</span> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Add New User</DialogTitle><DialogDescription>Create a user account and optionally assign them to an organization.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label className="text-sm font-medium text-slate-700">First Name *</Label><Input value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} placeholder="Juan" className="mt-1.5" /></div>
              <div><Label className="text-sm font-medium text-slate-700">Middle Name</Label><Input value={newUser.middleName} onChange={(e) => setNewUser({ ...newUser, middleName: e.target.value })} placeholder="Dela Cruz" className="mt-1.5" /></div>
            </div>
            <div><Label className="text-sm font-medium text-slate-700">Last Name *</Label><Input value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} placeholder="Santos" className="mt-1.5" /></div>
            <div><Label className="text-sm font-medium text-slate-700">Email *</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@example.com" className="mt-1.5" /></div>
            <div><Label className="text-sm font-medium text-slate-700">Password *</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 6 characters" className="mt-1.5" /></div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Organization</Label>
              <select value={newUser.org_id} onChange={(e) => setNewUser({ ...newUser, org_id: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10">
                <option value="">No organization</option>
                {organizations.map((org) => (<option key={org.id} value={org.id}>{org.name}</option>))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddUserOpen(false); setNewUser({ firstName: '', middleName: '', lastName: '', email: '', password: '', org_id: '' }); }} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreateUser} disabled={creatingUser} className="rounded-xl bg-violet-600 text-white hover:bg-violet-700">
              {creatingUser ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Creating...</span> : <><UserPlus className="mr-1.5 h-4 w-4" />Create Account</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle className="text-xl">Edit User</DialogTitle><DialogDescription>Update user details, role, organization, and status.</DialogDescription></DialogHeader>
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
              <select value={editUser.org_id} onChange={(e) => setEditUser({ ...editUser, org_id: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10">
                <option value="">No organization</option>
                {organizations.map((org) => (<option key={org.id} value={org.id}>{org.name}</option>))}
              </select>
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

      {/* Delete Organization Confirmation */}
      <AlertDialog open={deleteOrgDialog} onOpenChange={setDeleteOrgDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete "{deleteOrgName}"?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the organization. Users assigned to it will become unassigned. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-rose-600 text-white hover:bg-rose-700" onClick={handleDeleteOrg}>Yes, delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;
