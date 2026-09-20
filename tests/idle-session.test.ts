import test from 'node:test';
import assert from 'node:assert/strict';
import { installIdleLogout, SESSION_IDLE_TIMEOUT_MS } from '../src/lib/idle-session';

class FakeTarget {
  listeners = new Map<string, Set<() => void>>();
  addEventListener(name: string, listener: () => void) {
    const current = this.listeners.get(name) ?? new Set<() => void>();
    current.add(listener);
    this.listeners.set(name, current);
  }
  removeEventListener(name: string, listener: () => void) {
    this.listeners.get(name)?.delete(listener);
  }
  emit(name: string) {
    for (const listener of this.listeners.get(name) ?? []) listener();
  }
}

function fakeScheduler() {
  let nextId = 0;
  const timers = new Map<number, () => void>();
  return {
    scheduler: {
      setTimeout(callback: () => void) {
        const id = ++nextId;
        timers.set(id, callback);
        return id;
      },
      clearTimeout(id: number) {
        timers.delete(id);
      },
    },
    runNext() {
      const entry = timers.entries().next();
      if (entry.done) return;
      const [id, callback] = entry.value as [number, () => void];
      timers.delete(id);
      callback();
    },
  };
}

test('idle session defaults to a 3-minute timeout', () => {
  assert.equal(SESSION_IDLE_TIMEOUT_MS, 3 * 60 * 1000);
});

test('user activity resets the idle timer and timeout logs the session out', () => {
  const target = new FakeTarget();
  const { scheduler, runNext } = fakeScheduler();
  let logoutCount = 0;
  const cleanup = installIdleLogout({ target, scheduler, timeoutMs: 1234, onTimeout: () => { logoutCount += 1; } });

  target.emit('mousemove');
  runNext();
  assert.equal(logoutCount, 1);
  cleanup();
});

test('cleanup prevents a pending timeout from logging out', () => {
  const target = new FakeTarget();
  const { scheduler, runNext } = fakeScheduler();
  let logoutCount = 0;
  const cleanup = installIdleLogout({ target, scheduler, timeoutMs: 1234, onTimeout: () => { logoutCount += 1; } });

  cleanup();
  assert.ok([...target.listeners.values()].every(listeners => listeners.size === 0));
  assert.doesNotThrow(runNext);
  assert.equal(logoutCount, 0);
});
