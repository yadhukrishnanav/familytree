'use client';

// Family Tree — Auth context
// Wraps Supabase auth (or demo-mode auth fallback when Supabase isn't configured).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getSupabase, isSupabaseConfigured } from './supabase';
import type { FamilyInfo } from './types';

interface DemoUser {
  id: string;
  email: string;
}

export interface AuthContextValue {
  user: DemoUser | null;
  families: FamilyInfo[];
  activeFamily: FamilyInfo | null;
  loading: boolean;
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithOtp: (email: string) => Promise<{ error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  setActiveFamilyId: (id: string) => void;
  createFamily: (name: string) => Promise<{ error?: string; family?: FamilyInfo }>;
  joinFamily: (shareCode: string) => Promise<{ error?: string; family?: FamilyInfo }>;
  refreshFamilies: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---- Demo-mode helpers (localStorage) ----
const DEMO_USERS_KEY = 'family-tree-demo-users';
const DEMO_SESSION_KEY = 'family-tree-demo-session';
const DEMO_FAMILIES_KEY = 'family-tree-demo-families';
const DEMO_MEMBERS_KEY = 'family-tree-demo-members';

interface DemoUserRecord extends DemoUser {
  passwordHash: string; // simple hash; demo only
}

interface DemoFamily {
  id: string;
  name: string;
  shareCode: string;
  createdAt: string;
}

interface DemoMembership {
  userId: string;
  familyId: string;
  role: 'admin' | 'owner' | 'editor';
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}

function loadDemoUsers(): DemoUserRecord[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_USERS_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveDemoUsers(users: DemoUserRecord[]) {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
}
function loadDemoFamilies(): DemoFamily[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_FAMILIES_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveDemoFamilies(fams: DemoFamily[]) {
  localStorage.setItem(DEMO_FAMILIES_KEY, JSON.stringify(fams));
}
function loadDemoMembers(): DemoMembership[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_MEMBERS_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveDemoMembers(m: DemoMembership[]) {
  localStorage.setItem(DEMO_MEMBERS_KEY, JSON.stringify(m));
}

function genShareCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [user, setUser] = useState<DemoUser | null>(null);
  const [families, setFamilies] = useState<FamilyInfo[]>([]);
  const [activeFamilyId, setActiveFamilyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- Refresh families helper (declared before useEffect that uses it) ----
  const refreshFamiliesFor = useCallback(async (userId: string) => {
    if (isSupabaseConfigured && supabase) {
      // Query family_members joined with families
      const { data, error } = await supabase
        .from('family_members')
        .select('family_id, role, families(id, name, share_code)')
        .eq('user_id', userId);
      if (error) {
        console.error('Failed to load families', error);
        setFamilies([]);
        return;
      }
      const list: FamilyInfo[] = [];
      for (const row of (data as any[]) ?? []) {
        const fam = row.families;
        if (!fam) continue;
        // Get member count for each family
        const { count } = await supabase
          .from('family_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('family_id', fam.id);
        list.push({
          id: fam.id,
          name: fam.name,
          shareCode: fam.share_code,
          role: row.role,
          memberCount: count ?? 0,
        });
      }
      setFamilies(list);
      // Preserve current selection if possible
      setActiveFamilyIdState((prev) => {
        if (prev && list.some((f) => f.id === prev)) return prev;
        return list.length > 0 ? list[0].id : null;
      });
    } else {
      // Demo mode
      const demoFamilies = loadDemoFamilies();
      const members = loadDemoMembers();
      const mine = members.filter((m) => m.userId === userId);
      const list: FamilyInfo[] = mine.map((m) => {
        const f = demoFamilies.find((x) => x.id === m.familyId)!;
        return {
          id: f.id,
          name: f.name,
          shareCode: f.shareCode,
          role: m.role,
          memberCount: members.filter((x) => x.familyId === f.id).length,
        };
      });
      setFamilies(list);
      setActiveFamilyIdState((prev) => {
        if (prev && list.some((f) => f.id === prev)) return prev;
        return list.length > 0 ? list[0].id : null;
      });
    }
  }, [supabase]);

  // ---- Initial session load ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const sUser = data.session?.user;
        if (sUser) {
          setUser({ id: sUser.id, email: sUser.email ?? '' });
          await refreshFamiliesFor(sUser.id);
        }
      } else {
        // Demo mode
        const session = localStorage.getItem(DEMO_SESSION_KEY);
        if (session) {
          try {
            const u = JSON.parse(session) as DemoUser;
            setUser(u);
            await refreshFamiliesFor(u.id);
          } catch {
            localStorage.removeItem(DEMO_SESSION_KEY);
          }
        }
      }
      setLoading(false);
    })();

    let unsubscribe: (() => void) | undefined;
    if (isSupabaseConfigured && supabase) {
      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const sUser = session?.user;
        if (sUser) {
          setUser({ id: sUser.id, email: sUser.email ?? '' });
          await refreshFamiliesFor(sUser.id);
        } else {
          setUser(null);
          setFamilies([]);
          setActiveFamilyIdState(null);
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    }
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [refreshFamiliesFor, supabase]);

  const refreshFamilies = useCallback(async () => {
    if (user) await refreshFamiliesFor(user.id);
  }, [user, refreshFamiliesFor]);

  // ---- Actions ----
  const signIn = useCallback(async (email: string, password: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return {};
    }
    // Demo mode
    const users = loadDemoUsers();
    const found = users.find((u) => u.email === email);
    if (!found) return { error: 'No account with that email. Sign up first.' };
    if (found.passwordHash !== simpleHash(password)) return { error: 'Incorrect password.' };
    const sess: DemoUser = { id: found.id, email: found.email };
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(sess));
    setUser(sess);
    await refreshFamiliesFor(sess.id);
    return {};
  }, [supabase, refreshFamiliesFor]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      if (data.user) {
        const sess: DemoUser = { id: data.user.id, email: data.user.email ?? email };
        setUser(sess);
        await refreshFamiliesFor(sess.id);
      }
      return {};
    }
    // Demo mode
    const users = loadDemoUsers();
    if (users.some((u) => u.email === email)) return { error: 'Email already registered.' };
    const newUser: DemoUserRecord = {
      id: crypto.randomUUID(),
      email,
      passwordHash: simpleHash(password),
    };
    users.push(newUser);
    saveDemoUsers(users);
    const sess: DemoUser = { id: newUser.id, email };
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(sess));
    setUser(sess);
    await refreshFamiliesFor(sess.id);
    return {};
  }, [supabase, refreshFamiliesFor]);

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        error:
          'Google sign-in requires a configured Supabase project. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local, then enable Google OAuth in your Supabase dashboard (Authentication → Providers → Google).',
      };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Redirect back to the current page after Google OAuth completes
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) return { error: error.message };
    // The browser will redirect to Google and back; session is picked up by onAuthStateChange
    return {};
  }, [supabase]);

  // ---- Magic Link (OTP) sign-in ----
  // Step 1: send a 6-digit code to the user's email
  const signInWithOtp = useCallback(async (email: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        error:
          'Magic link sign-in requires a configured Supabase project. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local, then enable Email OTP in your Supabase dashboard (Authentication → Providers → Email → enable Email OTP).',
      };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) return { error: error.message };
    return {};
  }, [supabase]);

  // Step 2: verify the 6-digit code the user received
  const verifyOtp = useCallback(async (email: string, token: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: 'Magic link requires a configured Supabase project.' };
    }
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) return { error: error.message };
    // Session is set automatically by Supabase; onAuthStateChange will pick it up
    if (data.user) {
      setUser({ id: data.user.id, email: data.user.email ?? email });
      await refreshFamiliesFor(data.user.id);
    }
    return {};
  }, [supabase, refreshFamiliesFor]);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem(DEMO_SESSION_KEY);
    }
    setUser(null);
    setFamilies([]);
    setActiveFamilyIdState(null);
  }, [supabase]);

  const setActiveFamilyId = useCallback((id: string) => {
    setActiveFamilyIdState(id);
  }, []);

  const createFamily = useCallback(async (name: string) => {
    if (!user) return { error: 'Not signed in' };
    if (!name.trim()) return { error: 'Family name is required' };

    if (isSupabaseConfigured && supabase) {
      // Insert family; trigger auto-adds creator as owner
      const shareCode = genShareCode();
      const { data, error } = await supabase
        .from('families')
        .insert({ name: name.trim(), share_code: shareCode })
        .select()
        .single();
      if (error) return { error: error.message };
      const fam = data as { id: string; name: string; share_code: string };
      // Insert membership (in case trigger didn't — belt and suspenders)
      await supabase.from('family_members').insert({
        user_id: user.id,
        family_id: fam.id,
        role: 'admin',
      });
      const newFamily: FamilyInfo = {
        id: fam.id,
        name: fam.name,
        shareCode: fam.share_code,
        role: 'admin',
        memberCount: 1,
      };
      setFamilies((prev) => [...prev, newFamily]);
      setActiveFamilyIdState(newFamily.id);
      return { family: newFamily };
    }
    // Demo mode
    const fams = loadDemoFamilies();
    const members = loadDemoMembers();
    const newFam: DemoFamily = {
      id: crypto.randomUUID(),
      name: name.trim(),
      shareCode: genShareCode(),
      createdAt: new Date().toISOString(),
    };
    fams.push(newFam);
    saveDemoFamilies(fams);
    members.push({ userId: user.id, familyId: newFam.id, role: 'admin' });
    saveDemoMembers(members);
    const info: FamilyInfo = {
      id: newFam.id,
      name: newFam.name,
      shareCode: newFam.shareCode,
      role: 'admin',
      memberCount: 1,
    };
    setFamilies((prev) => [...prev, info]);
    setActiveFamilyIdState(info.id);
    return { family: info };
  }, [user, supabase]);

  const joinFamily = useCallback(async (shareCode: string) => {
    if (!user) return { error: 'Not signed in' };
    const code = shareCode.trim().toUpperCase();
    if (!code) return { error: 'Share code is required' };

    if (isSupabaseConfigured && supabase) {
      // Find family by share_code
      const { data: fams, error: findErr } = await supabase
        .from('families')
        .select('id, name, share_code')
        .eq('share_code', code)
        .maybeSingle();
      if (findErr) return { error: findErr.message };
      if (!fams) return { error: 'No family found with that share code' };
      const fam = fams as { id: string; name: string; share_code: string };

      // Check if already a member
      const { data: existing } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', user.id)
        .eq('family_id', fam.id)
        .maybeSingle();
      if (!existing) {
        const { error: mErr } = await supabase.from('family_members').insert({
          user_id: user.id,
          family_id: fam.id,
          role: 'editor',
        });
        if (mErr) return { error: mErr.message };
      }
      const info: FamilyInfo = {
        id: fam.id,
        name: fam.name,
        shareCode: fam.share_code,
        role: 'editor',
        memberCount: 1,
      };
      await refreshFamiliesFor(user.id);
      setActiveFamilyIdState(info.id);
      return { family: info };
    }
    // Demo mode
    const fams = loadDemoFamilies();
    const members = loadDemoMembers();
    const fam = fams.find((f) => f.shareCode === code);
    if (!fam) return { error: 'No family found with that share code' };
    if (!members.some((m) => m.userId === user.id && m.familyId === fam.id)) {
      members.push({ userId: user.id, familyId: fam.id, role: 'editor' });
      saveDemoMembers(members);
    }
    await refreshFamiliesFor(user.id);
    setActiveFamilyIdState(fam.id);
    return {};
  }, [user, supabase, refreshFamiliesFor]);

  const activeFamily = useMemo(
    () => families.find((f) => f.id === activeFamilyId) ?? null,
    [families, activeFamilyId],
  );

  const value: AuthContextValue = {
    user,
    families,
    activeFamily,
    loading,
    isDemo: !isSupabaseConfigured,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithOtp,
    verifyOtp,
    signOut,
    setActiveFamilyId,
    createFamily,
    joinFamily,
    refreshFamilies,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
