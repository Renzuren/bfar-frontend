import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  KeyRound,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../lib/apiMiddleware';
import { useAuth } from '../context/AuthContext';

const inputClass =
  'h-11 rounded-xl border-slate-200 bg-white text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Settings = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('profile');
  const [loadingUser, setLoadingUser] = useState(true);

  const [profile, setProfile] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    organization: '',
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const [password, setPassword] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [email, setEmail] = useState({ new_email: '', current_password: '' });
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState(false);

  // Load the freshest account details from the backend so the profile form is
  // always pre-filled with accurate first/middle/last name + organization.
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await api.get('/auth/me');
        const data = res.data?.user;
        if (mounted && data) {
          setProfile({
            first_name: data.first_name || '',
            middle_name: data.middle_name || '',
            last_name: data.last_name || '',
            organization: data.organization || (user?.organization || ''),
          });
        }
      } catch {
        // Non-fatal: fall back to the locally stored user object.
        if (mounted) {
          const names = (user?.full_name || '').trim().split(/\s+/);
          setProfile((prev) => ({
            ...prev,
            first_name: prev.first_name || names[0] || '',
            last_name: prev.last_name || names.slice(1).join(' ') || '',
          }));
        }
      } finally {
        if (mounted) setLoadingUser(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user?.full_name, user?.organization]);

  const handleProfileChange = (e) => {
    setProfile((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePasswordChange = (e) => {
    setPassword((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEmailChange = (e) => {
    setEmail((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!profile.first_name.trim() || !profile.last_name.trim()) {
      toast.error('First and last name are required');
      return;
    }
    setUpdatingProfile(true);
    try {
      const res = await api.put('/auth/update_profile', profile);
      const updated = res.data?.user;
      if (updated) {
        updateUser({
          full_name: updated.full_name,
          first_name: updated.first_name,
          middle_name: updated.middle_name,
          last_name: updated.last_name,
          organization: updated.organization,
          email: updated.email,
        });
      }
      toast.success(res.data?.message || 'Profile updated successfully');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update profile'));
    } finally {
      setUpdatingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!password.current_password) {
      toast.error('Please enter your current password');
      return;
    }
    if (password.new_password.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (password.new_password !== password.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    setUpdatingPassword(true);
    try {
      const res = await api.put('/auth/change_password', {
        current_password: password.current_password,
        new_password: password.new_password,
      });
      toast.success(res.data?.message || 'Password changed successfully');
      setPassword({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to change password'));
    } finally {
      setUpdatingPassword(false);
    }
  };

  const saveEmail = async (e) => {
    e.preventDefault();
    if (!email.new_email.trim()) {
      toast.error('Please enter your new email');
      return;
    }
    if (!EMAIL_REGEX.test(email.new_email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!email.current_password) {
      toast.error('Please enter your current password to confirm');
      return;
    }
    setUpdatingEmail(true);
    try {
      const res = await api.put('/auth/change_email', {
        new_email: email.new_email,
        current_password: email.current_password,
      });
      toast.success(res.data?.message || 'Email changed successfully. Please sign in with your new email.');
      updateUser(null);
      logout();
      navigate('/login');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to change email'));
    } finally {
      setUpdatingEmail(false);
    }
  };

  const initials = (user?.full_name || user?.email || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  if (loadingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/80">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
        <div className="flex w-full items-center justify-between px-3 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Account</p>
              <h1 className="text-lg font-bold text-slate-900">Settings</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="text-slate-600">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Projects</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-4">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-lg font-bold text-white shadow-md shadow-cyan-500/20">
            {initials || 'U'}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{user?.full_name || 'User'}</h2>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <span className="mt-1 inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium capitalize text-blue-700">
              {user?.role || 'user'}
            </span>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { id: 'profile', label: 'Personal Information', icon: User },
            { id: 'password', label: 'Change Password', icon: KeyRound },
            { id: 'email', label: 'Change Email', icon: Mail },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'profile' && (
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">Personal Information</h3>
              <p className="mt-0.5 text-sm text-slate-500">Update your account details</p>
            </div>
            <form onSubmit={saveProfile} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium text-slate-700">First Name</Label>
                  <Input
                    name="first_name"
                    value={profile.first_name}
                    onChange={handleProfileChange}
                    placeholder="First name"
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Middle Name</Label>
                  <Input
                    name="middle_name"
                    value={profile.middle_name}
                    onChange={handleProfileChange}
                    placeholder="Middle name"
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Last Name</Label>
                <Input
                  name="last_name"
                  value={profile.last_name}
                  onChange={handleProfileChange}
                  placeholder="Last name"
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Organization</Label>
                <Input
                  name="organization"
                  value={profile.organization}
                  onChange={handleProfileChange}
                  placeholder="Your organization"
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={user?.email || ''} disabled className={`${inputClass} cursor-not-allowed bg-slate-50 pl-11 text-slate-500`} />
                </div>
                <p className="mt-1.5 text-xs text-slate-400">To change your email, use the Change Email tab.</p>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={updatingProfile} className="h-11 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                  {updatingProfile ? (
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving...</span>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'password' && (
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">Change Password</h3>
              <p className="mt-0.5 text-sm text-slate-500">You must confirm your current password</p>
            </div>
            <form onSubmit={savePassword} className="space-y-5 p-6">
              <div>
                <Label className="text-sm font-medium text-slate-700">Current Password</Label>
                <div className="relative mt-1.5">
                  <Input
                    name="current_password"
                    type={showPassword.current ? 'text' : 'password'}
                    value={password.current_password}
                    onChange={handlePasswordChange}
                    autoComplete="current-password"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => ({ ...s, current: !s.current }))}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    aria-label={showPassword.current ? 'Hide current password' : 'Show current password'}
                  >
                    {showPassword.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium text-slate-700">New Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      name="new_password"
                      type={showPassword.new ? 'text' : 'password'}
                      value={password.new_password}
                      onChange={handlePasswordChange}
                      autoComplete="new-password"
                      className={`${inputClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => ({ ...s, new: !s.new }))}
                      tabIndex={-1}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                      aria-label={showPassword.new ? 'Hide new password' : 'Show new password'}
                    >
                      {showPassword.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">At least 6 characters</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Confirm New Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      name="confirm_password"
                      type={showPassword.confirm ? 'text' : 'password'}
                      value={password.confirm_password}
                      onChange={handlePasswordChange}
                      autoComplete="new-password"
                      className={`${inputClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => ({ ...s, confirm: !s.confirm }))}
                      tabIndex={-1}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                      aria-label={showPassword.confirm ? 'Hide confirmation' : 'Show confirmation'}
                    >
                      {showPassword.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={updatingPassword} className="h-11 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                  {updatingPassword ? (
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Updating...</span>
                  ) : (
                    'Change Password'
                  )}
                </Button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'email' && (
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">Change Email</h3>
              <p className="mt-0.5 text-sm text-slate-500">You must confirm with your current password</p>
            </div>
            <form onSubmit={saveEmail} className="space-y-5 p-6">
              <div>
                <Label className="text-sm font-medium text-slate-700">Current Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={user?.email || ''} disabled className={`${inputClass} cursor-not-allowed bg-slate-50 pl-11 text-slate-500`} />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">New Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    name="new_email"
                    type="email"
                    value={email.new_email}
                    onChange={handleEmailChange}
                    placeholder="newemail@example.com"
                    className={`${inputClass} pl-11`}
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Current Password</Label>
                <div className="relative mt-1.5">
                  <Input
                    name="current_password"
                    type={showEmailPassword ? 'text' : 'password'}
                    value={email.current_password}
                    onChange={handleEmailChange}
                    autoComplete="current-password"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailPassword(!showEmailPassword)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    aria-label={showEmailPassword ? 'Hide password' : 'Show password'}
                  >
                    {showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />
                  You will be signed out and must log in with your new email.
                </p>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={updatingEmail} className="h-11 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                  {updatingEmail ? (
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Updating...</span>
                  ) : (
                    'Change Email'
                  )}
                </Button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
};

export default Settings;
