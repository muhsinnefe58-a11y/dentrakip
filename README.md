# facebook-scraper-node

[![npm version](https://img.shields.io/badge/npm-1.0.0-blue)](https://www.npmjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Facebook public sayfalarından, gruplarından ve profillerden **API key gerektirmeden** veri kazıyan modern Node.js kütüphanesi.

Tarayıcı işlemleri için `puppeteer-core` kullanır; tarayıcıyı kütüphane yerine **browserless.io** üzerinden (veya kendi başlattığınız bir Puppeteer instance'ı üzerinden) çalıştırırsınız. Bu sayede sunucu ortamlarına (Vercel dahil) kolayca entegre edilebilir.

---

## Kurulum

```bash
npm install
```

> **Gereksinim:** Bir [browserless.io](https://browserless.io) hesabı ve API token'ı gereklidir.  
> Ücretsiz plan: https://browserless.io

---

## Hızlı Başlangıç

```js
import { getPosts, getProfile, getGroupInfo, getPostComments } from './index.js';

const posts = await getPosts('nintendo', {
  pages: 2,
  browserlessToken: 'YOUR_BROWSERLESS_TOKEN',
});

console.log(posts);
```

---

## Yapılandırma (Options)

Tüm fonksiyonlar ikinci parametre olarak bir `options` nesnesi alır:

| Seçenek | Tip | Varsayılan | Açıklama |
|---|---|---|---|
| `browserlessToken` | `string` | — | browserless.io API token'ı. `BROWSERLESS_TOKEN` env değişkeniyle de ayarlanabilir. |
| `browserWSEndpoint` | `string` | — | Alternatif Puppeteer WebSocket URL'si (browserless.io veya başka bir servis). |
| `browser` | `Browser` | — | Halihazırda açık bir Puppeteer `Browser` nesnesi. Sağlanırsa kütüphane bağlantıyı yönetmez. |
| `pages` | `number` | `1` | Kazınacak sayfa sayısı (yalnızca `getPosts` için geçerli). |
| `isGroup` | `boolean` | `false` | `true` ise grup olarak kazır. |
| `cookies` | `Array\|string\|object` | `null` | Facebook oturumu için çerezler. Array, string (`name=value;...`) veya `{ file: 'cookies.txt' }` formatında dosya yolu. |
| `userAgent` | `string` | Chrome UA | Özel User-Agent değeri. |
| `delay` | `number` | `1000` | Sayfalar arası bekleme süresi (ms). |

---

## API

### `getPosts(account, options)`

Bir Facebook sayfasının veya grubunun gönderilerini kazır.

```js
import { getPosts } from './index.js';

// Sayfa gönderileri
const posts = await getPosts('nintendo', {
  pages: 3,
  browserlessToken: process.env.BROWSERLESS_TOKEN,
});

// Grup gönderileri
const groupPosts = await getPosts('123456789', {
  isGroup: true,
  pages: 2,
  browserlessToken: process.env.BROWSERLESS_TOKEN,
});
```

**Dönen Array Elemanları:**

```js
{
  post_id: '2257188721032235',
  user_id: '119240841493711',
  username: 'Nintendo',
  user_url: 'https://facebook.com/nintendo',
  text: 'Don't let this diminutive version...',
  time: '30 April 2019',
  timestamp: 1556614801,
  likes: 3509,
  comments: 459,
  shares: 441,
  images: ['https://scontent.fhlz2-1...'],
  links: [{ text: 'Visit site', href: 'https://...' }],
  post_url: 'https://facebook.com/story.php?story_fbid=2257188...'
}
```

---

### `getProfile(account, options)`

Bir Facebook profilinin/sayfasının "Hakkında" bölümünü kazır.

```js
import { getProfile } from './index.js';

const profile = await getProfile('zuck', {
  browserlessToken: process.env.BROWSERLESS_TOKEN,
});
// { name: 'Mark Zuckerberg', About: '...', Work: '...', id: '4' }
```

> Bazı profil bilgileri (doğum tarihi, cinsiyet vb.) yalnızca oturum açıkken görünür.  
> Bunlara erişmek için `cookies` seçeneğini kullanın.

---

### `getGroupInfo(group, options)`

Bir Facebook grubunun genel bilgilerini kazır.

```js
import { getGroupInfo } from './index.js';

const info = await getGroupInfo('makeupartistsgroup', {
  browserlessToken: process.env.BROWSERLESS_TOKEN,
});
// { id: 'makeupartistsgroup', name: 'HAIRSTYLES', type: 'Public group', members: 6814229 }
```

---

### `getPostComments(postUrl, options)`

Bir Facebook gönderisindeki yorumları kazır.

```js
import { getPostComments } from './index.js';

const comments = await getPostComments(
  'https://www.facebook.com/permalink.php?story_fbid=pfbid0...&id=10007...',
  {
    browserlessToken: process.env.BROWSERLESS_TOKEN,
    maxComments: 100,
  }
);

console.log(comments);
```

**Dönen Array Elemanları:**

```js
{
  id: 'Y29tbWVudDoxMDQ2MzU2NDI3NzQwODg1XzE2ODA3MzE0MTk3OTY3NzE=',
  legacy_fbid: '1680731419796771',
  author: {
    name: 'Belya Ebül Abbas',
    id: '100091428733391',
    profile_url: 'https://www.facebook.com/profile.php?id=100091428733391',
  },
  body: 'Selamünaleyküm arkadaşlar...',
  created_time: '2024-06-15T10:30:00+0000',
  reaction_count: 6,
  profile_picture: 'https://scontent.fist1-1.fna.fbcdn.net/...',
}
```

**`getPostComments`'e özel seçenekler:**

| Seçenek | Tip | Varsayılan | Açıklama |
|---|---|---|---|
| `maxComments` | `number` | `0` | Kazınacak maksimum yorum sayısı (`0` = sınırsız). |
| `debug` | `boolean` | `false` | `true` ise sayfanın HTML'ini `debug_comments.html` olarak kaydeder. |

---

## Çerez (Cookie) ile Kimlik Doğrulama

Bazı içeriklere erişmek için Facebook'a giriş yapmış bir oturum gerekir. Çerezlerinizi tarayıcınızdan [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) gibi bir uzantıyla dışa aktarabilirsiniz.

`cookies` seçeneği aşağıdaki formatları destekler:

**1. Puppeteer cookie array (en esnek):**

```js
const posts = await getPosts('nintendo', {
  browserlessToken: process.env.BROWSERLESS_TOKEN,
  cookies: [
    { name: 'c_user', value: '100000XXXXXXXX', domain: '.facebook.com' },
    { name: 'xs',     value: 'XXXXXXXXXX',     domain: '.facebook.com' },
  ],
});
```

**2. Netscape cookie dosyası (`.txt`):** `Get cookies.txt LOCALLY` eklentisinin dışa aktardığı formattır.

```js
const posts = await getPosts('nintendo', {
  browserlessToken: process.env.BROWSERLESS_TOKEN,
  cookies: { file: 'cookies.txt' },
});
```

**3. JSON cookie dosyası (`.json`):** Puppeteer cookie array'ini `.json` olarak kaydedip kullanabilirsiniz.

```js
const posts = await getPosts('nintendo', {
  browserlessToken: process.env.BROWSERLESS_TOKEN,
  cookies: { file: 'cookies.json' },
});
```

**4. String format (`name=value; ...`):**

```js
const posts = await getPosts('nintendo', {
  browserlessToken: process.env.BROWSERLESS_TOKEN,
  cookies: 'c_user=100000XXXXXXXX; xs=XXXXXXXXXX',
});
```

---

## Kendi Puppeteer Instance'ınızı Kullanmak

Birden fazla fonksiyon çağrısında tarayıcıyı paylaşmak isterseniz `browser` seçeneğini geçebilirsiniz:

```js
import puppeteer from 'puppeteer-core';
import { getPosts, getProfile } from './index.js';

const browser = await puppeteer.connect({
  browserWSEndpoint: `wss://chrome.browserless.io?token=${TOKEN}`,
});

// Her iki çağrı aynı tarayıcıyı kullanır
const posts   = await getPosts('nintendo', { browser });
const profile = await getProfile('zuck',   { browser });

// İşi bitince kapatmak size kalır
await browser.close();
```

---

## Çevre Değişkenleri

Projenin kökünde bir `.env` dosyası oluşturun (`.env.example` dosyasını kopyalayabilirsiniz):

```bash
cp .env.example .env
```

`.env` içeriği:
```
BROWSERLESS_TOKEN=your_browserless_token_here
```

---

## Vercel'e Dağıtım

Proje, serverless ortamlarda (Vercel) REST API olarak çalışacak şekilde hazırlanmıştır.

### Gereksinimler

- [Vercel](https://vercel.com) hesabı
- [browserless.io](https://browserless.io) hesabı (ücretsiz plan yeterli)

### Ortam Değişkenleri

Vercel'de aşağıdaki ortam değişkenlerini ayarlayın:

| Değişken | Açıklama |
|---|---|
| `BROWSERLESS_TOKEN` | browserless.io API token'ı |
| `API_KEY` | API'yi korumak için kullandığınız anahtar |

### API Endpoints

**POST `/api/comments`** — Yorum kazıma işlemi başlatır.

```bash
curl -X POST https://your-app.vercel.app/api/comments \
  -H "x-api-key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.facebook.com/permalink.php?story_fbid=...&id=..."}'
```

İsteğe bağlı parametreler:
- `cookies` — Oturum çerezleri (string, array veya `{ file: '...' }`)
- `maxComments` — Maksimum yorum sayısı (0 = sınırsız)

Yanıt:
```json
{ "jobId": "uuid-string", "status": "queued" }
```

**GET `/api/comments/:jobId`** — İşlem sonucunu sorgular.

```bash
curl https://your-app.vercel.app/api/comments/uuid-string \
  -H "x-api-key: your-secret-key"
```

Yanıt:
```json
{
  "jobId": "uuid-string",
  "status": "completed",
  "data": {
    "postUrl": "https://facebook.com/...",
    "comments": [...],
    "totalComments": 42,
    "scrapedAt": "2026-06-23T12:00:00Z",
    "elapsedSeconds": 15
  }
}
```

**GET `/health`** — Sağlık kontrolü.

### Kullanım Akışı

1. `POST /api/comments` ile kazıma işlemini başlatın → `jobId` alırsınız
2. `GET /api/comments/:jobId` ile her 2-3 saniyede bir sonucu sorgulayın
3. `status: "completed"` geldiğinde `data.comments` dizisini okuyun

### Yerel Geliştirme

```bash
# .env dosyası oluşturun
cp .env.example .env
# düzenleyin: BROWSERLESS_TOKEN ve API_KEY

# Sunucuyu başlatın
node api/server.js
# → http://localhost:3000
```

---

## Demo Çalıştırma

```bash
npm test
# veya
node example.js
```

---

## Proje Yapısı

```
facebook-scraper-node/
├── api/
│   ├── comments/
│   │   ├── index.js        # POST /api/comments — işlem başlatma
│   │   └── [jobId].js      # GET /api/comments/:jobId — sonuç sorgulama
│   └── server.js            # Yerel geliştirme sunucusu
├── lib/
│   ├── scraper.js           # Puppeteer tabanlı çekirdek kazıma motoru
│   └── vercel-job-store.js  # Vercel için geçici iş deposu (RAM)
├── index.js                 # Kütüphane giriş noktası
├── example.js               # Kullanım örneği
├── vercel.json              # Vercel dağıtım yapılandırması
├── package.json
├── .env.example
└── README.md
```

---

## Notlar

- Her alan her zaman doldurulamayabilir (bazıları `null` dönebilir).
- Çok fazla istek gönderilirse Facebook IP'nizi geçici olarak engelleyebilir; `delay` seçeneğini artırmanız önerilir.
- Özel / gizli grup ve profiller yalnızca o gruba/profile erişim izni olan bir oturumla (`cookies` seçeneği) kazınabilir.
- Bu kütüphane yalnızca araştırma ve eğitim amaçlıdır. Facebook'un [Kullanım Koşulları](https://www.facebook.com/terms.php)'nı lütfen göz önünde bulundurun.

---

## Lisans

MIT
