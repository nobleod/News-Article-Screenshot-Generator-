const puppeteer = require('puppeteer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Just as a simple placeholder: screenshot full page
    const screenshot = await page.screenshot({ fullPage: true });

    await browser.close();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="screenshot.jpg"');
    res.status(200).send(screenshot);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating screenshot' });
  }
};
