import puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        page.on('console', msg => console.log('LOG:', msg.text()));
        page.on('pageerror', error => console.log('ERR_STACK:', error.stack));
        page.on('requestfailed', request => console.log('REQ_FAIL:', request.url(), request.failure() ? request.failure().errorText : 'none'));

        await page.goto('http://127.0.0.1:8080', { waitUntil: 'networkidle0' });

        await browser.close();
    } catch (err) {
        console.error(err);
    }
})();
