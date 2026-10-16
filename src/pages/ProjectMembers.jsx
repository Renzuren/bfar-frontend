import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Crown, Loader2, LogOut, Mail, Send, Trash2, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api, getApiErrorMessage } from '../lib/apiMiddleware';
import { useProject } from '../context/ProjectContext';
import { ROLE_BADGE, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../lib/projectRoles';

const RoleBadge = ({ role }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${ROLE_BADGE[role]}`}>
    {role === 'owner' && <Crown className="h-3 w-3" />}
    {ROLE_LABELS[role] || role}
  </span>
);

const Person = ({ name, email }) => (
  <div className="min-w-0">
    <p className="truncate text-sm font-semibold text-slate-900">{name || email || 'Unknown user'}</p>
    {name && email && <p className="truncate text-xs text-slate-500">{email}</p>}
  </div>
);

// Members & Sharing: who has access to the project and with which role.
// Owner: invites anyone, changes any role, removes anyone, transfers ownership.
// Admin: invites and manages editors and viewers. Everyone else: read only
// (and can leave the project).
export default function ProjectMembers() {
  const { project } = useOutletContext();
  const navigate = useNavigate();
  const { fetchProject, fetchProjects } = useProject();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);
  const [busyUid, setBusyUid] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${project.id}/members`);
      setData(res.data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not load the members'));
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const myRole = data.my_role;
  const isOwner = myRole === 'owner';
  const canManage = isOwner || myRole === 'admin';
  // The owner manages anyone; an admin only editors and viewers.
  const canManageMember = (member) => member.uid !== data.my_uid && (isOwner || (myRole === 'admin' && member.role !== 'admin'));
  const assignableRoles = isOwner ? ['admin', 'editor', 'viewer'] : ['editor', 'viewer'];

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.post(`/projects/${project.id}/invites`, { email: inviteEmail.trim(), role: inviteRole });
      toast.success(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not send the invitation'));
    } finally {
      setInviting(false);
    }
  };

  const cancelInvite = async (invite) => {
    setBusyUid(invite.id);
    try {
      await api.delete(`/projects/${project.id}/invites/${invite.id}`);
      toast.success('Invitation withdrawn');
      load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not withdraw the invitation'));
    } finally {
      setBusyUid(null);
    }
  };

  const changeRole = async (member, role) => {
    if (role === member.role) return;
    setBusyUid(member.uid);
    try {
      await api.put(`/projects/${project.id}/members/${member.uid}`, { role });
      toast.success(`${member.name || member.email} is now ${ROLE_LABELS[role]}`);
      load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not change the role'));
    } finally {
      setBusyUid(null);
    }
  };

  const removeMember = async (member) => {
    setBusyUid(member.uid);
    try {
      await api.delete(`/projects/${project.id}/members/${member.uid}`);
      toast.success(`${member.name || member.email} no longer has access`);
      load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not remove the member'));
    } finally {
      setBusyUid(null);
    }
  };

  const leaveProject = async () => {
    setLeaveOpen(false);
    try {
      await api.delete(`/projects/${project.id}/members/${data.my_uid}`);
      toast.success(`You left "${project.title}"`);
      await fetchProjects();
      navigate('/dashboard');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not leave the project'));
    }
  };

  const titleMatches = confirmTitle.trim() === String(project.title || '').trim();

  const transferOwnership = async () => {
    if (!transferTarget || !titleMatches) return;
    setTransferring(true);
    try {
      await api.post(`/projects/${project.id}/transfer`, { uid: transferTarget.uid, confirm_title: confirmTitle.trim() });
      toast.success(`${transferTarget.name || transferTarget.email} is now the owner. You are an admin.`);
      setTransferTarget(null);
      setConfirmTitle('');
      // Refresh my role everywhere (sidebar, banner, buttons).
      await Promise.all([fetchProject(project.id), fetchProjects()]);
      load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not transfer ownership'));
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6 px-3 pb-24 pt-4 sm:px-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Users className="h-5 w-5 text-slate-500" /> Members &amp; Sharing
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          People with access to this project. Your role: <RoleBadge role={myRole} />
        </p>
      </div>

      {/* Invite */}
      {canManage && (
        <form onSubmit={handleInvite} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <UserPlus className="h-4 w-4 text-cyan-600" /> Invite someone
          </h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <div>
              <Label htmlFor="invite-email" className="mb-1.5 block text-xs font-medium text-slate-500">Email of a registered user</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-10"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-slate-500">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviting || !inviteEmail.trim()} className="h-10 gap-2 bg-cyan-600 hover:bg-cyan-700">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send invite
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">{ROLE_DESCRIPTIONS[inviteRole]}</p>
        </form>
      )}

      {/* Members */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            People with access <span className="ml-1 text-slate-400">{data.members.length + 1}</span>
          </h2>
        </div>
        <ul className="divide-y divide-slate-100">
          <li className="flex items-center justify-between gap-3 px-5 py-3">
            <Person name={data.owner.name} email={data.owner.email} />
            <RoleBadge role="owner" />
          </li>
          {data.members.map((member) => (
            <li key={member.uid} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <Person name={member.name} email={member.email} />
              <div className="flex flex-wrap items-center gap-2">
                {canManageMember(member) ? (
                  <Select value={member.role} onValueChange={(role) => changeRole(member, role)} disabled={busyUid === member.uid}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((role) => (
                        <SelectItem key={role} value={role} className="text-xs">{ROLE_LABELS[role]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <RoleBadge role={member.role} />
                )}
                {isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => { setTransferTarget(member); setConfirmTitle(''); }}
                  >
                    <Crown className="h-3.5 w-3.5" /> Make owner
                  </Button>
                )}
                {canManageMember(member) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyUid === member.uid}
                    onClick={() => removeMember(member)}
                    className="h-8 w-8 p-0 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Remove access"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {member.uid === data.my_uid && (
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs text-rose-600" onClick={() => setLeaveOpen(true)}>
                    <LogOut className="h-3.5 w-3.5" /> Leave project
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {data.members.length === 0 && (
          <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
            This project is not shared with anyone yet.
          </p>
        )}
      </div>

      {/* Pending invitations */}
      {canManage && data.invites.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Waiting for an answer</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.invites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate text-sm text-slate-700">{invite.invitee_email}</span>
                  <RoleBadge role={invite.role} />
                </div>
                {(isOwner || invite.role !== 'admin') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyUid === invite.id}
                    onClick={() => cancelInvite(invite)}
                    className="h-8 gap-1.5 text-xs text-slate-500 hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" /> Withdraw
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Role guide */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5 text-xs text-slate-600">
        <p className="mb-2 font-semibold text-slate-700">What each role can do</p>
        <ul className="space-y-1">
          {['owner', 'admin', 'editor', 'viewer'].map((role) => (
            <li key={role}><span className="font-semibold">{ROLE_LABELS[role]}:</span> {ROLE_DESCRIPTIONS[role]}</li>
          ))}
        </ul>
      </div>

      {/* Transfer ownership: type the project name to confirm */}
      <Dialog open={Boolean(transferTarget)} onOpenChange={(open) => { if (!open) { setTransferTarget(null); setConfirmTitle(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership?</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-slate-700">{transferTarget?.name || transferTarget?.email}</span> will become the
              owner of this project. You will stay on as an admin and can no longer delete the project or transfer it back
              yourself.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-title" className="text-sm">
              Type the project name <span className="font-semibold text-slate-900">{project.title}</span> to confirm
            </Label>
            <Input
              id="confirm-title"
              value={confirmTitle}
              onChange={(e) => setConfirmTitle(e.target.value)}
              placeholder={project.title}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTransferTarget(null); setConfirmTitle(''); }}>Cancel</Button>
            <Button
              onClick={transferOwnership}
              disabled={!titleMatches || transferring}
              className="gap-2 bg-rose-600 hover:bg-rose-700"
            >
              {transferring && <Loader2 className="h-4 w-4 animate-spin" />}
              Transfer ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this project?</DialogTitle>
            <DialogDescription>
              You will lose access to &quot;{project.title}&quot; until someone invites you again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>Cancel</Button>
            <Button onClick={leaveProject} className="bg-rose-600 hover:bg-rose-700">Leave project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
