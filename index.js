import { getBrowser, scrapePosts, scrapeProfile, scrapeGroupInfo, scrapePostComments } from './lib/scraper.js';

/**
 * Scrapes posts from a Facebook page or group.
 * @param {string} account - The Facebook account username/ID or group ID.
 * @param {object} [options={}] - Scraping options.
 * @param {number} [options.pages=1] - Number of pages to scrape.
 * @param {boolean} [options.isGroup=false] - True if scraping a group.
 * @param {Array|string} [options.cookies] - Cookies for authentication.
 * @param {string} [options.browserlessToken] - browserless.io token.
 * @param {string} [options.browserWSEndpoint] - Puppeteer browser WebSocket endpoint.
 * @param {import('puppeteer-core').Browser} [options.browser] - Custom Puppeteer browser instance.
 * @param {string} [options.userAgent] - Custom User-Agent header.
 * @param {number} [options.delay=1000] - Delay between pages in milliseconds.
 * @returns {Promise<Array<object>>} List of posts.
 */
export async function getPosts(account, options = {}) {
  const shouldClose = !options.browser;
  const browser = await getBrowser(options);
  try {
    return await scrapePosts(browser, account, options);
  } finally {
    if (shouldClose && browser) {
      await browser.close();
    }
  }
}

/**
 * Scrapes a profile's About information.
 * @param {string} account - The Facebook account username or ID.
 * @param {object} [options={}] - Scraping options.
 * @param {Array|string} [options.cookies] - Cookies for authentication.
 * @param {string} [options.browserlessToken] - browserless.io token.
 * @param {string} [options.browserWSEndpoint] - Puppeteer browser WebSocket endpoint.
 * @param {import('puppeteer-core').Browser} [options.browser] - Custom Puppeteer browser instance.
 * @param {string} [options.userAgent] - Custom User-Agent header.
 * @returns {Promise<object>} Profile details.
 */
export async function getProfile(account, options = {}) {
  const shouldClose = !options.browser;
  const browser = await getBrowser(options);
  try {
    return await scrapeProfile(browser, account, options);
  } finally {
    if (shouldClose && browser) {
      await browser.close();
    }
  }
}

/**
 * Scrapes group metadata.
 * @param {string} group - The Facebook group username or ID.
 * @param {object} [options={}] - Scraping options.
 * @param {Array|string} [options.cookies] - Cookies for authentication.
 * @param {string} [options.browserlessToken] - browserless.io token.
 * @param {string} [options.browserWSEndpoint] - Puppeteer browser WebSocket endpoint.
 * @param {import('puppeteer-core').Browser} [options.browser] - Custom Puppeteer browser instance.
 * @param {string} [options.userAgent] - Custom User-Agent header.
 * @returns {Promise<object>} Group details.
 */
export async function getGroupInfo(group, options = {}) {
  const shouldClose = !options.browser;
  const browser = await getBrowser(options);
  try {
    return await scrapeGroupInfo(browser, group, options);
  } finally {
    if (shouldClose && browser) {
      await browser.close();
    }
  }
}

/**
 * Scrapes comments from a single Facebook post.
 * @param {string} postUrl - Full URL to the Facebook post.
 * @param {object} [options={}] - Scraping options.
 * @param {Array|string} [options.cookies] - Cookies for authentication.
 * @param {string} [options.browserlessToken] - browserless.io token.
 * @param {string} [options.browserWSEndpoint] - Puppeteer browser WebSocket endpoint.
 * @param {import('puppeteer-core').Browser} [options.browser] - Custom Puppeteer browser instance.
 * @param {string} [options.userAgent] - Custom User-Agent header.
 * @param {boolean} [options.debug=false] - Save debug HTML.
 * @param {number} [options.maxComments=0] - Max comments to extract (0 = unlimited).
 * @returns {Promise<Array<object>>} List of comments.
 */
export async function getPostComments(postUrl, options = {}) {
  const shouldClose = !options.browser;
  const browser = await getBrowser(options);
  try {
    return await scrapePostComments(browser, postUrl, options);
  } finally {
    if (shouldClose && browser) {
      await browser.close();
    }
  }
}
