import express from 'express';
import { getPostComments } from './index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

app.post('/api/comments', async (req, res) => {
  try {
    const { postUrl, cookies } = req.body;
    if (!postUrl) return res.status(400).json({ error: 'Post URL gerekli' });

    const token = process.env.BROWSERLESS_TOKEN;
    if (!token) return res.status(500).json({ error: 'BROWSERLESS_TOKEN ayarlanmamış' });

    const options = {
      browserlessToken: token,
      maxComments: 100,
      debug: process.env.DEBUG === 'true'
    };

    if (cookies) {
      options.cookies = cookies;
      console.log('Panelden gönderilen cookies kullanılıyor');
    } else if (process.env.FACEBOOK_COOKIES) {
      options.cookies = process.env.FACEBOOK_COOKIES;
      console.log('FACEBOOK_COOKIES env kullanılıyor');
    }

    const data = await getPostComments(postUrl, options);

    const comments = (data || []).map(c => ({
      id: c.legacy_fbid || c.id || '',
      authorName: c.author?.name || 'Bilinmiyor',
      authorId: c.author?.id || '',
      authorProfileUrl: c.author?.profile_url || '',
      message: c.body || '',
      createdTime: c.created_time || '',
      reactionCount: c.reaction_count || 0
    }));

    res.json({ comments });
  } catch (err) {
    console.error('API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static('public'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Dentrakip çalışıyor → http://localhost:' + PORT);
});
