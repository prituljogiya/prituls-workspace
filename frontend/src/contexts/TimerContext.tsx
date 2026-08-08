'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

/** Auto-stop the timer after this much inactivity (must match backend). */
export const TIMER_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

export interface ActiveTimer {
  id: string;
  taskId: string;
  projectId?: string;
  startTime: string;
  lastActivityAt?: string | null;
  task?: {
    id: string;
    title: string;
    project?: { id: string; name: string };
  };
}

interface TimerContextType {
  activeTimer: ActiveTimer | null;
  elapsedTime: number;
  idleSecondsRemaining: number | null;
  autoStoppedMessage: string | null;
  clearAutoStoppedMessage: () => void;
  refreshActiveTimer: () => Promise<void>;
  startTimer: (taskId: string) => Promise<void>;
  stopTimer: (options?: { promptDescription?: boolean; autoStopped?: boolean }) => Promise<void>;
  formatTime: (seconds: number) => string;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [idleSecondsRemaining, setIdleSecondsRemaining] = useState<number | null>(null);
  const [autoStoppedMessage, setAutoStoppedMessage] = useState<string | null>(null);

  const activeTimerRef = useRef<ActiveTimer | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const stoppingRef = useRef(false);

  useEffect(() => {
    activeTimerRef.current = activeTimer;
  }, [activeTimer]);

  const clearAutoStoppedMessage = useCallback(() => setAutoStoppedMessage(null), []);

  const refreshActiveTimer = useCallback(async () => {
    if (!user) {
      setActiveTimer(null);
      setElapsedTime(0);
      return;
    }
    try {
      const response = await api.get('/time-tracking/timer/active');
      if (response.data.autoStopped) {
        setActiveTimer(null);
        setElapsedTime(0);
        setIdleSecondsRemaining(null);
        setAutoStoppedMessage('Timer stopped automatically because you were inactive.');
        return;
      }
      if (response.data.entry) {
        setActiveTimer(response.data.entry);
        lastActivityRef.current = Date.now();
        if (response.data.entry.startTime) {
          const start = new Date(response.data.entry.startTime).getTime();
          setElapsedTime(Math.floor((Date.now() - start) / 1000));
        }
      } else {
        setActiveTimer(null);
        setElapsedTime(0);
        setIdleSecondsRemaining(null);
      }
    } catch {
      setActiveTimer(null);
      setElapsedTime(0);
    }
  }, [user]);

  const stopTimer = useCallback(
    async (options?: { promptDescription?: boolean; autoStopped?: boolean }) => {
      const timer = activeTimerRef.current;
      if (!timer || stoppingRef.current) return;
      stoppingRef.current = true;
      try {
        let description = '';
        if (!options?.autoStopped && options?.promptDescription !== false) {
          description = prompt('Add a description (optional):') || '';
        }

        await api.post('/time-tracking/timer/stop', {
          entryId: timer.id,
          description,
          autoStopped: Boolean(options?.autoStopped),
        });

        setActiveTimer(null);
        setElapsedTime(0);
        setIdleSecondsRemaining(null);

        if (options?.autoStopped) {
          setAutoStoppedMessage('Timer stopped automatically because you were inactive.');
        }
      } catch (error: any) {
        if (!options?.autoStopped) {
          alert(error.response?.data?.error || 'Failed to stop timer');
        }
      } finally {
        stoppingRef.current = false;
      }
    },
    []
  );

  const startTimer = useCallback(
    async (taskId: string) => {
      try {
        const response = await api.post('/time-tracking/timer/start', { taskId });
        setActiveTimer(response.data.entry);
        setElapsedTime(0);
        lastActivityRef.current = Date.now();
        setIdleSecondsRemaining(Math.floor(TIMER_IDLE_TIMEOUT_MS / 1000));
        setAutoStoppedMessage(null);
      } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to start timer');
        throw error;
      }
    },
    []
  );

  // Load active timer when user is available
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setActiveTimer(null);
      setElapsedTime(0);
      return;
    }
    refreshActiveTimer();
  }, [user, authLoading, refreshActiveTimer]);

  // Elapsed clock
  useEffect(() => {
    if (!activeTimer?.startTime) return;
    const interval = setInterval(() => {
      const start = new Date(activeTimer.startTime).getTime();
      setElapsedTime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  // Idle detection + heartbeat while timer is running
  useEffect(() => {
    if (!activeTimer || !user) return;

    lastActivityRef.current = Date.now();

    let activityThrottleUntil = 0;
    const onActivity = () => {
      const now = Date.now();
      // Throttle mousemove floods; still resets idle clock promptly
      if (now < activityThrottleUntil) return;
      activityThrottleUntil = now + 500;
      lastActivityRef.current = now;
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, onActivity, { passive: true });
    });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastActivityRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const lastHeartbeatRef = { current: 0 };

    const tick = setInterval(async () => {
      const idleMs = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, Math.ceil((TIMER_IDLE_TIMEOUT_MS - idleMs) / 1000));
      setIdleSecondsRemaining(remaining);

      // Hidden tab also counts as inactivity from last known activity
      if (idleMs >= TIMER_IDLE_TIMEOUT_MS) {
        await stopTimer({ autoStopped: true, promptDescription: false });
        return;
      }

      // Heartbeat about once per minute while user has been active recently
      const now = Date.now();
      if (idleMs < 15_000 && now - lastHeartbeatRef.current >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatRef.current = now;
        try {
          const response = await api.post('/time-tracking/timer/heartbeat');
          if (response.data.autoStopped) {
            setActiveTimer(null);
            setElapsedTime(0);
            setIdleSecondsRemaining(null);
            setAutoStoppedMessage('Timer stopped automatically because you were inactive.');
          } else if (response.data.entry) {
            setActiveTimer(response.data.entry);
          }
        } catch {
          // ignore heartbeat failures; idle client stop still runs
        }
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, onActivity);
      });
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(tick);
    };
  }, [activeTimer, user, stopTimer]);

  const value: TimerContextType = {
    activeTimer,
    elapsedTime,
    idleSecondsRemaining,
    autoStoppedMessage,
    clearAutoStoppedMessage,
    refreshActiveTimer,
    startTimer,
    stopTimer,
    formatTime,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}
