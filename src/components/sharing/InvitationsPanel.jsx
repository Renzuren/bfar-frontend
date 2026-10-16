import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, MailOpen, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, getApiErrorMessage } from '../../lib/apiMiddleware';
import { ROLE_BADGE, ROLE_LABELS } from '../../lib/projectRoles';

// Project invitations waiting for the signed-in user's answer, shown on the
// dashboard. Accepting adds the project to their list and opens it.
export default function InvitationsPanel({ onAccepted }) {
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/invites');
      setInvites(Array.isArray(data) ? data : []);
    } catch (_) {
      // Invitations are optional on the dashboard; keep it quiet.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (invite, accept) => {
    setBusyId(invite.id);
    try {
      await api.post(`/invites/${invite.id}/${accept ? 'accept' : 'decline'}`);
      setInvites((list) => list.filter((i) => i.id !== invite.id));
      if (accept) {
        toast.success(`You now have access to "${invite.project_title}"`);
        await onAccepted?.();
        navigate(`/projects/${invite.project_id}`);
      } else {
        toast.success('Invitation declined');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not answer the invitation'));
      load();
    } finally {
      setBusyId(null);
    }
  };

  if (invites.length === 0) return null;

  return (
    <section className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <MailOpen className="h-5 w-5 text-cyan-700" />
        <h2 className="text-sm font-bold text-slate-900">
          Project invitations <span className="ml-1 rounded-full bg-cyan-600 px-2 py-0.5 text-[11px] text-white">{invites.length}</span>
        </h2>
      </div>
      <div className="space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{invite.project_title || 'Untitled project'}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {invite.inviter_name || invite.inviter_email || 'Someone'} invited you as{' '}
                <span className={`ml-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${ROLE_BADGE[invite.role]}`}>
                  {ROLE_LABELS[invite.role] || invite.role}
                </span>
                <span className="ml-1.5 text-slate-400">· {invite.project_has_baseline ? 'Baseline' : 'No Baseline'}</span>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === invite.id}
                onClick={() => respond(invite, false)}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" /> Decline
              </Button>
              <Button
                size="sm"
                disabled={busyId === invite.id}
                onClick={() => respond(invite, true)}
                className="gap-1.5 bg-cyan-600 hover:bg-cyan-700"
              >
                {busyId === invite.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Accept
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
