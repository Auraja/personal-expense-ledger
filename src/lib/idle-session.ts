export const SESSION_IDLE_TIMEOUT_MS = 3 * 60 * 1000;

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'mousemove', 'scroll', 'wheel'] as const;

type IdleTarget = {
  addEventListener: (event: string, listener: () => void) => void;
  removeEventListener: (event: string, listener: () => void) => void;
};

type IdleScheduler = {
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (timer: number) => void;
};

export function installIdleLogout({
  target,
  onTimeout,
  timeoutMs = SESSION_IDLE_TIMEOUT_MS,
  scheduler = {
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay) as unknown as number,
    clearTimeout: timer => globalThis.clearTimeout(timer as unknown as ReturnType<typeof globalThis.setTimeout>),
  },
}: {
  target: IdleTarget;
  onTimeout: () => void;
  timeoutMs?: number;
  scheduler?: IdleScheduler;
}): () => void {
  let timer: number | undefined;
  let stopped = false;

  const removeListeners = () => {
    for (const event of ACTIVITY_EVENTS) target.removeEventListener(event, reset);
  };
  const reset = () => {
    if (stopped) return;
    if (timer !== undefined) scheduler.clearTimeout(timer);
    timer = scheduler.setTimeout(() => {
      if (stopped) return;
      stopped = true;
      removeListeners();
      onTimeout();
    }, timeoutMs);
  };

  for (const event of ACTIVITY_EVENTS) target.addEventListener(event, reset);
  reset();

  return () => {
    if (stopped) return;
    stopped = true;
    if (timer !== undefined) scheduler.clearTimeout(timer);
    removeListeners();
  };
}
