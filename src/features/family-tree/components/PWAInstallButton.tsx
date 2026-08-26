'use client';

// Family Tree — PWA install button
// Listens for `beforeinstallprompt` and shows a button when installable.
// After install, hides itself.

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallButton({ collapsed = false }: { collapsed?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Defer to avoid synchronous-in-effect warning
    Promise.resolve().then(() => {
      // Already installed (standalone mode)?
      if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
        setInstalled(true);
        return;
      }
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };
      const installedHandler = () => {
        setInstalled(true);
        setDeferredPrompt(null);
      };
      window.addEventListener('beforeinstallprompt', handler);
      window.addEventListener('appinstalled', installedHandler);
      // Cleanup stored on a ref-like basis via closure
      (window as any).__pwaCleanup = () => {
        window.removeEventListener('beforeinstallprompt', handler);
        window.removeEventListener('appinstalled', installedHandler);
      };
    });
    return () => {
      (window as any).__pwaCleanup?.();
      (window as any).__pwaCleanup = undefined;
    };
  }, []);

  if (installed || !deferredPrompt) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleInstall}
      className="gap-1.5 rounded-lg border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      title="Install Family Tree as an app on your device"
    >
      {installed ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
      {!collapsed && <span className="hidden sm:inline">Install app</span>}
    </Button>
  );
}
