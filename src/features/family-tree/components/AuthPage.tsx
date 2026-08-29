'use client';

// Family Tree — Auth page
// Five views: sign-in, sign-up, family-select, family-create, family-join

import { useState } from 'react';
import { useAuth } from '../auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Users, Plus, LogIn, LogOut, TreePine, Copy, Check, Sparkles, AlertCircle, Mail, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { isSupabaseConfigured } from '../supabase';

type View = 'sign-in' | 'sign-up' | 'family-select' | 'family-create' | 'family-join' | 'quick-access';

export function AuthPage() {
  const auth = useAuth();
  const [view, setView] = useState<View>(auth.user ? 'family-select' : 'sign-in');

  if (!auth.user) {
    if (view === 'quick-access') return <QuickAccess auth={auth} setView={setView} />;
    return <AuthForms initialView={view} setView={setView} />;
  }
  // If user has families, go straight to family-select (or the active family)
  if (auth.families.length > 0 && auth.activeFamily) {
    // The page.tsx will render FamilyTree since auth.user and auth.activeFamily are set
    return null;
  }
  if (auth.families.length === 0 && view !== 'family-create' && view !== 'family-join') {
    return <FamilyCreateOrJoin setView={setView} />;
  }
  if (view === 'family-create') {
    return <CreateFamily setView={setView} />;
  }
  if (view === 'family-join') {
    return <JoinFamily setView={setView} />;
  }
  return <FamilySelect setView={setView} />;
}

