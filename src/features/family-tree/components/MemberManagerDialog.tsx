'use client';

// Family Tree — Member management dialog
// Admin/owner can view all members, change roles, or remove members.

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Trash2, Crown, Shield, Pencil, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth';
import {
  fetchFamilyMembers,
  updateMemberRole,
  removeMember,
  type FamilyMember,
} from '../members';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familyId: string;
}

export function MemberManagerDialog({ open, onOpenChange, familyId }: Props) {
  const auth = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // user_id while updating/removing

  const myFamily = auth.families.find((f) => f.id === familyId);
  const canManage = myFamily?.role === 'admin' || myFamily?.role === 'owner';

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    Promise.resolve().then(async () => {
      if (!mounted) return;
      setLoading(true);
      const list = await fetchFamilyMembers(familyId);
      if (mounted) {
        // Always include current user as a fallback (demo mode)
        if (list.length === 0 && auth.user) {
          list.push({
            user_id: auth.user.id,
            email: auth.user.email,
            role: myFamily?.role ?? 'admin',
            created_at: new Date().toISOString(),
          });
        }
        setMembers(list);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [open, familyId, auth.user, myFamily?.role]);

  const handleRoleChange = async (userId: string, role: 'admin' | 'owner' | 'editor') => {
    setBusy(userId);
    const res = await updateMemberRole(familyId, userId, role);
    setBusy(null);
    if (res.error) {
      toast.error('Failed to update role', { description: res.error });
    } else {
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role } : m)));
      toast.success('Role updated');
    }
  };

  const handleRemove = async (userId: string, email: string | null) => {
    if (!confirm(`Remove ${email ?? 'this member'} from the family? They will lose access immediately.`)) return;
    setBusy(userId);
    const res = await removeMember(familyId, userId);
    setBusy(null);
    if (res.error) {
      toast.error('Failed to remove member', { description: res.error });
    } else {
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      toast.success('Member removed', { description: email ?? undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500" />
            Family members
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {members.length}
            </span>
          </DialogTitle>
        </DialogHeader>

        {!canManage && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>You need admin or owner rights to manage members. Ask the family creator to upgrade your role.</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : members.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">No members found.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => {
              const isMe = m.user_id === auth.user?.id;
              const roleIcon = m.role === 'admin' ? <Shield className="h-3 w-3" /> : m.role === 'owner' ? <Crown className="h-3 w-3" /> : <Pencil className="h-3 w-3" />;
              const roleColor = m.role === 'admin' ? 'bg-rose-100 text-rose-700' : m.role === 'owner' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
              return (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
                >
                  {/* Avatar */}
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                    {(m.email?.[0] ?? '?').toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {m.email ?? 'Unknown email'}
                      {isMe && <span className="ml-2 text-[10px] text-slate-400">(you)</span>}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Joined {new Date(m.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Role selector + remove */}
                  {canManage ? (
                    <>
                      <Select
                        value={m.role}
                        onValueChange={(v) => handleRoleChange(m.user_id, v as 'admin' | 'owner' | 'editor')}
                        disabled={busy === m.user_id || isMe}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-1.5">
                              <Shield className="h-3 w-3" /> Admin
                            </span>
                          </SelectItem>
                          <SelectItem value="owner">
                            <span className="flex items-center gap-1.5">
                              <Crown className="h-3 w-3" /> Owner
                            </span>
                          </SelectItem>
                          <SelectItem value="editor">
                            <span className="flex items-center gap-1.5">
                              <Pencil className="h-3 w-3" /> Editor
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {!isMe && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemove(m.user_id, m.email)}
                          disabled={busy === m.user_id}
                          className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                        >
                          {busy === m.user_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </>
                  ) : (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${roleColor}`}>
                      {roleIcon}
                      {m.role}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Invite hint */}
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          <p className="font-medium text-slate-700">Want to add a family member?</p>
          <p className="mt-0.5">
            Share your family code <code className="font-mono font-bold text-emerald-700">{myFamily?.shareCode}</code> with them. They can sign up and use &ldquo;Join with code&rdquo; on the family-select screen.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
