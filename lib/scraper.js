import { readFileSync } from 'fs';
import puppeteer from 'puppeteer-core';

export function parseAbbreviatedNumber(str) {
  if (!str) return 0;
  const clean = str.replace(/,/g, '').trim().toUpperCase();
  const match = clean.match(/^([\d.]+)\s*([KMB]?)/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const modifier = match[2];
  if (modifier === 'K') return Math.round(num * 1000);
  if (modifier === 'M') return Math.round(num * 1000000);
  if (modifier === 'B') return Math.round(num * 1000000000);
  return Math.round(num);
}

export async function getBrowser(options = {}) {
  if (options.browser) return options.browser;

  const token = options.browserlessToken || process.env.BROWSERLESS_TOKEN;
  const wsEndpoint = options.browserWSEndpoint || (token ? `wss://chrome.browserless.io?token=${token}` : null);

  if (wsEndpoint) {
    return await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
  }

  throw new Error(
    'No Puppeteer browser or browserless token/endpoint provided.'
  );
}

/**
 * Parses cookies from various formats into a Puppeteer cookie array.
 * Supported inputs:
 * - `string` : `"name=value; name2=value2"` format
 * - `Array`  : Puppeteer cookie array `[{ name, value, domain }, ...]`
 * - `file`   : Path to a `.txt` (Netscape) or `.json` (array) cookie file
 *
 * @param {Array|string|object} [cookiesOrFile] - Cookies array, string, or `{ file: '...' }`.
 * @returns {Promise<Array<{name:string, value:string, domain:string}>>}
 */
export async function parseCookies(cookiesOrFile) {
  if (!cookiesOrFile) return [];
  if (Array.isArray(cookiesOrFile)) return cookiesOrFile;

  // Object with { file: '...' } format
  if (typeof cookiesOrFile === 'object' && cookiesOrFile.file) {
    const filePath = cookiesOrFile.file;
    const ext = filePath.split('.').pop().toLowerCase();
    const raw = readFileSync(filePath, 'utf-8');

    if (ext === 'json') {
      return JSON.parse(raw);
    }

    // Netscape cookie file format (tab-separated)
    const lines = raw.split('\n');
    const cookies = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('HttpOnly,')) continue;
      const parts = trimmed.split('\t');
      // Netscape: domain, flag, path, secure, expiry, name, value
      if (parts.length >= 7) {
        cookies.push({
          name: parts[5].trim(),
          value: parts[6].trim(),
          domain: parts[0].trim(),
        });
      } else {
        // Fallback: name=value pairs separated by ;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          cookies.push({
            name: trimmed.slice(0, eqIdx).trim(),
            value: trimmed.slice(eqIdx + 1).trim(),
            domain: '.facebook.com',
          });
        }
      }
    }
    return cookies;
  }

  // String format: "name=value; name2=value2"
  if (typeof cookiesOrFile === 'string') {
    return cookiesOrFile.split(';').map(c => {
      const eqIdx = c.indexOf('=');
      if (eqIdx === -1) return null;
      return {
        name: c.slice(0, eqIdx).trim(),
        value: c.slice(eqIdx + 1).trim(),
        domain: '.facebook.com',
      };
    }).filter(Boolean);
  }

  return [];
}

