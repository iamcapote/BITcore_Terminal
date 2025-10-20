/**
 * Why: Automate the "Ladle smoke screenshot" checklist item so the UI backlog stays verifiable without manual capture.
 * What: Starts Ladle on a loopback port, drives Chromium via Puppeteer to the primitives story, and writes a timestamped PNG.
 * How: Polls for server readiness, captures a high-DPI screenshot, and tears everything down cleanly even on failure paths.
 */

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

import puppeteer from 'puppeteer';

const LADLE_PORT = Number(process.env.LADLE_PORT ?? 61005);
const STORY_ID = process.env.LADLE_STORY ?? 'primitives-buttons';
const BASE_URL = `http://127.0.0.1:${LADLE_PORT}`;
const TARGET_URL = `${BASE_URL}/?story=${encodeURIComponent(STORY_ID)}`;
const OUTPUT_DIR = resolve(process.cwd(), 'app/public/ui/screenshots');
const OUTPUT_PATH = resolve(OUTPUT_DIR, `ladle-smoke-${new Date().toISOString().split('T')[0]}.png`);
const READY_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 750;

async function waitForServerReady() {
  const started = Date.now();
  while (Date.now() - started < READY_TIMEOUT_MS) {
    try {
      const response = await fetch(BASE_URL, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Ignore until the server is reachable.
    }
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error(`Ladle failed to respond at ${BASE_URL} within ${READY_TIMEOUT_MS}ms.`);
}

async function ensureDirectory(path) {
  await mkdir(path, { recursive: true });
}

async function killProcess(child) {
  if (!child.killed) {
    child.kill('SIGINT');
  }
  await new Promise((resolve) => { child.once('exit', resolve); });
}

async function captureScreenshot() {
  const runner = spawn('pnpm', ['run', 'ui:ladle', '--', '--port', String(LADLE_PORT)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  runner.stdout.on('data', (chunk) => {
    process.stdout.write(`[ladle] ${chunk}`);
  });
  runner.stderr.on('data', (chunk) => {
    process.stderr.write(`[ladle:err] ${chunk}`);
  });

  try {
    await waitForServerReady();
    await ensureDirectory(dirname(OUTPUT_PATH));

    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
      await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: READY_TIMEOUT_MS });
      await page.waitForTimeout(1200);

      const screenshot = await page.screenshot({ type: 'png', fullPage: true });
      await writeFile(OUTPUT_PATH, screenshot);
      console.log(`[capture-ladle] Screenshot saved to ${OUTPUT_PATH}`);
    } finally {
      await browser.close();
    }
  } finally {
    await killProcess(runner);
  }
}

captureScreenshot().catch((error) => {
  console.error('[capture-ladle] Failed to capture screenshot:', error);
  process.exitCode = 1;
});
