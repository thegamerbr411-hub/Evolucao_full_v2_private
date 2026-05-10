import { getQaHealthSnapshot, setQaReadinessFlags } from '../qa/qaAutomationState';
import { getNetworkSnapshot } from './networkActivityManager';
import { getAsyncTaskSnapshot } from './asyncTaskRegistry';

function buildBusyReasons() {
  const health = getQaHealthSnapshot();
  const readiness = health?.runtime?.readiness || {};
  const stalls = health?.runtime?.stalls || {};
  const loading = health?.loading || {};
  const player = health?.player || {};
  const network = getNetworkSnapshot();
  const asyncSnapshot = getAsyncTaskSnapshot();

  const reasons = [];

  if (!readiness.authResolved) reasons.push('auth_not_resolved');
  if (!readiness.storesHydrated) reasons.push('stores_not_hydrated');
  if (!readiness.navigationReady) reasons.push('navigation_not_ready');
  if (Number(network.pendingRequests || 0) > 0) reasons.push('network_pending_requests');
  if (Number(asyncSnapshot.pendingAsyncTasks || 0) > 0) reasons.push('async_pending_tasks');
  if (Number(asyncSnapshot.activeTimers || 0) > 0) reasons.push('timers_active');
  if (Boolean(player.loading)) reasons.push('player_loading');
  if (Boolean(loading.active)) reasons.push(`loading_${String(loading.reason || 'active')}`);

  for (const [key, value] of Object.entries(stalls)) {
    if (value?.active) {
      reasons.push(`${key}_stall`);
    }
  }

  return reasons;
}

export function getRuntimeBusyReasons() {
  return buildBusyReasons();
}

export function assertRuntimeIdle() {
  const reasons = buildBusyReasons();
  if (reasons.length > 0) {
    throw new Error(`Runtime not idle: ${reasons.join(',')}`);
  }
  return { runtimeIdle: true, reasons: [] };
}

export async function waitForRuntimeIdle({ timeoutMs = 14000 } = {}) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const reasons = buildBusyReasons();
      if (reasons.length === 0) {
        clearInterval(interval);
        setQaReadinessFlags({ runtimeSynchronized: true });
        resolve({ runtimeIdle: true, reasons: [] });
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(interval);
        reject(new Error(`Runtime did not become idle in ${timeoutMs}ms: ${reasons.join(',')}`));
      }
    }, 250);
  });
}
