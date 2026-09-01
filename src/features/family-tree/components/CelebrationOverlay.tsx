'use client';

// Family Tree — Wedding celebration overlay
// Full-screen overlay shown on first load (date-gated until the wedding date).
// Auto-dismisses after 10 seconds or on click.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { TIMING, WEDDING } from '../constants';

interface Props {
  onClose: () => void;
}

export function CelebrationOverlay({ onClose }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500);
    }, TIMING.CELEBRATION_AUTO_DISMISS);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="ft-celebration-backdrop" onClick={onClose} />
      <div className="absolute inset-0 opacity-30 bg-cover bg-center" style={{ backgroundImage: 'url(/wedding-invite.jpg)', filter: 'blur(8px) saturate(1.2)', transform: 'scale(1.1)' }} />
      <div className="relative z-10 mx-4 flex max-w-md flex-col items-center text-center">
        <div className="mb-4 overflow-hidden rounded-2xl shadow-2xl ring-2 ring-white/30" style={{ maxWidth: 200 }}>
          <img src="/wedding-invite.jpg" alt="Wedding invitation" className="w-full h-auto" />
        </div>
        <div className="mb-3 text-4xl animate-bounce">💍</div>
        <h2 className="mb-1 text-2xl font-bold text-white sm:text-3xl">
          As we gather for
        </h2>
        <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
          <span className="bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent whitespace-nowrap">{WEDDING.COUPLE}</span> 💐
        </h2>
        <p className="mb-1 text-base text-emerald-100 sm:text-lg">{WEDDING.DATE_DISPLAY} · {WEDDING.VENUE}</p>
        <p className="mb-5 text-base text-emerald-100 sm:text-lg">let&apos;s map our roots and celebrate where we all come from. Add your branch to the family tree! 🌳</p>
        <button onClick={onClose} className="rounded-full bg-white px-8 py-3 text-base font-bold text-emerald-700 shadow-xl transition hover:scale-105 hover:bg-emerald-50">Let&apos;s begin 🌿</button>
        <p className="mt-4 text-xs text-emerald-300/60">(This message will disappear shortly)</p>
      </div>
      <button onClick={onClose} className="absolute right-4 top-4 z-20 rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition hover:bg-white/30" aria-label="Close"><X className="h-5 w-5" /></button>
    </div>
  );
}