export async function scrapePosts(browser, account, options = {}) {
  const {
    pages = 1,
    isGroup = false,
    cookies = null,
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    delay = 2000,
    debug = false,
  } = options;

  const page = await browser.newPage();
  try {
    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    });
    await page.setViewport({ width: 1280, height: 800 });

    if (cookies) {
      const cookieList = await parseCookies(cookies);
      if (cookieList.length > 0) await page.setCookie(...cookieList);
    }

    let baseUrl = isGroup
      ? `https://www.facebook.com/groups/${account}`
      : `https://www.facebook.com/${account}`;

    let currentUrl = baseUrl;
    const allPosts = [];

    for (let p = 0; p < pages; p++) {
      console.log(`Scraping page ${p + 1} of ${pages}: ${currentUrl}`);

      const response = await page.goto(currentUrl, { waitUntil: 'networkidle0', timeout: 60000 });

      await page.waitForSelector('div[role="article"]', { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));

      const title = await page.title();
      console.log(`  Page title: "${title}"`);

      const finalUrl = page.url();
      const isLoginWall =
        title.toLowerCase().includes('log in') ||
        title.toLowerCase().includes('login') ||
        title.toLowerCase().includes('sign up') ||
        title.toLowerCase().includes('giriş') ||
        finalUrl.includes('/login') ||
        finalUrl.includes('login_via') ||
        finalUrl.includes('checkpoint');

      if (isLoginWall) {
        const msg =
          'Facebook oturum açma sayfasına yönlendirildi.\n' +
          'Bu sayfayı kazımak için geçerli Facebook çerezleri (cookies) gereklidir.\n' +
          `(Yönlendirilen URL: ${finalUrl})`;
        if (allPosts.length > 0) {
          console.warn('Login duvarına çarptı. Şimdiye kadar toplananlar döndürülüyor.');
          break;
        }
        throw new Error(msg);
      }

      if (response && response.status() === 404) {
        throw new Error(`Facebook sayfası/grubu "${account}" bulunamadı (404).`);
      }

      if (debug) {
        const { writeFileSync } = await import('fs');
        const html = await page.content();
        const fname = `debug_page_${p + 1}.html`;
        writeFileSync(fname, html, 'utf-8');
        console.log(`  [debug] HTML kaydedildi → ${fname}`);
      }

      const postsOnPage = await page.evaluate(() => {
        const posts = [];
        const articles = document.querySelectorAll('div[role="article"]');

        articles.forEach(article => {
          const role = article.getAttribute('role');
          if (role === 'status' || role === 'progressbar') return;

          const html = article.innerHTML.toLowerCase();

          if (
            html.includes('suggested for you') ||
            html.includes('sponsored') ||
            html.includes('reklam') ||
            html.includes('önerilen') ||
            html.includes('yükleniyor')
          ) return;

          let text = '';
          const textBlocks = article.querySelectorAll(
            'div[data-ad-rendering-role="story_message"] span, ' +
            'div[data-ad-preview="message"] span'
          );
          if (textBlocks.length > 0) {
            text = Array.from(textBlocks).map(s => s.textContent).join('\n').trim();
          } else {
            const allSpans = article.querySelectorAll('span');
            const meaningful = Array.from(allSpans).filter(s => {
              const t = s.textContent.trim();
              return t.length > 20 && !s.closest('a[role="link"]');
            });
            if (meaningful.length > 0) {
              text = meaningful.map(s => s.textContent.trim()).filter(Boolean).join('\n');
            } else {
              const clone = article.cloneNode(true);
              const headerLinks = clone.querySelectorAll('[role="link"]');
              headerLinks.forEach(el => {
                const txt = el.textContent.trim();
                if (txt.length < 60) el.remove();
              });
              text = clone.textContent.trim();
            }
          }

          const actorLink = article.querySelector(
            'a[role="link"][tabindex="0"]:not([href*="/photo"]):not([href*="/comment"])'
          );
          const username = actorLink ? actorLink.textContent.trim() : null;
          let userUrl = actorLink ? actorLink.getAttribute('href') : null;
          if (userUrl && userUrl.startsWith('/')) {
            userUrl = 'https://www.facebook.com' + userUrl;
          }

          const timeAnchor = article.querySelector('a[role="link"] span[style*="white-space"]');
          const timeText = timeAnchor ? timeAnchor.textContent.trim() : null;

          const links = [];
          const anchors = article.querySelectorAll('a:not([role="link"])');
          anchors.forEach(a => {
            const href = a.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('/')) {
              links.push({ text: a.textContent.trim(), href });
            }
          });

          const images = [];
          const imgs = article.querySelectorAll('img');
          imgs.forEach(img => {
            const src = img.getAttribute('src');
            const w = img.getAttribute('width');
            if (
              src &&
              !src.includes('static.xx.fbcdn.net') &&
              !src.includes('emoji.php') &&
              (!w || parseInt(w) > 32)
            ) {
              images.push(src);
            }
          });

          let postUrl = null;
          const storyLink = article.querySelector(
            'a[href*="/posts/"], a[href*="story_fbid="], a[href*="/permalink/"], a[href*="/story.php"]'
          );
          if (storyLink) {
            const href = storyLink.getAttribute('href');
            if (href) {
              postUrl = href.startsWith('http') ? href : 'https://www.facebook.com' + href;
            }
          }

          const textContent = article.textContent || '';

          posts.push({
            username,
            user_url: userUrl,
            text: text.trim(),
            time: timeText,
            links,
            images,
            post_url: postUrl,
            raw_text: textContent,
          });
        });

        return posts;
      });

      const parsedPosts = postsOnPage.map(post => {
        const text = post.raw_text;
        delete post.raw_text;

        const likesMatch = text.match(/([\d,.KM]+)\s*(Like|reaction|Beğen|beğenme)/i);
        const commentsMatch = text.match(/([\d,.KM]+)\s*(Comment|Yorum|yorum)/i);
        const sharesMatch = text.match(/([\d,.KM]+)\s*(Share|Paylaş|paylaşım)/i);

        return {
          ...post,
          likes: likesMatch ? parseAbbreviatedNumber(likesMatch[1]) : 0,
          comments: commentsMatch ? parseAbbreviatedNumber(commentsMatch[1]) : 0,
          shares: sharesMatch ? parseAbbreviatedNumber(sharesMatch[1]) : 0,
        };
      });

      allPosts.push(...parsedPosts);

      if (p < pages - 1) {
        const scrolled = await page.evaluate(async () => {
          const before = document.body.scrollHeight;
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(r => setTimeout(r, 2000));
          const after = document.body.scrollHeight;
          return after > before;
        });

        if (!scrolled) {
          const nextLinkHref = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const next = links.find(a => {
              const href = a.getAttribute('href') || '';
              const text = a.textContent.toLowerCase();
              const txtTrim = text.trim();
              return (
                href.includes('/posts/') ||
                text.includes('see more') ||
                txtTrim === 'daha fazla göster' ||
                text.includes('daha eski') ||
                text.includes('more stories')
              );
            });
            return next && next.href ? next.href : null;
          });

          if (nextLinkHref) {
            currentUrl = nextLinkHref;
          } else {
            console.log('No more pages found.');
            break;
          }
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return allPosts;
  } finally {
    await page.close();
  }
}

