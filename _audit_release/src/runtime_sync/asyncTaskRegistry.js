import { setQaAsyncState } from '../qa/qaAutomationState';
import { logTaggedEvent } from '../utils/runtimeLogger';

const TASK_STALL_MS = 15000;
const LONG_TIMER_MS = 60000;
const ORPHAN_TIMER_MS = 180000;

const state = {
  tasks: new Map(),
  timers: new Map(),
  listenerCount: 0,
  orphanTasks: 0,
  backgroundTasks: 0,
  timerStats: {
    created: 0,
    cleared: 0,
    orphanTimers: 0,
    longRunningTimers: 0,
    retryLoops: 0,
  },
};

const listeners = new Set();

function emit() {
  const pendingAsyncTasks = Array.from(state.tasks.values()).filter((task) => !task.done).length;
  const timers = Array.from(state.timers.values());
  const activeTimers = timers.length;
  const longRunningTimers = timers.filter((timer) => Number(timer.ageMs || 0) >= LONG_TIMER_MS).length;
  const orphanTimers = timers.filter((timer) => Number(timer.ageMs || 0) >= ORPHAN_TIMER_MS).length;

  state.timerStats.longRunningTimers = longRunningTimers;
  state.timerStats.orphanTimers = orphanTimers;

  const snapshot = {
    pendingAsyncTasks,
    activeTimers,
    backgroundTasks: state.backgroundTasks,
    orphanTasks: state.orphanTasks,
    listenerCount: state.listenerCount,
    orphanTimers,
    longRunningTimers,
    retryLoops: Number(state.timerStats.retryLoops || 0),
    timerStats: {
      created: Number(state.timerStats.created || 0),
      cleared: Number(state.timerStats.cleared || 0),
      orphanTimers,
      longRunningTimers,
      retryLoops: Number(state.timerStats.retryLoops || 0),
    },
    runtimeIdle: pendingAsyncTasks <= 0 && activeTimers <= 0 && state.backgroundTasks <= 0,
    tasks: Array.from(state.tasks.values()).map((task) => ({
      id: task.id,
      label: task.label,
      type: task.type,
      ageMs: Date.now() - task.startedAtMs,
      done: task.done,
      stalled: task.stalled,
    })),
    timers: timers.map((timer) => ({
      id: timer.id,
      label: timer.label,
      kind: timer.kind,
      ageMs: timer.ageMs,
      createdAt: timer.createdAt,
      possibleRetryLoop: timer.possibleRetryLoop,
      possiblePollingLoop: timer.possiblePollingLoop,
    })),
  };

  setQaAsyncState(snapshot);
  global.__EVOLUCAO_QA_ASYNC__ = snapshot;

  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      // best effort
    }
  }
}

function nextTaskId(prefix = 'task') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function scheduleTaskStall(taskId) {
  return setTimeout(() => {
    const task = state.tasks.get(taskId);
    if (!task || task.done || task.stalled) {
      return;
    }

    task.stalled = true;
    state.orphanTasks += 1;
    logTaggedEvent('STORE', 'async_task_stall', {
      id: task.id,
      label: task.label,
      type: task.type,
      ageMs: Date.now() - task.startedAtMs,
    });
    emit();
  }, TASK_STALL_MS);
}

export function startAsyncTask(label, type = 'generic') {
  const id = nextTaskId('async');
  const entry = {
    id,
    label: String(label || 'task'),
    type: String(type || 'generic'),
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    done: false,
    stalled: false,
    stallTimer: null,
  };

  entry.stallTimer = scheduleTaskStall(id);
  state.tasks.set(id, entry);
  emit();
  return id;
}

export function endAsyncTask(taskId) {
  const task = state.tasks.get(taskId);
  if (!task) {
    emit();
    return;
  }

  task.done = true;
  if (task.stallTimer) {
    clearTimeout(task.stallTimer);
  }
  state.tasks.delete(taskId);
  emit();
}

export async function trackAsyncPromise(label, promiseFactory, type = 'promise') {
  const taskId = startAsyncTask(label, type);
  try {
    const result = await promiseFactory();
    endAsyncTask(taskId);
    return result;
  } catch (error) {
    endAsyncTask(taskId);
    throw error;
  }
}

export function registerTimer(label, timerId, kind = 'timeout') {
  if (!timerId) {
    return;
  }

  const safeLabel = String(label || 'timer');
  const lowerLabel = safeLabel.toLowerCase();
  const possibleRetryLoop = lowerLabel.includes('retry');
  const possiblePollingLoop = lowerLabel.includes('poll') || lowerLabel.includes('probe');

  if (possibleRetryLoop) {
    state.timerStats.retryLoops += 1;
  }

  state.timerStats.created += 1;

  state.timers.set(String(timerId), {
    id: String(timerId),
    label: safeLabel,
    kind,
    createdAt: new Date().toISOString(),
    createdAtMs: Date.now(),
    ageMs: 0,
    possibleRetryLoop,
    possiblePollingLoop,
  });
  emit();
}

export function unregisterTimer(timerId) {
  if (!timerId) {
    return;
  }

  const id = String(timerId);
  const existing = state.timers.get(id);
  if (existing) {
    state.timerStats.cleared += 1;
    if (existing.possibleRetryLoop) {
      state.timerStats.retryLoops = Math.max(0, Number(state.timerStats.retryLoops || 0) - 1);
    }
  }

  state.timers.delete(id);
  emit();
}

export function registerBackgroundTask(delta = 1) {
  state.backgroundTasks = Math.max(0, Number(state.backgroundTasks || 0) + Number(delta || 0));
  emit();
}

export function setListenerCount(count) {
  state.listenerCount = Math.max(0, Number(count || 0));
  emit();
}

export function getAsyncTaskSnapshot() {
  const pendingAsyncTasks = Array.from(state.tasks.values()).filter((task) => !task.done).length;
  const timers = Array.from(state.timers.values());
  const activeTimers = timers.length;
  const longRunningTimers = timers.filter((timer) => Number(timer.ageMs || 0) >= LONG_TIMER_MS).length;
  const orphanTimers = timers.filter((timer) => Number(timer.ageMs || 0) >= ORPHAN_TIMER_MS).length;

  return {
    pendingAsyncTasks,
    activeTimers,
    backgroundTasks: state.backgroundTasks,
    orphanTasks: state.orphanTasks,
    listenerCount: state.listenerCount,
    orphanTimers,
    longRunningTimers,
    retryLoops: Number(state.timerStats.retryLoops || 0),
    timerStats: {
      created: Number(state.timerStats.created || 0),
      cleared: Number(state.timerStats.cleared || 0),
      orphanTimers,
      longRunningTimers,
      retryLoops: Number(state.timerStats.retryLoops || 0),
    },
    runtimeIdle: pendingAsyncTasks <= 0 && activeTimers <= 0 && state.backgroundTasks <= 0,
  };
}

export function subscribeAsyncTaskSnapshot(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);
  listener(getAsyncTaskSnapshot());
  return () => listeners.delete(listener);
}

setInterval(() => {
  const now = Date.now();
  for (const timer of state.timers.values()) {
    timer.ageMs = Math.max(0, now - Number(timer.createdAtMs || now));
  }
  emit();
}, 1000);
