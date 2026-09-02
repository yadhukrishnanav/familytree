'use client';

// Sign in / Sign up form, with magic link (OTP) mode and Google OAuth button.
// Also contains the inline "Have a family code?" quick-access form — users
// enter their code directly here, no separate page needed.

import { useState } from 'react';
import { useAuth } from '../../auth';
import { isSupabaseConfigured } from '../../supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TreePine, Sparkles, AlertCircle, Mail, Eye, EyeOff } from 'lucide-react';
import type { View } from './types';

export function AuthForms({
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
  // Inline quick-access (family code) form state
  const [quickCode, setQuickCode] = useState('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const handleQuickAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickError(null);
    const trimmed = quickCode.trim().toUpperCase();
    if (!trimmed) { setQuickError('Enter your family code'); return; }
    setQuickSubmitting(true);
    // Set quickJoining=true so AuthPage doesn't show the "Welcome / Create
    // a family" intermediary screen in the window between signUp (sets
    // auth.user) and joinFamily (sets activeFamily).
    auth.setQuickJoining(true);
    try {
      const guestId = Math.random().toString(36).slice(2, 10);
      const guestEmail = `guest_${guestId}@familytree.local`;
      const guestPassword = `Guest_${guestId}!`;
      // Sign up (auto-confirmed since mailer_autoconfirm=true).
      const signUpRes = await auth.signUp(guestEmail, guestPassword);
      if (signUpRes.error) {
        // If signup fails (e.g., email already exists), try signing in.
        const signInRes = await auth.signIn(guestEmail, guestPassword);
        if (signInRes.error) { setQuickError(signInRes.error); setQuickSubmitting(false); auth.setQuickJoining(false); return; }
      }
      // Join the family with the code — uses the join_family_by_code RPC
      // (security definer, bypasses RLS).
      const joinRes = await auth.joinFamily(trimmed);
      if (joinRes.error) { setQuickError(joinRes.error); setQuickSubmitting(false); auth.setQuickJoining(false); return; }
      // page.tsx renders FamilyTree directly — no intermediary screen.
      // quickJoining stays true so AuthPage keeps showing AuthForms (not
      // the Welcome screen) until activeFamily is set, then page.tsx takes over.
    } catch (e: any) { setQuickError(e.message ?? 'Something went wrong'); auth.setQuickJoining(false); }
    setQuickSubmitting(false);
  };

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

          {/* Quick family code access — inline form, no separate page.
              User enters code directly here → auto-create guest → join family → canvas. */}
          {!otpSent && !useMagicLink && (
            <form onSubmit={handleQuickAccess} className="mb-4 mt-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-5 text-center" noValidate>
              <p className="mb-3 text-base font-semibold text-emerald-700">Have a family code?</p>
              <Input
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
                placeholder="AB12CD"
                className="font-mono text-center text-lg font-bold tracking-[0.3em] uppercase"
                maxLength={8}
                disabled={quickSubmitting}
                aria-label="Family code"
              />
              <p className="mt-1.5 text-xs text-slate-400">Ask your family member for the 6-character code.</p>
              {quickError && (
                <div className="mt-2 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-left text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{quickError}</span>
                </div>
              )}
              <Button type="submit" disabled={quickSubmitting} className="mt-3 w-full bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 text-lg font-bold shadow-md transition hover:from-emerald-700 hover:to-teal-600 hover:shadow-lg">
                {quickSubmitting ? 'Joining…' : '🔑 Enter Family Tree'}
              </Button>
            </form>
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
