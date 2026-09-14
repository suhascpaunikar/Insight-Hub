/* Loads each built screen in Chromium, reports console errors and what
   actually rendered. Not a test suite — a smoke check for the port. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = 'dist';
const BASE = '/Insight-Hub/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(req.url.split('?')[0]);
  if (path.startsWith(BASE)) path = path.slice(BASE.length - 1);
  if (path === '/') path = '/index.html';
  const file = join(ROOT, path);
  try {
    await stat(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['index', 'builder', 'insights', 'settings'];
let failures = 0;

for (const name of pages) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  /* The webfont link is deliberately non-blocking, and it is the only resource
     on this page that is not served from the local server below. So anything
     that is not localhost is the font, whatever the failure looks like — a
     reset, a DNS miss, or a CA the sandbox proxy does not present. Matching on
     the message text instead missed the cert case, because a cert error does
     not quote the URL that provoked it. */
  const ignore = (text) => !/localhost|127\.0\.0\.1/.test(text);
  page.on('console', (m) => { if (m.type() === 'error' && !ignore(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
  page.on('requestfailed', (r) => { if (!ignore(r.url())) errors.push(`REQFAIL ${r.url()}`); });
  await page.goto(`http://localhost:${port}${BASE}${name}.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const info = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    canvas: getComputedStyle(document.body).backgroundColor,
    railItems: document.querySelectorAll('[data-slot="sidebar-menu-button"], [data-kumo-component="sidebar-menu-button"]').length,
    kumoNodes: document.querySelectorAll('[data-kumo-component]').length,
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 140),
  }));
  await page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/${name}.png`, fullPage: false });
  const ok = errors.length === 0;
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(9)} mode=${info.mode} bg=${info.canvas} kumo-nodes=${info.kumoNodes} rail=${info.railItems}`);
  console.log(`      ${info.text}`);
  errors.slice(0, 6).forEach((e) => console.log(`      ! ${e.slice(0, 220)}`));
  await page.close();
}

await browser.close();
server.close();
process.exit(failures ? 1 : 0);
