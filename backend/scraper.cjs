const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const url = process.argv[2];

if (!url) {
    console.error('Usage: node scraper.cjs <url>');
    process.exit(1);
}

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Randomize viewport slightly
        await page.setViewport({ width: 1366 + Math.floor(Math.random() * 100), height: 768 + Math.floor(Math.random() * 100) });

        // Accelerate load times by not waiting for all trackers to idle
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Wait 3 seconds for Cloudflare JS challenges to clear
        await new Promise(r => setTimeout(r, 3000));

        const html = await page.evaluate(() => document.documentElement.outerHTML);

        // Print the payload to stdout for PHP to capture
        console.log(html);

    } catch (err) {
        console.error('PUPPETEER_ERROR: ' + err.message);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
