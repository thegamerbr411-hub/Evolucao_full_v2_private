function isAttachedRun() {
  const checks = [
    process.env.DETOX_ATTACHED_CONFIGURATION,
    process.env.DETOX_CONFIGURATION,
    process.env.DETOX_DEVICE_NAME,
    process.env.DETOX_DEVICE_ID,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  if (String(process.env.DETOX_FORCE_ATTACHED || '') === '1') {
    return true;
  }

  if (String(process.env.DETOX_ADB_NAME || '').trim()) {
    return true;
  }

  try {
    if (typeof device !== 'undefined') {
      const deviceHints = [
        device?.name,
        device?.id,
        device?._deviceConfig?.type,
        device?._deviceConfig?.name,
        device?._deviceConfig?.device?.adbName,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      if (deviceHints.some((value) => value.includes('android.attached') || value.includes('attacheddevice:'))) {
        return true;
      }

      if (deviceHints.some((value) => value.includes('rq8t209ztaf'))) {
        return true;
      }
    }
  } catch {
    // melhor esforço
  }

  return checks.some((value) => value.includes('android.attached') || value.includes('attacheddevice:'));
}

function hasDetoxGlobals() {
  return typeof device !== 'undefined'
    && typeof element === 'function'
    && typeof by !== 'undefined'
    && typeof waitFor === 'function';
}

module.exports = {
  hasDetoxGlobals,
  isAttachedRun,
};
