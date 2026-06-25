import { readFileSync } from 'fs';

function parseCookiesFile(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');
  const cookies = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('HttpOnly,')) continue;

    const parts = trimmed.split('\t');
    if (parts.length >= 7) {
      cookies.push({
        name: parts[5].trim(),
        value: parts[6].trim(),
        domain: parts[0].trim(),
      });
    } else {
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

function toCookieString(cookies) {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

const filePath = process.argv[2];
const format = process.argv[3]?.replace(/^--/, '');

if (!filePath) {
  console.error('Usage: node cookies-to-json.js <cookies.txt> [--array|--string]');
  process.exit(1);
}

const cookies = parseCookiesFile(filePath);

if (format === 'string' || format === 's') {
  console.log(toCookieString(cookies));
} else {
  console.log(JSON.stringify(cookies, null, 2));
}
