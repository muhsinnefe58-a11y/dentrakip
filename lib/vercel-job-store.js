const TTL_MS = 60 * 60 * 1000;

const jobs = new Map();

function scheduleCleanup(id) {
  setTimeout(() => jobs.delete(id), TTL_MS);
}

export const jobStore = {
  async create(url) {
    const job = {
      id: crypto.randomUUID(),
      status: 'queued',
      url,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    jobs.set(job.id, job);
    scheduleCleanup(job.id);
    return job;
  },

  async get(id) {
    const job = jobs.get(id);
    if (job && Date.now() - job.createdAt > TTL_MS) {
      jobs.delete(id);
      return undefined;
    }
    return job;
  },

  async update(id, updates) {
    const job = jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, updates, { updatedAt: Date.now() });
    return job;
  },
};
