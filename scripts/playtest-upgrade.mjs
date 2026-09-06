import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.CREATURE_PLAYTEST_PORT || 4188);
const OUT = path.join(REPO, 'output', 'playtest-upgrade');
const findings = [];
const pageErrors = [];
const consoleErrors = [];

function waitPort(port, tries = 80) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      const s = net.connect(port, '127.0.0.1');
      s.on('connect', () => {
        s.end();
        resolve();
      });
      s.on('error', () => {
        s.destroy();
        if (++n > tries) reject(new Error('port timeout'));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

async function layoutDump(page) {
  return page.evaluate(() => {
    const interesting = [
      '#home-page',
      '#selected-info',
      '#inspector',
      '#overflow-drawer',
      '#god-mode-panel',
      '#upgrade-panel',
      '#control-strip',
      '#objective-rail',
      '#stats',
      '#mobile-quick-actions',
      '#tutorial-overlay'
    ];
    const boxes = {};
    for (const sel of interesting) {
      const el = document.querySelector(sel);
      if (!el) {
        boxes[sel] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      boxes[sel] = {
        hidden: el.classList.contains('hidden') || style.display === 'none' || style.visibility === 'hidden',
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        z: style.zIndex,
        overflow: el.scrollHeight > el.clientHeight + 2,
        text: (el.innerText || '').slice(0, 280)
      };
    }
    return {
      title: document.title,
      vw: window.innerWidth,
      vh: window.innerHeight,
      boxes,
      selectedHtml: document.querySelector('#selected-info')?.innerHTML?.slice(0, 500) || '',
      inspectorHtml: document.querySelector('#inspector-body')?.innerHTML?.slice(0, 500) || ''
    };
  });
}

await fs.mkdir(OUT, { recursive: true });
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
  cwd: REPO,
  stdio: 'ignore'
});
let browser;
try {
  await waitPort(PORT);
  browser = await chromium.launch({ headless: true });

  const runViewport = async (name, viewport, mobile) => {
    const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
    page.on('pageerror', e => pageErrors.push(`${name}: ${String((e && e.stack) || e).slice(0, 400)}`));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`${name}: ${msg.text().slice(0, 240)}`);
    });

    await page.goto(`http://127.0.0.1:${PORT}/?worker=1`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#home-page', { timeout: 15000 });
    await page.waitForTimeout(600);
    await shot(page, `${name}-home`);
    const homeDump = await layoutDump(page);

    const homeVisible = await page.evaluate(() => !document.querySelector('#home-page')?.classList.contains('hidden'));
    if (!homeVisible) findings.push(`${name}: home page not visible on first load`);

    const actions = await page.locator('.home-actions .home-btn:visible').count();
    if (actions < 2) findings.push(`${name}: expected at least Guided Run + New Sandbox, got ${actions}`);

    await page.click('#btn-new-game');
    await page.waitForFunction(() => document.querySelector('#home-page')?.classList.contains('hidden'), null, {
      timeout: 20000
    });
    await page.waitForTimeout(500);
    await shot(page, `${name}-sandbox-first`);
    const skipTutorial = page.locator('#tutorial-skip, .touch-onboarding-skip, #gesture-tutorial-dismiss');
    if (await skipTutorial.count()) {
      await skipTutorial
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, `${name}-sandbox`);
    const sandboxDump = await layoutDump(page);

    const selected = sandboxDump.boxes['#selected-info'];
    if (selected && !selected.hidden && !/Observe|inspect/i.test(selected.text)) {
      findings.push(`${name}: empty selected-info missing Observe/inspect copy`);
    }

    const overflowBtn = page.locator('#ctrl-more');
    if (await overflowBtn.count()) {
      await overflowBtn.click({ timeout: 4000 }).catch(() => findings.push(`${name}: could not open overflow`));
      await page.waitForTimeout(400);
      await shot(page, `${name}-menu`);
    }

    const god = page.locator('[data-action="god-mode"]');
    if (await god.count()) {
      await god.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(400);
      await shot(page, `${name}-god`);
    }

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);

    const inspect = page.locator('#ctrl-inspect, [data-tool="inspect"], #btn-inspect');
    // click canvas center to try inspect
    const box = await page.locator('#view, canvas#c, canvas').first().boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.45);
      await page.waitForTimeout(400);
      await shot(page, `${name}-click`);
    }

    await fs.writeFile(path.join(OUT, `${name}-layout.json`), JSON.stringify({ homeDump, sandboxDump }, null, 2));
    await page.close();
  };

  await runViewport('desktop', { width: 1280, height: 800 }, false);
  await runViewport('mobile', { width: 390, height: 844 }, true);

  const report = { findings, pageErrors, consoleErrors: consoleErrors.slice(0, 40) };
  await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (pageErrors.length) process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