// ---------- Quick Access (family code only, for elders) ----------
function QuickAccess({ auth, setView }: { auth: ReturnType<typeof useAuth>; setView: (v: View) => void }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Enter your family code'); return; }
    setSubmitting(true);
    try {
      const guestId = Math.random().toString(36).slice(2, 10);
      const guestEmail = `guest_${guestId}@familytree.local`;
      const guestPassword = `Guest_${guestId}!`;
      // Sign up (auto-confirmed since mailer_autoconfirm=true)
      const signUpRes = await auth.signUp(guestEmail, guestPassword);
      if (signUpRes.error) {
        // If signup fails (e.g., email exists), try signing in
        const signInRes = await auth.signIn(guestEmail, guestPassword);
        if (signInRes.error) { setError(signInRes.error); setSubmitting(false); return; }
      }
      // Wait for auth state to propagate (user should be set now)
      await new Promise(r => setTimeout(r, 500));
      // Join the family with the code
      const joinRes = await auth.joinFamily(trimmed);
      if (joinRes.error) { setError(joinRes.error); setSubmitting(false); return; }
      // The auth context will now have the family set as active,
      // and page.tsx will render FamilyTree directly — no "Create a family" screen.
    } catch (e: any) { setError(e.message ?? 'Something went wrong'); }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
              <TreePine className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Family Tree</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your family code to get started</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur-md ring-1 ring-slate-200">
            <form onSubmit={handleQuickAccess} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="familyCode">Family code</Label>
                <Input id="familyCode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="AB12CD" className="font-mono text-center text-lg font-bold tracking-[0.3em] uppercase" maxLength={8} autoFocus required />
                <p className="mt-1.5 text-xs text-slate-400">Ask your family member for the 6-character code.</p>
              </div>
              {error && <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
              <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600">{submitting ? 'Joining…' : 'Enter Family Tree'}</Button>
            </form>
          </div>
          <button onClick={() => { setView('sign-in'); setError(null); }} className="mt-4 w-full text-center text-xs text-slate-500 hover:text-emerald-600">← Sign in with email instead</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Sign in / Sign up ----------
function AuthForms({
  initialView,
  setView,
}: {
  initialView: View;
  setView: (v: View) => void;
}) {
  const auth = useAuth();
  const [isSignUp, setIsSignUp] = useState(initialView === 'sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Magic link (OTP) mode
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    // Magic link flow
    if (useMagicLink) {
      if (!otpSent) {
        // Step 1: send OTP
        setSubmitting(true);
        const res = await auth.signInWithOtp(email.trim());
        setSubmitting(false);
        if (res.error) {
          setError(res.error);
        } else {
          setOtpSent(true);
          setInfo(`We sent a 6-digit code to ${email.trim()}. Check your inbox and enter it below.`);
        }
        return;
      }
      // Step 2: verify OTP
      if (!otpCode.trim()) {
        setError('Enter the 6-digit code from your email');
        return;
      }
      setSubmitting(true);
      const res = await auth.verifyOtp(email.trim(), otpCode.trim());
      setSubmitting(false);
      if (res.error) {
        setError(res.error);
      } else {
        setInfo('Signed in! Loading your families…');
      }
      return;
    }
    // Password flow
    if (!password) {
      setError('Password is required');
      return;
    }
    if (isSignUp && password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (isSignUp && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    const res = isSignUp
      ? await auth.signUp(email.trim(), password)
      : await auth.signIn(email.trim(), password);
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
    } else {
      setView('family-select');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Brand header */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
              <TreePine className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Family Tree</h1>
            <p className="text-sm text-slate-500">
              Build, visualize, and share your family's story
            </p>
            {!isSupabaseConfigured && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-700">
                <Sparkles className="h-3 w-3" />
                Demo mode — sign in with any email to explore
              </div>
            )}
          </div>

          {/* Quick family code access — prominent, above sign-in */}
          {!otpSent && !useMagicLink && (
            <div className="mb-4 mt-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-5 text-center">
              <p className="mb-3 text-base font-semibold text-emerald-700">Have a family code?</p>
              <button type="button" onClick={() => { setView('quick-access'); setError(null); }} className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 text-lg font-bold text-white shadow-md transition hover:from-emerald-700 hover:to-teal-600 hover:shadow-lg">🔑 Enter Family Code</button>
              <p className="mt-2 text-xs text-slate-400">Simplest way to join — no email needed</p>
            </div>
          )}

          <div className="rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur-md ring-1 ring-slate-200">
            {/* Sign-in / Sign-up toggle — hidden in magic link mode */}
            {!useMagicLink && (
              <div className="mb-4 flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => { setIsSignUp(false); setError(null); }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    !isSignUp ? 'bg-white shadow text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => { setIsSignUp(true); setError(null); }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isSignUp ? 'bg-white shadow text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  Create account
                </button>
              </div>
            )}

            <form onSubmit={submit} className="space-y-3" noValidate>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={otpSent}
                  required
                />
              </div>

              {/* Magic link OTP code input (shown after sending) */}
              {useMagicLink && otpSent && (
                <div>
                  <Label htmlFor="otp">6-digit code</Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="text-center text-lg font-bold tracking-[0.5em]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtpCode(''); setInfo(null); setError(null); }}
                    className="mt-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    ← Use a different email
                  </button>
                </div>
              )}

              {/* Password fields — hidden in magic link mode */}
              {!useMagicLink && (
                <>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {isSignUp && (
                    <div>
                      <Label htmlFor="confirm">Confirm password</Label>
                      <div className="relative">
                        <Input
                          id="confirm"
                          type={showConfirm ? 'text' : 'password'}
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          placeholder="Re-enter password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          tabIndex={-1}
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Info message (OTP sent) */}
              {info && !error && (
                <div className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{info}</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600">
                {submitting
                  ? 'Please wait...'
                  : useMagicLink
                    ? otpSent ? 'Verify code' : 'Send code'
                    : isSignUp ? 'Create account' : 'Sign in'}
              </Button>
            </form>

            {/* Toggle between password and magic link */}
            {!otpSent && (
              <button
                type="button"
                onClick={() => { setUseMagicLink(!useMagicLink); setError(null); setInfo(null); }}
                className="mt-3 w-full text-center text-xs text-slate-500 hover:text-emerald-600"
              >
                {useMagicLink
                  ? '← Sign in with password instead'
                  : '✉️ Sign in with email link (no password needed)'}
              </button>
            )}
          </div>
          <p className="mt-4 text-center text-[12px] font-medium text-slate-800">
            Built with &#10084; by one among us
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Family create or join (when user has no families yet) ----------
function FamilyCreateOrJoin({ setView }: { setView: (v: View) => void }) {
  const auth = useAuth();
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
            <TreePine className="h-7 w-7 text-white" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-slate-800">Welcome, {auth.user?.email}!</h2>
          <p className="mb-6 text-sm text-slate-500">
            Create a new family tree, or join an existing one with a share code.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setView('family-create')}
              className="flex w-full items-center gap-3 rounded-xl bg-white p-4 text-left shadow ring-1 ring-slate-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-800">Create a family</div>
                <div className="text-xs text-slate-500">Start a new tree from scratch</div>
              </div>
            </button>
            <button
              onClick={() => setView('family-join')}
              className="flex w-full items-center gap-3 rounded-xl bg-white p-4 text-left shadow ring-1 ring-slate-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                <LogIn className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-800">Join with a code</div>
                <div className="text-xs text-slate-500">Enter a share code from a family member</div>
              </div>
            </button>
          </div>
          <button
            onClick={() => auth.signOut()}
            className="mt-6 text-xs text-slate-400 hover:text-slate-600"
          >
            Sign out
          </button>
          <p className="mt-4 text-center text-[12px] font-medium text-slate-800">
            Built with &#10084; by one among us
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Create family ----------
function CreateFamily({ setView }: { setView: (v: View) => void }) {
  const auth = useAuth();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await auth.createFamily(name);
    setSubmitting(false);
    if (res.error) setError(res.error);
    else setView('family-select');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur-md ring-1 ring-slate-200">
          <h2 className="mb-4 text-xl font-bold text-slate-800">Create a family</h2>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="familyName">Family name</Label>
              <Input
                id="familyName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The Sharma Family"
                autoFocus
                required
              />
            </div>
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setView('family-select')}>
                Back
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create family'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---------- Join family ----------
function JoinFamily({ setView }: { setView: (v: View) => void }) {
  const auth = useAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await auth.joinFamily(code);
    setSubmitting(false);
    if (res.error) setError(res.error);
    else setView('family-select');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur-md ring-1 ring-slate-200">
          <h2 className="mb-4 text-xl font-bold text-slate-800">Join a family</h2>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="shareCode">Share code</Label>
              <Input
                id="shareCode"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="AB12CD"
                className="font-mono uppercase"
                autoFocus
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Ask a family member for the 6-character code shown in their header.
              </p>
            </div>
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setView('family-select')}>
                Back
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Joining...' : 'Join family'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---------- Family select ----------
function FamilySelect({ setView }: { setView: (v: View) => void }) {
  const auth = useAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyShareCode = async (familyId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(familyId);
      toast.success('Share code copied!', { description: `"${code}" is ready to paste.` });
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Your families</h2>
              <p className="text-sm text-slate-500">Signed in as {auth.user?.email}</p>
            </div>
            <button
              onClick={() => auth.signOut()}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {auth.families.map((fam) => {
              const active = fam.id === auth.activeFamily?.id;
              return (
                <div
                  key={fam.id}
                  className={`rounded-2xl bg-white p-4 shadow ring-1 transition hover:shadow-md ${
                    active ? 'ring-2 ring-emerald-400' : 'ring-slate-200'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{fam.name}</div>
                        <div className="text-xs text-slate-500">
                          {fam.memberCount} {fam.memberCount === 1 ? 'member' : 'members'}
                        </div>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      fam.role === 'admin'
                        ? 'bg-rose-100 text-rose-700'
                        : fam.role === 'owner'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-teal-100 text-teal-700'
                    }`}>
                      {fam.role}
                    </span>
                  </div>

                  <div className="mb-3 flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1.5">
                    <span className="text-[10px] font-medium uppercase text-slate-400">Code:</span>
                    <code className="flex-1 font-mono text-sm font-bold text-slate-700">{fam.shareCode}</code>
                    <button
                      onClick={() => copyShareCode(fam.id, fam.shareCode)}
                      className="rounded p-1 hover:bg-slate-200"
                      aria-label="Copy share code"
                    >
                      {copiedId === fam.id ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                      )}
                    </button>
                  </div>

                  <Button
                    onClick={() => auth.setActiveFamilyId(fam.id)}
                    className={`w-full ${
                      active
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                    variant={active ? 'default' : 'secondary'}
                  >
                    {active ? 'Currently active' : 'Open'}
                  </Button>
                </div>
              );
            })}

            <button
              onClick={() => setView('family-create')}
              className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm font-medium">Create new family</span>
            </button>
            <button
              onClick={() => setView('family-join')}
              className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-600"
            >
              <LogIn className="h-6 w-6" />
              <span className="text-sm font-medium">Join with code</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// Magic link v2
