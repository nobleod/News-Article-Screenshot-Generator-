const puppeteer = require('puppeteer');
const { parse } = require('url');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL missing' });

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.evaluate(() => {
      const selectors = ['.ad', '[class*="ad-"]', '[id*="ad-"]', 'iframe', 'aside'];
      selectors.forEach(s => document.querySelectorAll(s).forEach(el => el.remove()));
    });

    const data = await page.evaluate(() => {
      const get = (sel) => document.querySelector(sel)?.innerText.trim() || '';
      const getSrc = (sel) => document.querySelector(sel)?.src || '';
      return {
        headline: get('h1'),
        sub: get('h2'),
        author: get('[rel="author"], .author, .byline'),
        date: get('time, .date'),
        logo: getSrc('link[rel~="icon"]') || getSrc('.logo img'),
        cover: getSrc('img[src*="hero"], img[src*="lead"], figure img')
      };
    });

    const html = `
      <body style="font-family:Inter,sans-serif; padding:40px;">
        ${data.logo ? `<img src="${data.logo}" style="max-height:60px; margin-bottom:20px;">` : ''}
        <h1 style="font-size:28px; margin:0 0 10px;">${data.headline}</h1>
        ${data.sub ? `<h2 style="font-size:20px; color:#555; margin:0 0 10px;">${data.sub}</h2>` : ''}
        <p style="color:#888; font-size:14px;">${data.author} | ${data.date}</p>
        ${data.cover ? `<img src="${data.cover}" style="width:100%; margin-top:20px;">` : ''}
      </body>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    const img = await page.screenshot({ type: 'jpeg', quality: 90, fullPage: true });

    const hostname = parse(url).hostname.replace('www.', '');
    const safeTitle = data.headline.replace(/\W+/g, '_').slice(0, 50);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${hostname}_${safeTitle}_${dateStr}.jpeg`;

    res.status(200).json({ imageBase64: img.toString('base64'), filename });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Processing failed' });
  } finally {
    if (browser) await browser.close();
  }
};
