'use client';

// Family Tree — Landing page map banner
// Shows on the sign-in screen as a teaser of the map feature. Asks the user
// for geolocation permission and, on grant, places a "You are here" pin on a
// small OpenStreetMap. The location is stashed in localStorage so that when the
// user later adds themselves as a person, the birthPlace can be auto-suggested.
//
// Leaflet is loaded client-side only via next/dynamic (ssr:false) — see usage
// in AuthPage.tsx. This file exports the actual map widget; the parent wraps it.

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, LocateFixed, Loader2, X } from 'lucide-react';

// "You are here" pin — a blue circle marker built from a divIcon.
const HERE_ICON = L.divIcon({
  className: '',
  html: `
    <div style="position: relative; width: 24px; height: 24px;">
      <span style="position:absolute; inset:0; border-radius:9999px; background:#3b82f6; opacity:0.3; animation: pulse 2s ease-out infinite;"></span>
      <span style="position:absolute; inset:6px; border-radius:9999px; background:#3b82f6; border:2px solid white; box-shadow:0 1px 4px rgba(0,0,0,0.3);"></span>
    </div>
    <style>
      @keyframes pulse { 0%{transform:scale(0.6);opacity:0.6} 100%{transform:scale(2.2);opacity:0} }
    </style>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const CACHE_KEY = 'familytree.landing.location.v1';

interface CachedLocation {
  lat: number;
  lon: number;
  label: string;
}

function readCached(): CachedLocation | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCached(loc: CachedLocation) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(loc));
  } catch {
    /* ignore */
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  // Reverse geocode via Nominatim to get a friendly place name (city / town).
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return '';
    const json = await res.json();
    const addr = json?.address ?? {};
    const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
    const state = addr.state || '';
    return [city, state].filter(Boolean).join(', ');
  } catch {
    return '';
  }
}

function FlyTo({ target }: { target: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(target, 10, { duration: 0.8 });
  }, [map, target]);
  return null;
}

export interface LandingMapBannerProps {
  /** Compact mode renders a smaller banner with the map pinned at right. */
  compact?: boolean;
}

export function LandingMapBanner({ compact = false }: LandingMapBannerProps) {
  const [status, setStatus] = useState<'idle' | 'asking' | 'granted' | 'denied' | 'unsupported'>(
    'idle',
  );
  const [location, setLocation] = useState<CachedLocation | null>(readCached());
  const [dismissed, setDismissed] = useState(false);

  const askForLocation = () => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setStatus('asking');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const label = await reverseGeocode(latitude, longitude);
        const loc: CachedLocation = { lat: latitude, lon: longitude, label };
        writeCached(loc);
        setLocation(loc);
        setStatus('granted');
      },
      (err) => {
        // err.code 1 = PERMISSION_DENIED
        setStatus('denied');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  if (dismissed) return null;

  // States:
  // - idle: show "Find me on the map" CTA (only if no cached location)
  // - asking: spinner
  // - granted (or cached): show a small map preview
  // - denied: small "no worries — you can add your birthplace later" message
  // - unsupported: hide silently

  if (status === 'unsupported') return null;

  const hasLocation = !!location;
  const showMap = hasLocation && (status === 'granted' || status === 'idle');

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur-md ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 z-10 rounded-full p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
        title="Dismiss"
        aria-label="Dismiss map banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <MapPin className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-700">Map your family&apos;s roots</div>
          <p className="text-xs text-slate-500">
            {hasLocation
              ? `You're near ${location!.label || 'your current location'}. When you add yourself to the tree, we'll pin you on the family map.`
              : 'See where everyone in your family was born, on an interactive OpenStreetMap. Share your location to get started (optional).'}
          </p>

          <div className="mt-2 flex items-center gap-2">
            {!hasLocation && status !== 'asking' && (
              <button
                type="button"
                onClick={askForLocation}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                Find me on the map
              </button>
            )}
            {status === 'asking' && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Locating…
              </span>
            )}
            {status === 'denied' && (
              <span className="text-xs text-slate-400">
                No worries — you can add your birthplace manually when you join a family.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Small map preview when we have a location */}
      {showMap && location && (
        <div className="mt-3 h-32 w-full overflow-hidden rounded-lg ring-1 ring-slate-200">
          <MapContainer
            center={[location.lat, location.lon]}
            zoom={9}
            scrollWheelZoom={false}
            zoomControl={false}
            attributionControl={false}
            className="h-full w-full"
            style={{ background: '#e5e7eb' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />
            <Marker position={[location.lat, location.lon]} icon={HERE_ICON}>
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold">You are here</div>
                  <div className="text-slate-500">{location.label || 'your location'}</div>
                </div>
              </Popup>
            </Marker>
            <FlyTo target={[location.lat, location.lon]} />
          </MapContainer>
        </div>
      )}
    </div>
  );
}
