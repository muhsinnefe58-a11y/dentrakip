import { jobStore } from '../../lib/vercel-job-store.js';

export const config = {
  runtime: 'nodejs20.x',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
    return;
  }

  const { jobId } = req.query;
  const job = await jobStore.get(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const response = { jobId: job.id, status: job.status };

  if (job.status === 'completed' && job.result) {
    response.data = job.result;
  } else if (job.status === 'failed') {
    response.error = job.error;
  }

  res.json(response);
}
