'use client';

// Family Tree — Birthplace Map view
// Shows all family members' birthplaces as pins on an OpenStreetMap.
// Geocoding via Nominatim (https://nominatim.openstreetmap.org) — free, no API key.
// Results are cached in localStorage so we don't re-hit Nominatim on every visit.
//
// Leaflet must be loaded client-side only (it touches `window` at import time),
// so the parent uses `next/dynamic` with `ssr: false` to mount this component.

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { Person } from '../types';
import { MapPin, X, Loader2 } from 'lucide-react';

// Fix the default Leaflet marker icon paths (Next.js/webpack mangles them).
// We use a CDN-hosted version of the standard OSM pin so we don't have to
// deal with `import markerIcon from 'leaflet/dist/images/marker-icon.png'`.
const DEFAULT_ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DEFAULT_ICON;

interface Geocoded {
  lat: number;
  lon: number;
  displayName: string;
}

const CACHE_KEY = 'familytree.geocode.cache.v1';

function readCache(): Record<string, Geocoded> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, Geocoded>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage might be full or unavailable — silently ignore.
  }
}

async function geocode(place: string): Promise<Geocoded | null> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
    encodeURIComponent(place);
  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim asks for a referer or user-agent; browsers send Referer automatically.
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!json || json.length === 0) return null;
    const hit = json[0];
    return {
      lat: Number(hit.lat),
      lon: Number(hit.lon),
      displayName: hit.display_name,
    };
  } catch {
    return null;
  }
}

interface Props {
  persons: Record<string, Person>;
  selectedId?: string | null;
  onSelectPerson?: (id: string) => void;
  onClose?: () => void;
}

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    // Leaflet computes tile layout from the container's size at mount time.
    // When the map mounts inside a freshly-toggled sidebar, the container may
    // still be 0×0 — calling invalidateSize() forces a recompute so tiles
    // actually render instead of leaving a grey box.
    map.invalidateSize();
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 6, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

// Re-call invalidateSize shortly after mount — handles the case where the
// sidebar's CSS transition hasn't fully completed when FitBounds runs.
function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export function MapPanel({ persons, selectedId, onSelectPerson, onClose }: Props) {
  // Geocode every distinct birthPlace string ONCE (cached in localStorage).
  const [geocoded, setGeocoded] = useState<Record<string, Geocoded>>({});
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const distinctPlaces = useMemo(() => {
    const set = new Set<string>();
    for (const p of Object.values(persons)) {
      if (p.birthPlace && p.birthPlace.trim()) set.add(p.birthPlace.trim());
    }
    return Array.from(set);
  }, [persons]);

  useEffect(() => {
    mountedRef.current = true;
    const cache = readCache();
    const missing = distinctPlaces.filter((p) => !cache[p]);

    if (missing.length === 0) {
      setGeocoded(cache);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      // Nominatim usage policy: max 1 request per second. We rate-limit to be polite.
      const updated = { ...cache };
      for (const place of missing) {
        if (cancelled || !mountedRef.current) return;
        const result = await geocode(place);
        if (result) updated[place] = result;
        // Spread state update so the user sees pins drop in progressively.
        setGeocoded({ ...updated });
        // Sleep 1.1s between requests to respect Nominatim's rate limit.
        await new Promise((r) => setTimeout(r, 1100));
      }
      writeCache(updated);
      if (mountedRef.current) setLoading(false);
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [distinctPlaces]);

  // Build a list of (person, geocoded) pairs — only those with a known location.
  const pins = useMemo(() => {
    const list: Array<{ person: Person; loc: Geocoded }> = [];
    for (const p of Object.values(persons)) {
      if (!p.birthPlace) continue;
      const loc = geocoded[p.birthPlace.trim()];
      if (loc) list.push({ person: p, loc });
    }
    return list;
  }, [persons, geocoded]);

  const points = pins.map((p) => [p.loc.lat, p.loc.lon] as [number, number]);

  // Default center: Kerala, India (roughly where the wedding is).
  const defaultCenter: [number, number] = [11.8744, 75.3704];
  const defaultZoom = 6;

  return (
    <div className="absolute right-3 top-3 z-50 flex max-h-[calc(100vh-1.5rem)] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl bg-white/95 shadow-2xl ring-1 ring-slate-200/80 backdrop-blur-xl">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <MapPin className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-semibold text-slate-700">Family Birthplaces</span>
        <span className="ml-auto text-[11px] text-slate-400">
          {pins.length} / {distinctPlaces.length} located
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
        {onClose && (
          <button
            onClick={onClose}
            className="ml-1 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="Close map"
            aria-label="Close map"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Map body — fills the panel below the header. ~60vh tall on desktop. */}
      <div className="relative h-[55vh] min-h-[280px] w-full">
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          scrollWheelZoom
          className="absolute inset-0 h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          <InvalidateSizeOnMount />
          {/* Selected pin highlight (fly to the selected person's marker).
              MUST live inside <MapContainer> because it calls useMap().
              Previously this was rendered outside MapContainer and crashed
              with 'No context provided: useLeafletContext()' on pin click. */}
          <SelectedFlyTo selectedId={selectedId} pins={pins} />
          {pins.map(({ person, loc }) => (
            <Marker
              key={person.id}
              position={[loc.lat, loc.lon]}
              eventHandlers={{
                click: () => onSelectPerson?.(person.id),
              }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <div className="text-sm font-semibold text-slate-800">
                    {person.firstName} {person.lastName ?? ''}
                  </div>
                  {person.birthYear != null && (
                    <div className="text-xs text-slate-500">
                      Born {person.birthYear}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-slate-600">{person.birthPlace}</div>
                  <div className="mt-1 text-[10px] text-slate-400">{loc.displayName}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Empty state — overlaid on the map area */}
        {!loading && pins.length === 0 && distinctPlaces.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 p-4">
            <div className="max-w-xs rounded-xl border border-slate-200 bg-white/95 p-5 text-center shadow-lg">
              <MapPin className="mx-auto h-7 w-7 text-slate-300" />
              <h3 className="mt-2 text-sm font-semibold text-slate-700">No birthplaces yet</h3>
              <p className="mt-1 text-xs text-slate-500">
                Add a birthplace to each person (e.g. &ldquo;Kannur&rdquo;,
                &ldquo;Kochi&rdquo;) and they&apos;ll show up as pins on this map.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer caption — explains what the map shows */}
      <div className="border-t border-slate-100 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        {pins.length > 0 ? (
          <span>
            Tap any pin to jump to that person in the tree. Locations are
            looked up via OpenStreetMap&apos;s Nominatim service and cached
            locally — the first lookup per place name may take a moment.
          </span>
        ) : loading ? (
          <span>Looking up birthplace coordinates…</span>
        ) : (
          <span>
            Tip: fill in the <strong>Birthplace</strong> field when adding or
            editing a person to see them on this map.
          </span>
        )}
      </div>
    </div>
  );
}

// Fly to the selected person's marker when selectedId changes.
// MUST be a child of <MapContainer> because it calls useMap().
function SelectedFlyTo({
  selectedId,
  pins,
}: {
  selectedId?: string | null;
  pins: Array<{ person: Person; loc: Geocoded }>;
}) {
  const map = useMap();
  const targetPin = selectedId
    ? pins.find((p) => p.person.id === selectedId)
    : undefined;
  useEffect(() => {
    if (!targetPin) return;
    map.flyTo([targetPin.loc.lat, targetPin.loc.lon], 8, { duration: 0.8 });
  }, [map, targetPin]);
  return null;
}
