function showStatus(msg, type) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status show ' + type;
}

function showLoading(show) {
  document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function renderComments(comments, postUrl) {
  const list = document.getElementById('commentsList');
  document.getElementById('commentCount').textContent = comments.length;

  if (!comments.length) {
    list.innerHTML = '<div class="empty-state"><p>Bu g\u00f6nderiye ait yorum bulunamad\u0131.</p></div>';
    return;
  }

  list.innerHTML = comments.map(c => {
    const profileUrl = c.authorProfileUrl || (c.authorId ? 'https://www.facebook.com/profile.php?id=' + c.authorId : '#');
    const commentLink = postUrl;

    return '<div class="comment-item">' +
      '<div class="comment-header">' +
        '<a href="' + profileUrl + '" target="_blank" class="comment-author" title="Facebook profiline git">' +
          escapeHtml(c.authorName || 'Bilinmiyor') +
        '</a>' +
        (c.createdTime ? '<span class="comment-date">' + escapeHtml(c.createdTime) + '</span>' : '') +
      '</div>' +
      '<div class="comment-message">' + escapeHtml(c.message || '') + '</div>' +
      '<div class="comment-actions">' +
        '<a href="' + commentLink + '" target="_blank" class="comment-action-btn">G\u00f6nderiyi A\u00e7</a>' +
        '<a href="' + profileUrl + '" target="_blank" class="comment-action-btn">Profili A\u00e7 & Mesaj G\u00f6nder</a>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function fetchComments() {
  const postUrl = document.getElementById('postUrl').value.trim();
  const sortBy = document.getElementById('sortBy').value;

  if (!postUrl) {
    showStatus('L\u00fctfen bir Facebook g\u00f6nderi URL\'si girin.', 'error');
    return;
  }

  showLoading(true);
  showStatus('', '');

  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postUrl, sortBy })
    });

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      throw new Error('Sunucu hatas\u0131: ' + text.slice(0, 200));
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Bilinmeyen hata');

    let comments = data.comments || [];

    if (sortBy === 'oldest') {
      comments = comments.reverse();
    }

    renderComments(comments, postUrl);
    showStatus(comments.length + ' yorum bulundu.', 'success');

  } catch (err) {
    showStatus('Hata: ' + err.message, 'error');
    document.getElementById('commentsList').innerHTML =
      '<div class="empty-state"><p>Hata olu\u015ftu</p><p style="font-size:12px;color:#c62828;">' +
      escapeHtml(err.message) + '</p></div>';
    document.getElementById('commentCount').textContent = '0';
  } finally {
    showLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('postUrl').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') fetchComments();
  });
});