/**
 * Scrapes a profile's About information.
 * @param {import('puppeteer-core').Browser} browser 
 * @param {string} account 
 * @param {object} options 
 * @returns {Promise<object>}
 */
export async function scrapeProfile(browser, account, options = {}) {
  const {
    cookies = null,
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  } = options;

  const page = await browser.newPage();
  try {
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    if (cookies) {
      const cookieList = await parseCookies(cookies);
      if (cookieList.length > 0) await page.setCookie(...cookieList);
    }

    const cleanAccount = account.replace('profile.php?id=', '');
    const aboutUrl = `https://www.facebook.com/${cleanAccount}/about`;
    console.log(`Scraping profile: ${aboutUrl}`);

    const response = await page.goto(aboutUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    const title = await page.title();
    if (title.toLowerCase().includes('login') || title.toLowerCase().includes('giriş') || title.toLowerCase().includes('log into facebook')) {
      throw new Error('Redirected to login page. Please provide valid cookies to scrape profile.');
    }

    if (response && response.status() === 404) {
      throw new Error(`Facebook profile "${account}" not found (404).`);
    }

    const profileData = await page.evaluate(() => {
      const data = {};
      const titleElem = document.querySelector('title');
      data.name = titleElem ? titleElem.textContent.split(' | ')[0].trim() : '';

      const sections = document.querySelectorAll('div[data-sigil="profile-card"]');
      sections.forEach(card => {
        const headerElem = card.querySelector('header');
        if (headerElem) {
          const header = headerElem.textContent.trim();
          const clone = card.cloneNode(true);
          const headerClone = clone.querySelector('header');
          if (headerClone) headerClone.remove();
          const content = clone.textContent ? clone.textContent.trim() : '';
          data[header] = content.split('\n').map(l => l.trim()).filter(l => l).join('\n');
        }
      });

      return data;
    });

    const pageHtml = await page.content();
    const entityMatch = pageHtml.match(/entity_id:(\d+)/) || pageHtml.match(/"id":"(\d+)"/);
    if (entityMatch) {
      profileData.id = entityMatch[1];
    }

    profileData.username = cleanAccount;
    return profileData;
  } finally {
    await page.close();
  }
}

/**
 * Scrapes group metadata.
 * @param {import('puppeteer-core').Browser} browser 
 * @param {string} group 
 * @param {object} options 
 * @returns {Promise<object>}
 */
export async function scrapeGroupInfo(browser, group, options = {}) {
  const {
    cookies = null,
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  } = options;

  const page = await browser.newPage();
  try {
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    if (cookies) {
      const cookieList = await parseCookies(cookies);
      if (cookieList.length > 0) await page.setCookie(...cookieList);
    }

    const infoUrl = `https://www.facebook.com/groups/${group}/about`;
    console.log(`Scraping group info: ${infoUrl}`);

    const response = await page.goto(infoUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    const title = await page.title();
    if (title.toLowerCase().includes('login') || title.toLowerCase().includes('giriş') || title.toLowerCase().includes('log into facebook')) {
      throw new Error('Redirected to login page. Please provide valid cookies to scrape group info.');
    }

    if (response && response.status() === 404) {
      throw new Error(`Facebook group "${group}" not found (404).`);
    }

    const groupData = await page.evaluate(() => {
      const data = {};

      const nameElem = document.querySelector('header h3') || document.querySelector('title');
      data.name = nameElem ? nameElem.textContent.trim() : '';

      const typeElem = document.querySelector('header div');
      data.type = typeElem ? typeElem.textContent.trim() : '';

      const membersElem = document.querySelector('div[data-testid="m_group_sections_members"]');
      if (membersElem) {
        data.members_text = membersElem.textContent.trim();
      }

      const aboutDiv = document.querySelector('._52jc._55wr');
      if (aboutDiv) {
        data.about = aboutDiv.textContent.trim();
      }

      return data;
    });

    if (groupData.members_text) {
      const match = groupData.members_text.match(/([\d,.KM]+)/);
      if (match) {
        groupData.members = parseAbbreviatedNumber(match[1]);
      }
    }

    groupData.id = group;
    return groupData;
  } finally {
    await page.close();
  }
}

/**
 * Aggressively scrolls the page and clicks "view more" buttons to load all comments.
 * Uses the proven approach from facebook-comment-scraper.
 */
async function loadAllComments(page) {
  const script = `
    (async () => {
      const KONTROL_PERIYODU = 700;
      const MAX_TIMEOUT = 7000;
      const MAX_DONGU = 50;
      const uyku = (ms) => new Promise(r => setTimeout(r, ms));

      function gaddarScroll() {
        window.scrollTo(0, document.body.scrollHeight);
        if (document.documentElement) {
          document.documentElement.scrollTop = document.documentElement.scrollHeight;
        }
        const tumDivler = document.querySelectorAll('div');
        tumDivler.forEach(div => {
          try {
            if (div.scrollHeight > div.clientHeight) {
              const style = window.getComputedStyle(div);
              if (style.overflowY === 'auto' || style.overflowY === 'scroll' || div.getAttribute('role') === 'dialog') {
                div.scrollTop = div.scrollHeight;
              }
            }
          } catch (e) {}
        });
        const tumYorumlar = document.querySelectorAll('div[role="article"]');
        if (tumYorumlar.length > 0) {
          tumYorumlar[tumYorumlar.length - 1].scrollIntoView({ block: "end", behavior: "auto" });
        }
      }

      function butonlariTikla() {
        try {
          const butonlar = document.querySelectorAll('div[role="button"], span[role="button"]');
          let tiklamaYapildi = false;
          butonlar.forEach(btn => {
            const metin = btn.innerText ? btn.innerText.toLowerCase() : "";
            if (
              metin.includes("diğer yorumları gör") ||
              metin.includes("daha fazla yorum") ||
              metin.includes("yanıtı gör") ||
              metin.includes("yanıtları gör") ||
              metin.includes("view more comments") ||
              metin.includes("view replies")
            ) {
              btn.click();
              tiklamaYapildi = true;
            }
          });
          return tiklamaYapildi;
        } catch (e) {
          return false;
        }
      }

      for (let i = 1; i <= MAX_DONGU; i++) {
        try {
          const eskiYorumSayisi = document.querySelectorAll('div[role="article"]').length;
          gaddarScroll();
          const butonTiklandi = butonlariTikla();
          let gecenSure = 0;
          let yeniVeriGeldiMi = false;

          while (gecenSure < MAX_TIMEOUT) {
            await uyku(KONTROL_PERIYODU);
            gecenSure += KONTROL_PERIYODU;
            const guncelYorumSayisi = document.querySelectorAll('div[role="article"]').length;
            if (guncelYorumSayisi > eskiYorumSayisi) {
              yeniVeriGeldiMi = true;
              break;
            }
          }

          if (!yeniVeriGeldiMi && !butonTiklandi) break;
        } catch (e) {
          await uyku(1000);
        }
      }
    })()
  `;
  await page.evaluate(script);
}

/**
 * Parses an abbreviated Facebook number string (e.g., "2.1K", "1.5M") to an integer.
 */
function parseShortNumber(str) {
  if (!str) return 0;
  const m = str.replace(/,/g, '').trim().match(/^([\d.]+)\s*([KMBkmb]?)/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mod = m[2].toUpperCase();
  if (mod === 'K') return Math.round(n * 1000);
  if (mod === 'M') return Math.round(n * 1_000_000);
  if (mod === 'B') return Math.round(n * 1_000_000_000);
  return Math.round(n);
}

/**
 * Extracts comments from the current page DOM.
 * Returns array of comment objects.
 */
const EXTRACT_SCRIPT = `
  (() => {
    const parseShortNumber = (str) => {
      if (!str) return 0;
      const m = str.replace(/,/g, '').trim().match(/^([\\d.]+)\\s*([KMBkmb]?)/);
      if (!m) return 0;
      const n = parseFloat(m[1]);
      const mod = m[2].toUpperCase();
      if (mod === 'K') return Math.round(n * 1000);
      if (mod === 'M') return Math.round(n * 1_000_000);
      if (mod === 'B') return Math.round(n * 1_000_000_000);
      return Math.round(n);
    };

    const extracted = [];
    const commentBlocks = document.querySelectorAll('div[role="article"]');

    commentBlocks.forEach((block, index) => {
      try {
        const authorLink = block.querySelector('a[role="link"][href*="facebook.com"], a[role="link"][href^="/"]');
        const nameEl = block.querySelector('h4, a[role="link"] span, span[dir="auto"] strong');
        const bodyEl = block.querySelector('div[dir="auto"]');
        const timeEl = block.querySelector('a[role="link"] span[style*="white-space"]');
        const timeAnchor = block.querySelector('a[role="link"] time');

        if (!nameEl && !bodyEl) return;

        const name = authorLink ? authorLink.textContent.trim() : (nameEl ? nameEl.textContent.trim() : '');
        let profileUrl = authorLink ? authorLink.getAttribute('href') : '';
        if (profileUrl && profileUrl.startsWith('/')) {
          profileUrl = 'https://www.facebook.com' + profileUrl;
        }

        let username = '';
        if (authorLink && authorLink.href) {
          try {
            const urlObj = new URL(authorLink.href);
            let cleanPath = urlObj.pathname.replace(/^\\/+|\\/+$/g, '');
            if (cleanPath && cleanPath !== 'profile.php' && !cleanPath.includes('posts')) {
              username = cleanPath.split('/')[0];
            } else if (urlObj.searchParams.has('id')) {
              username = urlObj.searchParams.get('id');
            }
          } catch (e) {
            const parts = authorLink.href.split('/');
            username = parts[parts.length - 1] || '';
          }
        }

        const body = bodyEl ? bodyEl.textContent.trim() : '';
        const timeText = timeEl ? timeEl.textContent.trim() : '';
        const timeAttr = timeAnchor ? timeAnchor.getAttribute('datetime') || '' : '';

        let reactionCount = 0;
        const reactionEls = block.querySelectorAll(
          'span[aria-label*="Beğen"], span[aria-label*="Like"], ' +
          '[aria-label*="Beğen"], [aria-label*="Like"]'
        );
        for (const el of reactionEls) {
          const label = el.getAttribute('aria-label') || '';
          const numMatch = label.match(/([\\d,.KMBkmb]+)/);
          if (numMatch) {
            reactionCount = parseShortNumber(numMatch[1]);
            break;
          }
        }
        if (!reactionCount) {
          const textParts = block.textContent || '';
          const likeMatch = textParts.match(/([\\d,.KMBkmb]+)\\s*(Like|Beğen|beğenme|reaction)/i);
          if (likeMatch) {
            reactionCount = parseShortNumber(likeMatch[1]);
          }
        }

        let profilePicture = '';
        const img = block.querySelector('img[referrerpolicy="no-referrer"]');
        if (img) {
          const src = img.getAttribute('src') || '';
          if (src && !src.includes('emoji') && !src.includes('static.xx.fbcdn.net')) {
            profilePicture = src;
          }
        }

        extracted.push({
          id: index + 1,
          legacy_fbid: '',
          author: { name, id: username, profile_url: profileUrl },
          body,
          created_time: timeAttr || timeText,
          reaction_count: reactionCount,
          profile_picture: profilePicture,
        });
      } catch (e) {}
    });

    return extracted;
  })()
`;

/**
 * Scrapes comments from a single Facebook post permalink page.
 * Uses the aggressive scroll/click approach from facebook-comment-scraper.
 *
 * @param {import('puppeteer-core').Browser} browser
 * @param {string} postUrl - Full URL to the Facebook post.
 * @param {object} [options={}]
 * @param {Array|string} [options.cookies]
 * @param {string} [options.userAgent]
 * @param {boolean} [options.debug=false]
 * @param {number} [options.maxComments=0] - Max comments to extract (0 = unlimited).
 * @returns {Promise<Array<object>>}
 */
export async function scrapePostComments(browser, postUrl, options = {}) {
  const {
    cookies = null,
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    debug = false,
    maxComments = 0,
  } = options;

  const page = await browser.newPage();
  try {
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    if (cookies) {
      const cookieList = await parseCookies(cookies);
      if (cookieList.length > 0) await page.setCookie(...cookieList);
    }

    console.log(`Scraping comments from: ${postUrl}`);
    const response = await page.goto(postUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    const title = await page.title();
    const finalUrl = page.url();
    const isLoginWall =
      title.toLowerCase().includes('log in') ||
      title.toLowerCase().includes('login') ||
      title.toLowerCase().includes('sign up') ||
      title.toLowerCase().includes('giriş') ||
      finalUrl.includes('/login') ||
      finalUrl.includes('login_via') ||
      finalUrl.includes('checkpoint');

    if (isLoginWall) {
      throw new Error(
        'Facebook oturum açma sayfasına yönlendirildi.\n' +
        'Yorumları kazımak için geçerli Facebook çerezleri (cookies) gereklidir.\n' +
        `(Yönlendirilen URL: ${finalUrl})`
      );
    }

    if (response && response.status() === 404) {
      throw new Error(`Facebook gönderisi bulunamadı (404): ${postUrl}`);
    }

    if (debug) {
      const { writeFileSync } = await import('fs');
      const html = await page.content();
      writeFileSync('debug_comments_before.html', html, 'utf-8');
    }

    // Use facebook-comment-scraper's aggressive scroll/click loop
    await page.waitForSelector('div[role="article"]', { timeout: 30000 }).catch(() => {});
    console.log('Loading all comments via scroll/click loop...');
    await loadAllComments(page);

    if (debug) {
      const { writeFileSync } = await import('fs');
      const html = await page.content();
      writeFileSync('debug_comments_after.html', html, 'utf-8');
      console.log('[debug] HTML kaydedildi');
    }

    const raw = await page.evaluate(EXTRACT_SCRIPT);
    const comments = Array.isArray(raw) ? raw : [];

    console.log(`Found ${comments.length} comments.`);
    return maxComments > 0 ? comments.slice(0, maxComments) : comments;
  } finally {
    await page.close();
  }
}
