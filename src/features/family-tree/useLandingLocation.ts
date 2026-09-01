'use client';

// Family Tree — Silent location collector
// When the user lands on the auth page, we silently request geolocation
// permission. The browser shows its native permission prompt (no app-level
// banner, no disclaimer). On grant, we reverse-geocode via Nominatim and
// cache the result in localStorage so it can be read later — e.g. to
// pre-fill the birthplace field when the user adds themselves as a person.
//
// Behaviour:
// - If a cached location already exists, do nothing (idempotent).
// - If the Permissions API reports 'denied' (user previously rejected), do
//   nothing — the user can add their birthplace manually later.
// - If the Permissions API reports 'granted', silently call getCurrentPosition
//   (no user gesture needed in this case).
// - If the Permissions API reports 'prompt' (or is unavailable), wait for the
//   first user gesture (pointerdown / typing) before calling getCurrentPosition.
//   This works around iOS Safari's requirement that geolocation requests be
//   triggered by a user gesture.
//
// No visible UI — this hook is purely a background collector.

import { useEffect, useRef } from 'react';
import { STORAGE_KEYS, TIMING, EXTERNAL } from './constants';

const CACHE_KEY = STORAGE_KEYS.LANDING_LOCATION;

export interface LandingLocation {
  lat: number;
  lon: number;
  label: string;
  collectedAt: string; // ISO timestamp
}

/** Read the cached landing location, if any. Used by PersonForm to pre-fill birthplace. */
export function readLandingLocation(): LandingLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as LandingLocation) : null;
  } catch {
    return null;
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `${EXTERNAL.NOMINATIM_REVERSE}?format=json&lat=${lat}&lon=${lon}&zoom=10`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return '';
    const json = await res.json();
    const addr = json?.address ?? {};
    const city =
      addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
    const state = addr.state || '';
    return [city, state].filter(Boolean).join(', ');
  } catch {
    return '';
  }
}

export function useLandingLocation() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    // SSR / unsupported browser guard.
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    // Idempotent: if we already have a cached location, don't re-collect.
    if (readLandingLocation()) return;

    let cancelled = false;
    let triggered = false;

    const onSuccess = async (pos: GeolocationPosition) => {
      if (cancelled) return;
      const { latitude, longitude } = pos.coords;
      const label = await reverseGeocode(latitude, longitude);
      if (cancelled) return;
      try {
        const loc: LandingLocation = {
          lat: latitude,
          lon: longitude,
          label,
          collectedAt: new Date().toISOString(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(loc));
      } catch {
        // localStorage full or unavailable — silently ignore.
      }
    };

    const onError = () => {
      // Permission denied, position unavailable, or timeout — silent.
      // The user can manually enter their birthplace when adding themselves
      // as a person later.
    };

    const trigger = () => {
      if (triggered || cancelled) return;
      triggered = true;
      cleanup();
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: false,
        timeout: TIMING.GEOLOCATION_TIMEOUT,
        maximumAge: TIMING.GEOLOCATION_MAX_AGE, // accept a recent cached position
      });
    };

    // Gesture listeners — used only if we need to wait for a user gesture.
    const handlePointerDown = () => trigger();
    const handleKeydown = (e: KeyboardEvent) => {
      // Only fire on actual typing, not modifier-only presses.
      if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Tab') trigger();
    };
    const cleanup = () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeydown);
    };

    (async () => {
      if (cancelled) return;
      let permState: PermissionState | null = null;
      try {
        if ('permissions' in navigator) {
          const perm = await navigator.permissions.query({
            name: 'geolocation' as PermissionName,
          });
          permState = perm.state;
        }
      } catch {
        // Permissions API unavailable — fall through to gesture-based approach.
      }

      if (cancelled) return;

      if (permState === 'denied') {
        // User previously denied — don't re-prompt. They can add their
        // birthplace manually later if they want.
        return;
      }

      if (permState === 'granted') {
        // Permission already granted — silently get position (no gesture needed).
        trigger();
        return;
      }

      // permState === 'prompt' or unknown — wait for first user gesture.
      // This avoids iOS Safari's "must be triggered by a user gesture" rule.
      document.addEventListener('pointerdown', handlePointerDown, { once: true });
      document.addEventListener('keydown', handleKeydown, { once: true });
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);
}
