'use client';

import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { usePathname } from 'next/navigation';
import { useTimer } from '@/contexts/TimerContext';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  projectId?: string;
}

function IdleTimerBanner() {
  const {
    activeTimer,
    idleSecondsRemaining,
    autoStoppedMessage,
    clearAutoStoppedMessage,
    formatTime,
    elapsedTime,
  } = useTimer();

  return (
    <>
      {autoStoppedMessage && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-900 dark:text-amber-100">{autoStoppedMessage}</p>
          <button
            onClick={clearAutoStoppedMessage}
            className="p-1 text-amber-700 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {activeTimer && idleSecondsRemaining !== null && idleSecondsRemaining <= 60 && (
        <div className="bg-orange-50 dark:bg-orange-900/30 border-b border-orange-200 dark:border-orange-800 px-4 py-2">
          <p className="text-sm text-orange-900 dark:text-orange-100">
            Timer for <span className="font-medium">{activeTimer.task?.title || 'task'}</span> will
            auto-stop in {idleSecondsRemaining}s due to inactivity ({formatTime(elapsedTime)} tracked).
            Move your mouse or press a key to keep it running.
          </p>
        </div>
      )}
    </>
  );
}

export function Layout({ children, projectId }: LayoutProps) {
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);
  const showSidebar =
    !pathname?.includes('/login') &&
    !pathname?.includes('/register') &&
    !pathname?.includes('/admin/login') &&
    !pathname?.includes('/forgot-password') &&
    !pathname?.includes('/reset-password');

  useEffect(() => {
    setMobileNav(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNav) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNav(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileNav]);

  if (!showSidebar) {
    return <>{children}</>;
  }

  const extractedProjectId = projectId || pathname?.match(/\/projects\/([^\/]+)/)?.[1];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {mobileNav && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out ${
          mobileNav ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar projectId={extractedProjectId} onNavigate={() => setMobileNav(false)} />
      </div>
      <div className="flex-1 overflow-y-auto ui-scroll flex flex-col min-w-0">
        <AppHeader onMenuClick={() => setMobileNav(true)} />
        <IdleTimerBanner />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
