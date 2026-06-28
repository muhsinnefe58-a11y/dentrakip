import { getBrowser, scrapeProfile } from '../../lib/scraper.js';
import { jobStore } from '../../lib/vercel-job-store.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
    return;
  }

  if (req.method === 'GET' && req.query.jobId) {
    const job = await jobStore.get(req.query.jobId);
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
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { account } = req.body;
  if (!account || typeof account !== 'string') {
    res.status(400).json({ error: 'Missing or invalid account' });
    return;
  }

  const job = await jobStore.create(account);

  const browserOptions = {
    browserlessToken: process.env.BROWSERLESS_TOKEN,
    cookies: req.body.cookies || null,
  };

  const { waitUntil } = await import('@vercel/functions');
  waitUntil(
    (async () => {
      await jobStore.update(job.id, { status: 'processing' });
      try {
        const startTime = Date.now();
        const browser = await getBrowser(browserOptions);
        const profile = await scrapeProfile(browser, account, browserOptions);
        const result = {
          account,
          profile,
          scrapedAt: new Date().toISOString(),
          elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
        };
        await jobStore.update(job.id, { status: 'completed', result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        await jobStore.update(job.id, { status: 'failed', error: msg });
      }
    })()
  );

  res.status(201).json({ jobId: job.id, status: job.status });
}
