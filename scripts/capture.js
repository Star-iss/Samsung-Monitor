const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
const today = new Date().toISOString().split('T')[0];

async function capture(site) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    console.log(`Capturing: ${site.name}`);
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    // Try to close cookie banners
    const cookieSelectors = ['#onetrust-accept-btn-handler', '.cookie-accept', 'button[id*="accept"]'];
    for (const sel of cookieSelectors) {
      try { const btn = await page.$(sel); if (btn) { await btn.click(); await page.waitForTimeout(1000); break; } } catch {}
    }

    const dir = path.join('docs', 'screenshots', site.id);
    fs.mkdirSync(dir, { recursive: true });

    await page.screenshot({ path: path.join(dir, `${today}-full.png`), fullPage: true });
    await page.screenshot({ path: path.join(dir, `${today}-top.png`), fullPage: false });

    console.log(`Done: ${site.name}`);
    return { id: site.id, name: site.name, url: site.url, date: today, success: true };
  } catch (err) {
    console.error(`Failed: ${site.name} - ${err.message}`);
    return { id: site.id, name: site.name, url: site.url, date: today, success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

async function main() {
  const results = [];
  for (const site of config.sites) results.push(await capture(site));

  const metaDir = path.join('docs', 'meta');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(path.join(metaDir, `${today}.json`), JSON.stringify(results, null, 2));

  const indexPath = path.join(metaDir, 'index.json');
  let index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
  if (!index.includes(today)) { index.unshift(today); fs.writeFileSync(indexPath, JSON.stringify(index, null, 2)); }
}

main();
