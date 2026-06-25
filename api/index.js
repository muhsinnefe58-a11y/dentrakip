export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  const path = new URL(req.url, `http://${req.headers.host}`).pathname;

  if (path === '/health') {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  res.json({
    name: 'facebook-scraper-node',
    version: '1.0.0',
    description: 'Scrape Facebook public pages, groups, and post comments using Puppeteer and browserless.io',
    endpoints: {
      'POST /api/comments': 'Submit a comment scraping job',
      'GET /api/comments/:jobId': 'Poll job results',
      'GET /health': 'Health check',
    },
  });
}
