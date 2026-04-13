const { Queue, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    delay: 2000,
    type: 'exponential',
  },
  removeOnComplete: 200,
  removeOnFail: 500,
  timeout: 120000,
};

let singleton = null;

function parseRedisConnection() {
  const redisUrl = String(process.env.REDIS_URL || '').trim();
  if (!redisUrl) {
    return null;
  }

  return new IORedis(redisUrl, {
    enableReadyCheck: true,
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
}

function createDisabledQueueSystem() {
  return {
    enabled: false,
    enqueue: async () => ({ ok: false, reason: 'queue_disabled' }),
    getHealth: async () => ({
      enabled: false,
      queue: 'disabled',
      redis: 'disconnected',
      summary: {
        aiQueue: { active: 0, delayed: 0, failed: 0, waiting: 0 },
        bugQueue: { active: 0, delayed: 0, failed: 0, waiting: 0 },
        fixQueue: { active: 0, delayed: 0, failed: 0, waiting: 0 },
        retestQueue: { active: 0, delayed: 0, failed: 0, waiting: 0 },
      },
    }),
    queues: {},
  };
}

function createQueueSystem() {
  const connection = parseRedisConnection();
  if (!connection) {
    return createDisabledQueueSystem();
  }

  const queues = {
    aiQueue: new Queue('aiQueue', { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    bugQueue: new Queue('bugQueue', { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    fixQueue: new Queue('fixQueue', { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    retestQueue: new Queue('retestQueue', { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
  };

  const events = {
    aiQueue: new QueueEvents('aiQueue', { connection }),
    bugQueue: new QueueEvents('bugQueue', { connection }),
    fixQueue: new QueueEvents('fixQueue', { connection }),
    retestQueue: new QueueEvents('retestQueue', { connection }),
  };

  Object.entries(events).forEach(([queueName, queueEvents]) => {
    queueEvents.on('failed', (payload) => {
      console.error('[queue][failed]', JSON.stringify({
        failedReason: payload?.failedReason || '',
        jobId: payload?.jobId || '',
        name: queueName,
        prev: payload?.prev || '',
      }));
    });
  });

  async function enqueue(queueName, payload = {}, options = {}) {
    const queue = queues[queueName];
    if (!queue) {
      return { ok: false, reason: 'unknown_queue' };
    }

    const jobName = String(options.jobName || queueName);
    const dedupeKey = String(options.dedupeKey || payload?.fingerprint || '').trim();
    const jobId = dedupeKey ? `${jobName}:${dedupeKey}` : undefined;

    const job = await queue.add(jobName, payload, {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
      jobId,
    });

    return {
      id: job.id,
      jobName,
      ok: true,
      queueName,
    };
  }

  async function getHealth() {
    let redis = 'disconnected';

    try {
      const pong = await connection.ping();
      redis = String(pong || '').toUpperCase() === 'PONG' ? 'connected' : 'disconnected';
    } catch {
      redis = 'disconnected';
    }

    const summary = {};
    for (const [name, queue] of Object.entries(queues)) {
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
        summary[name] = {
          active: Number(counts.active || 0),
          delayed: Number(counts.delayed || 0),
          failed: Number(counts.failed || 0),
          waiting: Number(counts.waiting || 0),
        };
      } catch {
        summary[name] = { active: 0, delayed: 0, failed: 0, waiting: 0 };
      }
    }

    return {
      enabled: true,
      queue: 'running',
      redis,
      summary,
    };
  }

  return {
    connection,
    enabled: true,
    enqueue,
    events,
    getHealth,
    queues,
  };
}

function getQueueSystem() {
  if (!singleton) {
    singleton = createQueueSystem();
  }
  return singleton;
}

module.exports = {
  DEFAULT_JOB_OPTIONS,
  getQueueSystem,
};
