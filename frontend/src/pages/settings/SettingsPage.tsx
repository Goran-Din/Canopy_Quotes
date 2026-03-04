// ============================================================
// Canopy Quotes – Settings Page
// Tabs: Users (owner only) | My Account
// ============================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, User, Plus, Edit2, Ban, RefreshCw, X, Loader2,
  AlertCircle, CheckCircle, Eye, EyeOff, ShieldCheck, Mail, KeyRound
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';

// ─── Types ─────────────────────────────────────────────────
type UserRole = 'owner' | 'n37_super_admin' | 'division_manager' | 'salesperson' | 'coordinator';

interface TeamUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// ─── Role badge ─────────────────────────────────────────────
const ROLE_STYLES: Record<string, string> = {
  owner: 'bg-purple-50 text-purple-700 border-purple-200',
  n37_super_admin: 'bg-red-50 text-red-700 border-red-200',
  division_manager: 'bg-blue-50 text-blue-700 border-blue-200',
  salesperson: 'bg-green-50 text-green-700 border-green-200',
  coordinator: 'bg-gray-50 text-gray-600 border-gray-200',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  n37_super_admin: 'Super Admin',
  division_manager: 'Div. Manager',
  salesperson: 'Salesperson',
  coordinator: 'Coordinator',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[role] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ─── Toast ──────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-5 py-3 shadow-lg text-sm font-medium text-white ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {message}
    </div>
  );
}

