const express = require('express');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.all('/proxy', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Нет ссылки');

  try {
    const urlObj = new URL(targetUrl);
    for (const [key, val] of Object.entries(req.query)) {
      if (key !== 'url') urlObj.searchParams.set(key, val);
    }
    targetUrl = urlObj.toString();

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
      },
      redirect: 'follow'
    });

    const finalUrl = response.url;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      const html = await response.text();
      const $ = cheerio.load(html);

      $('head').prepend(`<base href="${finalUrl}">`);

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          try {
            const absUrl = new URL(href, finalUrl).href;
            $(el).attr('href', '/proxy?url=' + encodeURIComponent(absUrl));
            $(el).removeAttr('target');
          } catch (e) {}
        }
      });

      $('form').each((_, el) => {
        const action = $(el).attr('action') || finalUrl;
        try {
          const absAction = new URL(action, finalUrl).href;
          $(el).attr('action', '/proxy');
          $(el).prepend(`<input type="hidden" name="url" value="${absAction}">`);
          $(el).removeAttr('target');
        } catch (e) {}
      });

      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send($.html());
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.set('Content-Type', contentType);
      res.send(buffer);
    }
  } catch (err) {
    res.status(500).send('Ошибка загрузки: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log('Server OK on 3000');
});
