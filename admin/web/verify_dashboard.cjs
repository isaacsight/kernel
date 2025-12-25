const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log('Launching headless browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Test Mobile Viewport
    console.log('Setting viewport to Mobile (375x812)...');
    await page.setViewport({ width: 375, height: 812 });

    try {
        console.log('Navigating to Legacy Dashboard...');
        await page.goto('http://localhost:8000/legacy-dashboard', { waitUntil: 'networkidle0' });

        // 1. Verify Title/Content
        const title = await page.title();
        console.log(`Page Title: ${title}`);

        // Check for specific element (Top Header)
        const headerExists = await page.$eval('header', el => !!el);
        console.log(`Header exists: ${headerExists}`);

        // INJECT DUMMY CONTENT TO FORCE SCROLL
        await page.evaluate(() => {
            const div = document.createElement('div');
            div.style.height = '2000px';
            div.style.background = 'red';
            document.body.appendChild(div);
            console.log('Injected 2000px div');
        });

        // 2. Test Scrolling
        console.log('Testing Scroll...');

        // Get initial scroll position
        const initialScroll = await page.evaluate(() => window.scrollY);
        console.log(`Initial Scroll Y: ${initialScroll}`);

        // Scroll down
        await page.evaluate(() => window.scrollBy(0, 500));

        // Wait for scroll
        await new Promise(r => setTimeout(r, 500));

        // Get new scroll position
        const newScroll = await page.evaluate(() => window.scrollY);
        console.log(`New Scroll Y: ${newScroll}`);

        const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
        const clientHeight = await page.evaluate(() => window.innerHeight);
        console.log(`Scroll Height: ${scrollHeight}, Client Height: ${clientHeight}`);

        if (newScroll > 0) {
            console.log('SUCCESS: Page scrolled successfully on mobile viewport.');
        } else {
            console.error('FAILURE: Page did not scroll.');
            // Take Screenshot on failure
            const screenshotPath = '/Users/isaachernandez/.gemini/antigravity/brain/3a1d3c8a-deb5-48e9-8c94-880654b9113d/mobile_dashboard_failure.png';
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`Debug screenshot saved to: ${screenshotPath}`);
            process.exit(1);
        }

        // Take Screenshot
        // Check if artifacts dir exists
        const screenshotPath = '/Users/isaachernandez/.gemini/antigravity/brain/3a1d3c8a-deb5-48e9-8c94-880654b9113d/mobile_dashboard_verify.png';
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to: ${screenshotPath}`);

    } catch (err) {
        console.error('Verification Failed:', err);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
