import puppeteer from 'puppeteer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = await req.json?.() || req.body;

  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Simplified: capture a screenshot of the full page
    const screenshotBuffer = await page.screenshot({ fullPage: true });

    await browser.close();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="screenshot.jpg"');
    res.status(200).send(screenshotBuffer);
  } catch (err) {
    console.error('Screenshot error:', err);
    res.status(500).json({ error: 'Error generating screenshot' });
  }
}
