import puppeteer from 'puppeteer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid or missing URL' });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Remove ads and noise
    await page.evaluate(() => {
      const adSelectors = [
        '[class*="ad"]',
        '[id*="ad"]',
        'iframe',
        'aside',
        '.promo',
        '.sponsored',
        '.banner'
      ];
      adSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });
    });

    const data = await page.evaluate(() => {
      const getText = (selector) =>
        document.querySelector(selector)?.innerText?.trim() || '';
      const getSrc = (selector) =>
        document.querySelector(selector)?.src || '';
      const getMeta = (prop) =>
        document.querySelector(`meta[property="${prop}"]`)?.content || '';

      return {
        headline: getText('h1') || getMeta('og:title'),
        sub: getText('h2'),
        author:
          getText('[rel="author"]') ||
          getText('.author') ||
          getText('.byline'),
        date:
          getText('time') ||
          getText('.date') ||
          getMeta('article:published_time'),
        logo:
          getSrc('.logo img') ||
          getMeta('og:image') ||
          getSrc('link[rel*="icon"]'),
        cover:
          getSrc('article img') ||
          getMeta('og:image') ||
          getSrc('img[src*="hero"]')
      };
    });

    const html = `
      <html>
        <head>
          <style>
            body {
              font-family: Inter, sans-serif;
              background: white;
              padding: 40px;
              max-width: 800px;
              margin: auto;
              color: #111;
            }
            img.logo {
              max-height: 60px;
              margin-bottom: 20px;
            }
            h1 {
              font-size: 28px;
              margin-bottom: 10px;
            }
            h2 {
              font-size: 20px;
              margin-bottom: 10px;
              color: #555;
            }
            p.meta {
              font-size: 14px;
              color: #777;
              margin-bottom: 20px;
            }
            img.cover {
              width: 100%;
              margin-top: 20px;
              border-radius: 8px;
            }
          </style>
        </head>
        <body>
          ${data.logo ? `<img class="logo" src="${data.logo}" />` : ''}
          <h1>${data.headline}</h1>
          ${data.sub ? `<h2>${data.sub}</h2>` : ''}
          <p class="meta">${data.author} | ${data.date}</p>
          ${data.cover ? `<img class="cover" src="${data.cover}" />` : ''}
        </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 90,
      fullPage: true
    });

    const domain = new URL(url).hostname.replace('www.', '');
    const safeTitle = (data.headline || 'Article')
      .replace(/\W+/g, '_')
      .slice(0, 50);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${domain}_${safeTitle}_${dateStr}.jpeg`;

    res.status(200).json({
      imageBase64: screenshotBuffer.toString('base64'),
      filename
    });
  } catch (error) {
    console.error('Screenshot generation failed:', error);
    res.status(500).json({ error: 'Screenshot generation failed' });
  } finally {
    if (browser) await browser.close();
  }
}