// ─── Confirm Dialog ─────────────────────────────────────────
function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle size={22} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-gray-900">{title}</p>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Reset Password Dialog ──────────────────────────────────
function ResetPasswordDialog({ user, onSuccess, onCancel }: {
  user: TeamUser; onSuccess: (name: string) => void; onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  function validate() {
    const e: Record<string, string> = {};
    if (!password || password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (password !== confirmPw) e.confirmPw = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleReset() {
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      await api.put(`/users/${user.id}/reset-password`, { new_password: password });
      onSuccess(`${user.first_name} ${user.last_name}`);
    } catch (e: any) {
      setApiError(e?.response?.data?.message ?? 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <p className="font-bold text-gray-900">Reset Password for {user.first_name} {user.last_name}</p>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {apiError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertCircle size={14} />{apiError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.password ? 'border-red-400' : 'border-gray-300'}`} />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.confirmPw ? 'border-red-400' : 'border-gray-300'}`} />
            {errors.confirmPw && <p className="mt-1 text-xs text-red-600">{errors.confirmPw}</p>}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleReset} disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {loading && <Loader2 size={14} className="animate-spin" />}
              Reset Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit User Form ────────────────────────────────────
function UserForm({ user, onSaved, onCancel }: {
  user?: TeamUser; onSaved: () => void; onCancel: () => void;
}) {
  const isEdit = !!user;
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'salesperson');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  function validate() {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required.';
    if (!lastName.trim()) e.lastName = 'Last name is required.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Valid email is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      if (isEdit) {
        await api.put(`/users/${user!.id}`, { first_name: firstName, last_name: lastName, role });
      } else {
        await api.post('/users', { first_name: firstName, last_name: lastName, email, role });
      }
      onSaved();
    } catch (e: any) {
      setApiError(e?.response?.data?.message ?? 'Failed to save user.');
    } finally {
      setLoading(false);
    }
  }

  const ROLES: { value: UserRole; label: string; desc: string }[] = [
    { value: 'owner', label: 'Owner', desc: 'Full access including pricing, settings & users' },
    { value: 'division_manager', label: 'Division Manager', desc: 'Manage all quotes, customers and team' },
    { value: 'salesperson', label: 'Salesperson', desc: 'Create and manage own quotes and customers' },
    { value: 'coordinator', label: 'Coordinator', desc: 'View-only access to assigned data' },
  ];

  return (
    <div className="space-y-5">
      {apiError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle size={14} />{apiError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.firstName ? 'border-red-400' : 'border-gray-300'}`} />
          {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.lastName ? 'border-red-400' : 'border-gray-300'}`} />
          {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
        </div>
      </div>

      {!isEdit && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email Address *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.email ? 'border-red-400' : 'border-gray-300'}`} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          <p className="mt-1 text-xs text-gray-400">They will receive an email to set their password.</p>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Role *</label>
        <div className="space-y-2">
          {ROLES.map((r) => (
            <button key={r.value} type="button" onClick={() => setRole(r.value)}
              className={`w-full rounded-xl border-2 p-3 text-left transition-all ${role === r.value ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{r.label}</p>
                <RoleBadge role={r.value} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{r.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={handleSave} disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
          {loading && <Loader2 size={14} className="animate-spin" />}
          {isEdit ? 'Save Changes' : 'Add User'}
        </button>
      </div>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────
function UsersTab() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<TeamUser | null>(null);
  const [resetPwTarget, setResetPwTarget] = useState<TeamUser | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const { data, isLoading, error } = useQuery<{ users: TeamUser[] }>({
    queryKey: ['team-users'],
    queryFn: () => api.get('/users'),
  });

  const users = data?.users ?? [];
  const activeUsers = users.filter((u) => u.is_active);
  const inactiveUsers = users.filter((u) => !u.is_active);
  const [showInactive, setShowInactive] = useState(false);

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.put(`/users/${id}/${active ? 'reactivate' : 'deactivate'}`, {}),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['team-users'] });
      showToast(vars.active ? 'User reactivated.' : 'User deactivated.', 'success');
      setDeactivateTarget(null);
    },
    onError: () => showToast('Failed to update user.', 'error'),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Team Members</h2>
          <p className="text-sm text-gray-500">{activeUsers.length} active user{activeUsers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setShowAddForm(true); setEditUser(null); }}
          className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 shadow-sm">
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-2xl border border-green-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center justify-between">
            <p className="font-bold text-green-900">Add New User</p>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="p-6">
            <UserForm
              onSaved={() => {
                setShowAddForm(false);
                queryClient.invalidateQueries({ queryKey: ['team-users'] });
                showToast('User added successfully.', 'success');
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-green-600" size={32} /></div>}
      {error && <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700"><AlertCircle size={16} />Failed to load users.</div>}

      {/* Active users */}
      <div className="space-y-2">
        {activeUsers.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4">
            <div className="flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {u.first_name[0]}{u.last_name[0]}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm truncate">{u.first_name} {u.last_name}</p>
                  <RoleBadge role={u.role} />
                  {u.id === currentUser?.id && <span className="text-xs text-gray-400 flex-shrink-0">(you)</span>}
                </div>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => { setEditUser(u); setShowAddForm(false); }}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                <Edit2 size={12} /> Edit
              </button>
              {u.id !== currentUser?.id && (
                <>
                  <button onClick={() => setResetPwTarget(u)}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    <KeyRound size={12} /> Reset Pw
                  </button>
                  <button onClick={() => setDeactivateTarget(u)}
                    title="Deactivate"
                    className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700">
                    <Ban size={12} /> Deactivate
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Inactive users */}
      {inactiveUsers.length > 0 && (
        <div>
          <button onClick={() => setShowInactive((v) => !v)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 font-medium">
            {showInactive ? '▲' : '▼'} Deactivated Users ({inactiveUsers.length})
          </button>
          {showInactive && (
            <div className="mt-3 space-y-2">
              {inactiveUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 opacity-70">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {u.first_name[0]}{u.last_name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-500 text-sm">{u.first_name} {u.last_name}</p>
                        <RoleBadge role={u.role} />
                      </div>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                  <button onClick={() => toggleActiveMutation.mutate({ id: u.id, active: true })}
                    className="flex items-center gap-1 rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50">
                    <RefreshCw size={12} /> Reactivate
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit slide-over */}
      {editUser && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setEditUser(null)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <p className="font-bold text-gray-900">Edit User</p>
              <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <UserForm
                user={editUser}
                onSaved={() => {
                  setEditUser(null);
                  queryClient.invalidateQueries({ queryKey: ['team-users'] });
                  showToast('User updated.', 'success');
                }}
                onCancel={() => setEditUser(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirm */}
      {deactivateTarget && (
        <ConfirmDialog
          title={`Deactivate ${deactivateTarget.first_name} ${deactivateTarget.last_name}?`}
          message="They will no longer be able to log in. Their quotes and data are preserved."
          confirmLabel="Deactivate"
          onConfirm={() => toggleActiveMutation.mutate({ id: deactivateTarget.id, active: false })}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}

      {/* Reset Password modal */}
      {resetPwTarget && (
        <ResetPasswordDialog
          user={resetPwTarget}
          onSuccess={(name) => {
            setResetPwTarget(null);
            showToast(`Password reset for ${name}.`, 'success');
          }}
          onCancel={() => setResetPwTarget(null)}
        />
      )}

      {toast && <Toast {...toast} />}
    </div>
  );
}

// ─── My Account Tab ──────────────────────────────────────────
function AccountTab() {
  const user = useAuthStore((s) => s.user);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!currentPw) e.currentPw = 'Current password is required.';
    if (!newPw || newPw.length < 8) e.newPw = 'New password must be at least 8 characters.';
    if (newPw !== confirmPw) e.confirmPw = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleChangePassword() {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/auth/change-password', { current_password: currentPw, new_password: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showToast('Password changed successfully.', 'success');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? '';
      if (msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('invalid')) {
        setErrors({ currentPw: 'Current password is incorrect.' });
      } else {
        showToast(msg || 'Failed to change password.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  const PwInput = ({ label, value, onChange, show, onToggle, error }: {
    label: string; value: string; onChange: (v: string) => void;
    show: boolean; onToggle: () => void; error?: string;
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${error ? 'border-red-400' : 'border-gray-300'}`} />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );

  return (
    <div className="space-y-8 max-w-lg">
      {/* Profile info */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-xl">
            {user?.first_name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="font-bold text-gray-900">{user?.first_name} {user?.last_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <RoleBadge role={(user?.role as UserRole) ?? 'salesperson'} />
              <span className="text-xs text-gray-400">{user?.email}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-500">
          <Mail size={15} />
          <span>To change your email address, contact your system administrator.</span>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck size={18} className="text-green-600" />
          <h3 className="font-bold text-gray-900">Change Password</h3>
        </div>
        <div className="space-y-4">
          <PwInput label="Current Password" value={currentPw} onChange={setCurrentPw}
            show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} error={errors.currentPw} />
          <PwInput label="New Password" value={newPw} onChange={setNewPw}
            show={showNew} onToggle={() => setShowNew((v) => !v)} error={errors.newPw} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type={showNew ? 'text' : 'password'} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.confirmPw ? 'border-red-400' : 'border-gray-300'}`} />
            {errors.confirmPw && <p className="mt-1 text-xs text-red-600">{errors.confirmPw}</p>}
          </div>
          <button onClick={handleChangePassword} disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            {loading && <Loader2 size={14} className="animate-spin" />}
            Update Password
          </button>
        </div>
      </div>

      {toast && <Toast {...toast} />}
    </div>
  );
}

// ─── Main Settings Page ──────────────────────────────────────
export default function SettingsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === 'owner' || role === 'n37_super_admin';
  const [activeTab, setActiveTab] = useState<'users' | 'account'>(isOwner ? 'users' : 'account');

  const tabs = [
    ...(isOwner ? [{ id: 'users' as const, label: 'Team Members', icon: <Users size={15} /> }] : []),
    { id: 'account' as const, label: 'My Account', icon: <User size={15} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your team and account</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-gray-100 rounded-xl p-1 w-fit">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'users' && isOwner && <UsersTab />}
        {activeTab === 'account' && <AccountTab />}
      </div>
    </div>
  );
}
