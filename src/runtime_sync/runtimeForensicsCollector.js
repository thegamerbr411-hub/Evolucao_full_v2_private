import { getRuntimeResidueSnapshot } from './runtimeResidueAnalyzer';

const HEAP_SNAPSHOT_LIMIT = 240;
const EVENT_LIMIT = 600;

const state = {
  heapSnapshots: [],
  listenerEvents: [],
  timerEvents: [],
  residueEvents: [],
  generatedAt: new Date().toISOString(),
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pushLimited(target, value, limit) {
  const next = [...target, value];
  return next.slice(-limit);
}

function pickHeapFromHermes(runtimeProps = {}) {
  let bytes = 0;

  for (const [key, value] of Object.entries(runtimeProps || {})) {
    const safeKey = String(key || '').toLowerCase();
    if (!safeKey.includes('heap') && !safeKey.includes('memory') && !safeKey.includes('malloc')) {
      continue;
    }

    const parsed = toNumber(value, 0);
    if (parsed > bytes) {
      bytes = parsed;
    }
  }

  return bytes;
}

export function estimateHeapSnapshotMb() {
  try {
    const perfMemory = global?.performance?.memory;
    const webBytes = toNumber(perfMemory?.usedJSHeapSize, 0);
    if (webBytes > 0) {
      return Number((webBytes / (1024 * 1024)).toFixed(2));
    }
  } catch {
    // noop
  }

  try {
    const hermesProps = global?.HermesInternal?.getRuntimeProperties?.() || {};
    const hermesBytes = pickHeapFromHermes(hermesProps);
    if (hermesBytes > 0) {
      return Number((hermesBytes / (1024 * 1024)).toFixed(2));
    }
  } catch {
    // noop
  }

  return 0;
}

export function recordListenerEvent(category, action, meta = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    category: String(category || 'listener'),
    action: String(action || 'updated'),
    meta,
  };

  state.listenerEvents = pushLimited(state.listenerEvents, event, EVENT_LIMIT);
  global.__EVOLUCAO_RUNTIME_FORENSICS__ = getRuntimeForensicsSnapshot();
  return event;
}

export function recordTimerEvent(label, action, meta = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    label: String(label || 'timer'),
    action: String(action || 'updated'),
    meta,
  };

  state.timerEvents = pushLimited(state.timerEvents, event, EVENT_LIMIT);
  global.__EVOLUCAO_RUNTIME_FORENSICS__ = getRuntimeForensicsSnapshot();
  return event;
}

export function captureForensicsSnapshot(source = 'runtime_probe', payload = {}) {
  const heapMb = estimateHeapSnapshotMb();
  const snapshot = {
    timestamp: new Date().toISOString(),
    source: String(source || 'runtime_probe'),
    heapMb,
    payload,
  };

  if (heapMb > 0) {
    state.heapSnapshots = pushLimited(state.heapSnapshots, snapshot, HEAP_SNAPSHOT_LIMIT);
  }

  const residue = getRuntimeResidueSnapshot();
  if (residue && typeof residue === 'object') {
    state.residueEvents = pushLimited(state.residueEvents, {
      timestamp: snapshot.timestamp,
      source: snapshot.source,
      score: toNumber(residue.score, 0),
      suspects: Array.isArray(residue.suspects) ? residue.suspects : [],
      residues: residue.residues || {},
    }, EVENT_LIMIT);
  }

  global.__EVOLUCAO_RUNTIME_FORENSICS__ = getRuntimeForensicsSnapshot();
  return snapshot;
}

export function getRuntimeForensicsSnapshot() {
  return {
    generatedAt: state.generatedAt,
    heapSnapshots: state.heapSnapshots,
    listenerEvents: state.listenerEvents,
    timerEvents: state.timerEvents,
    residueEvents: state.residueEvents,
    latestHeapMb: state.heapSnapshots.length > 0 ? state.heapSnapshots[state.heapSnapshots.length - 1].heapMb : 0,
  };
}
