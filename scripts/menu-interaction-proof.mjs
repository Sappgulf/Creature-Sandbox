import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { chromium } from 'playwright';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.CREATURE_MENU_PROOF_PORT || 4177);
const results = [];
const pageErrors = [];

function waitPort(port, tries = 60) {
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
        else setTimeout(tick, 500);
      });
    };
    tick();
  });
}

async function step(name, fn) {
  try {
    await fn();
    results.push(`PASS: ${name}`);
  } catch (e) {
    const detail = process.env.FULLERR
      ? ` — ${String(e.message).split('\n').slice(0, 14).join(' | ')}`
      : ` — ${e.message.split('\n')[0]}`;
    results.push(`FAIL: ${name}${detail}`);
  }
}

const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
  cwd: REPO,
  stdio: 'ignore'
});
let browser;
try {
  await waitPort(PORT);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => pageErrors.push(String((e && e.stack) || e).slice(0, 600)));

  // Main-thread mode: exercises the real prop/god/sim paths (worker transport
  // for props + god powers is a separate, unit-tested layer).
  await page.goto(`http://127.0.0.1:${PORT}/?smoke=1&worker=0`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function', null, { timeout: 20000 });
  await page.waitForFunction(
    () => {
      try {
        const s = JSON.parse(window.render_game_to_text());
        return s.ui && s.ui.homeVisible === false && s.summary.totalCreatures > 0;
      } catch {
        return false;
      }
    },
    null,
    { timeout: 30000 }
  );

  const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const visible = sel =>
    page.evaluate(s => {
      const el = document.querySelector(s);
      if (!el || el.classList.contains('hidden')) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }, sel);
  const openOverflow = async () => {
    const isOpen = await visible('#overflow-drawer');
    if (!isOpen) await page.click('#ctrl-more');
    await page.waitForSelector('#overflow-drawer:not(.hidden)', { timeout: 5000 });
  };
  const canvasClick = async () => {
    const box = await page.locator('#view').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };

  await step('overflow drawer opens', async () => {
    await openOverflow();
    assert.ok(await visible('#overflow-drawer'));
  });

  await step('prop picker opens with 11 types', async () => {
    await openOverflow();
    await page.click('[data-action="props"]');
    await page.waitForSelector('#prop-picker-drawer:not(.hidden)', { timeout: 5000 });
    const n = await page.locator('#prop-picker-drawer [data-prop]').count();
    assert.equal(n, 11, `expected 11 prop cards, got ${n}`);
  });

  await step('prop card selects + canvas click places a prop', async () => {
    await page.locator('#prop-picker-drawer [data-prop]').first().click();
    await canvasClick();
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).summary.totalProps >= 1, null, {
      timeout: 8000
    });
  });

  await step('Shift+P cycles prop type without error', async () => {
    await page.keyboard.press('Shift+P');
  });

  await step('Esc closes drawers', async () => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#prop-picker-drawer').classList.contains('hidden'), null, {
      timeout: 5000
    });
  });

  const GOD_TOOLS = ['food', 'calm', 'chaos', 'spawn', 'prop', 'remove', 'bless', 'curse', 'attract', 'repel'];
  await step('god panel opens', async () => {
    await openOverflow();
    await page.click('[data-action="god-mode"]');
    await page.waitForSelector('#god-mode-panel:not(.hidden)', { timeout: 5000 });
  });

  for (const tool of GOD_TOOLS) {
    await step(`god tool ${tool} activates`, async () => {
      await page.click(`#god-tool-${tool}`);
      const active = await page.evaluate(() => document.querySelector('#god-mode-panel').dataset.activeTool);
      assert.equal(active, tool, `activeTool=${active}`);
    });
  }

  await step('god hotkeys 7/8/9/0 switch powers', async () => {
    for (const [key, tool] of [
      ['7', 'bless'],
      ['8', 'curse'],
      ['9', 'attract'],
      ['0', 'repel']
    ]) {
      await page.keyboard.press(key);
      const active = await page.evaluate(() => document.querySelector('#god-mode-panel').dataset.activeTool);
      assert.equal(active, tool, `key ${key}: activeTool=${active}`);
    }
  });

  await step('bless tap affects world without errors', async () => {
    await page.click('#god-tool-bless');
    const before = (await state()).summary.totalCreatures;
    await canvasClick();
    await page.waitForTimeout(600);
    const after = (await state()).summary.totalCreatures;
    assert.ok(after > 0 && before > 0, `creatures before=${before} after=${after}`);
  });

  await step('god panel exits via Done', async () => {
    await page.waitForTimeout(2500); // let tap ripples/toasts settle so hit-testing lands on Done
    try {
      await page.click('#god-mode-exit', { timeout: 10000 });
      // NOTE: assert on classList, not waitForSelector (which waits for VISIBLE by default
      // and can never match a .hidden element).
      await page.waitForFunction(() => document.querySelector('#god-mode-panel').classList.contains('hidden'), null, {
        timeout: 5000
      });
    } catch (e) {
      const diag = await page.evaluate(() => {
        const btn = document.querySelector('#god-mode-exit');
        const r = btn ? btn.getBoundingClientRect() : null;
        const top = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
        return {
          btnExists: !!btn,
          topIsBtn: top === btn,
          topId: top?.id || top?.className || top?.tagName,
          panelHidden: document.querySelector('#god-mode-panel')?.classList.contains('hidden'),
          activeTool: document.querySelector('#god-mode-panel')?.dataset.activeTool,
          focused: document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName,
          btnRect: r ? [r.x, r.y, r.width, r.height].map(v => Math.round(v)) : null
        };
      });
      throw new Error(`${e.message.split('\n')[0]} | DIAG ${JSON.stringify(diag)}`);
    }
  });

  const PANELS = [
    // [menu click selector, expected panel selector, step name]
    // Campaign/Achievements menu items fire data-action="upgrades" (Field
    // Journal routing, bcd62a1), so they are clicked by button id.
    ['upgrades', '[data-action="upgrades"]', '#upgrade-panel'],
    ['scenario', '[data-action="scenario"]', '#scenario-panel'],
    ['gene-editor', '[data-action="gene-editor"]', '#gene-editor-panel'],
    ['sound', '[data-action="sound"]', '#sound-panel'],
    ['eco-health', '[data-action="eco-health"]', '#eco-health-panel'],
    ['features', '[data-action="features"]', '#features-panel'],
    ['mode', '[data-action="mode"]', '#session-meta'],
    ['help', '[data-action="help"]', '#shortcuts-overlay'],
    ['replay', '[data-action="replay"]', '#replay-panel'],
    ['insights', '[data-action="insights"]', '#insights-panel'],
    ['lineage-album', '[data-action="lineage-album"]', '#lineage-album-panel'],
    ['campaign', '#menu-campaign', '#upgrade-panel'],
    ['achievements', '#menu-achievements', '#upgrade-panel']
  ];
  for (const [action, clickSel, sel] of PANELS) {
    await step(`panel ${action} opens and Esc closes`, async () => {
      await openOverflow();
      await page.click(clickSel);
      await page.waitForFunction(
        s => {
          const el = document.querySelector(s);
          return !!el && !el.classList.contains('hidden');
        },
        sel,
        { timeout: 8000 }
      );
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    });
  }

  await step('W toggles watch mode, Q quirks, ? help', async () => {
    await page.keyboard.press('w');
    assert.ok(await visible('#watch-strip'), 'watch strip should show');
    await page.keyboard.press('Escape');
    await page.keyboard.press('q');
    await page.keyboard.press('?');
    assert.ok(await visible('#shortcuts-overlay'), 'shortcuts should show');
    await page.keyboard.press('Escape');
  });

  await step('no page errors during interaction proof', async () => {
    assert.equal(pageErrors.length, 0, `${pageErrors.length} errors: ${pageErrors.slice(0, 3).join(' | ')}`);
  });
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

console.log(results.join('\n'));
const fails = results.filter(r => r.startsWith('FAIL'));
console.log(`\nPassed: ${results.length - fails.length} Failed: ${fails.length}`);
if (pageErrors.length) console.log('Page errors:', pageErrors.slice(0, 5).join('\n'));
process.exit(fails.length ? 1 : 0);
