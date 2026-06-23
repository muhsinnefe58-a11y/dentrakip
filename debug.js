/**
 * debug.js — Facebook'un www sürümünde ne gönderdiğini görmek için
 * Çalıştır: node debug.js
 */
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const TOKEN = process.env.BROWSERLESS_TOKEN || '2UjPvCmUGz0PWSW60b88ffdfb4af0bc5105bbe77c0d911fb9';
const ACCOUNT = 'bursadisklinigi';

const browser = await puppeteer.connect({
  browserWSEndpoint: `wss://chrome.browserless.io?token=${TOKEN}`,
});

const page = await browser.newPage();

await page.setUserAgent(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
);
await page.setExtraHTTPHeaders({ 'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8' });
await page.setViewport({ width: 1280, height: 800 });

const url = `https://www.facebook.com/${ACCOUNT}`;
console.log('Fetching:', url);

await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

await page.waitForSelector('div[role="article"]', { timeout: 20000 }).catch(() => {});
await new Promise(r => setTimeout(r, 2000));

const title = await page.title();
console.log('Page title:', title);

const diagnostics = await page.evaluate(() => {
  const info = {};

  info.article_count = document.querySelectorAll('div[role="article"]').length;

  info.articles = Array.from(document.querySelectorAll('div[role="article"]')).slice(0, 5).map(el => ({
    class: el.className,
    id: el.id,
    html_snippet: el.innerHTML.slice(0, 600),
    text_preview: el.textContent.trim().slice(0, 300),
  }));

  info.body_children = Array.from(document.body.children).map(el => ({
    tag: el.tagName,
    id: el.id,
    class: el.className,
  })).slice(0, 20);

  info.possible_next_links = Array.from(document.querySelectorAll('a')).filter(a => {
    const href = a.getAttribute('href') || '';
    const text = a.textContent.toLowerCase().trim();
    return (
      href.includes('/posts/') ||
      text.includes('see more') ||
      text === 'daha fazla göster' ||
      text.includes('daha eski') ||
      text.includes('more stories')
    );
  }).map(a => ({
    text: a.textContent.trim(),
    href: a.getAttribute('href'),
  })).slice(0, 10);

  info.body_preview = document.body.innerHTML.slice(0, 3000);

  return info;
});

console.log('\n=== DIAGNOSTICS ===');
console.log('article count:', diagnostics.article_count);
console.log('\nbody children:', JSON.stringify(diagnostics.body_children, null, 2));
console.log('\npossible next links:', JSON.stringify(diagnostics.possible_next_links, null, 2));

if (diagnostics.articles.length > 0) {
  console.log('\nfirst articles:', JSON.stringify(diagnostics.articles, null, 2));
}

const html = await page.content();
fs.writeFileSync('debug_output.html', html, 'utf-8');
console.log('\nFull HTML saved to debug_output.html');

await browser.close();
