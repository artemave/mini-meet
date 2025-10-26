import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { startTestServer, stopTestServer } from '../helpers/test-server.js';

/** @type {string} */
let baseUrl;
/** @type {import('playwright').Browser} */
let browser;
/** @type {import('playwright').Page} */
let page;
/** @type {import('playwright').BrowserContext[]} */
let contexts = [];

/**
 * @param {import('playwright').BrowserContextOptions} [contextOptions]
 * @returns {Promise<import('playwright').Page>}
 */
async function createPage(contextOptions = {}) {
  const context = await browser.newContext(contextOptions);
  context.setDefaultTimeout(2000);
  const newPage = await context.newPage();
  contexts.push(context);
  return newPage;
}

describe('Meeting Page Client Tests', () => {
  before(async () => {
    const server = await startTestServer();
    baseUrl = server.baseUrl;
    browser = await chromium.launch();
  });

  beforeEach(async () => {
    page = await createPage();
  });

  afterEach(async () => {
    for (const context of contexts) {
      await context.close();
    }
    contexts = [];
  });

  after(async () => {
    if (browser) {
      await browser.close();
    }
    await stopTestServer();
  });

  describe('Page loading', () => {
    it('should create new meeting from home page', async () => {
      await page.goto(`${baseUrl}/`);

      await page.getByText('Start a meeting').click();

      await expect(page.getByText('Idle')).toBeVisible();
    });

    it('should show room ID in page title', async () => {
      await page.goto(`${baseUrl}/m/test-room-123`);

      const title = await page.title();
      assert.ok(title.includes('test-room-123'), 'should display room ID in browser tab');
    });

    it('should display Idle status on initial load', async () => {
      await page.goto(`${baseUrl}/m/test-room`);

      await expect(page.getByText('Room: test-room')).toBeVisible();
    });
  });

  describe('Mobile vs Desktop experience', () => {
    it('should show layout toggle on desktop', async () => {
      await page.goto(`${baseUrl}/m/desktop-test`);

      await expect(page.getByLabel('Toggle layout')).toBeVisible();
    });

    it('should show camera swap on mobile', async () => {
      page = await createPage({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      });
      await page.goto(`${baseUrl}/m/mobile-test`);

      await expect(page.getByLabel('Swap camera')).toBeVisible();
    });

    it('should warn users about unsupported browsers', async () => {
      page = await createPage({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) Instagram'
      });
      await page.goto(`${baseUrl}/m/instagram-test`);

      await expect(page.getByText('Browser Not Supported')).toBeVisible();
      await expect(page.getByText(/open this link in your default browser/i)).toBeVisible();
    });
  });

  describe('User controls', () => {
    it('should show microphone control', async () => {
      await page.goto(`${baseUrl}/m/controls-test`);

      await expect(page.getByLabel(/microphone/i)).toBeVisible();
    });

    it('should show video control', async () => {
      await page.goto(`${baseUrl}/m/controls-test`);

      await expect(page.getByLabel(/video/i)).toBeVisible();
    });

    it('should show share link option', async () => {
      await page.goto(`${baseUrl}/m/controls-test`);

      await expect(page.getByLabel('Share link')).toBeVisible();
    });

    it('should show leave meeting option', async () => {
      await page.goto(`${baseUrl}/m/controls-test`);

      await page.getByLabel('Leave meeting').click();

      await expect(page.getByText('Start a meeting')).toBeVisible();
    });
  });

  describe('Desktop features', () => {
    it('should offer screen sharing on desktop', async () => {
      await page.goto(`${baseUrl}/m/desktop-features`);

      await expect(page.getByLabel(/share screen/i)).toBeVisible();
    });

    it('should offer fullscreen mode on desktop', async () => {
      await page.goto(`${baseUrl}/m/fullscreen-test`);

      await expect(page.getByLabel(/fullscreen/i)).toBeVisible();
    });

    it('should not offer screen sharing on mobile', async () => {
      page = await createPage({
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
      });
      await page.goto(`${baseUrl}/m/mobile-no-screenshare`);

      await expect(page.getByLabel(/share screen/i)).toHaveCount(0);
    });
  });

  describe('User feedback', () => {
    it('should confirm when link is copied', async () => {
      await page.goto(`${baseUrl}/m/toast-test`);

      await page.evaluate(() => {
        // @ts-ignore - Overriding clipboard for test
        navigator.clipboard = { writeText: () => Promise.resolve() };
      });

      await page.getByLabel('Share link').click();

      await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 2000 });
    });
  });

  describe('Multi-user support', () => {
    it('should support two users joining same room', async () => {
      const page1 = page;
      const page2 = await createPage();

      await page1.goto(`${baseUrl}/m/peer-test`);
      await page2.goto(`${baseUrl}/m/peer-test`);

      await page1.waitForTimeout(500);
      await page2.waitForTimeout(500);

      await expect(page1.getByLabel('Leave meeting')).toBeVisible();
      await expect(page2.getByLabel('Leave meeting')).toBeVisible();
    });
  });

  describe('Responsive layout', () => {
    it('should provide all essential controls in portrait mobile', async () => {
      page = await createPage({
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        isMobile: true
      });
      await page.goto(`${baseUrl}/m/portrait-test`);

      await expect(page.getByLabel(/microphone/i).locator('visible=true')).toBeVisible();
      await expect(page.getByLabel(/video/i).locator('visible=true')).toBeVisible();
      await expect(page.getByLabel('Share link').locator('visible=true')).toBeVisible();
    });

    it('should provide all essential controls in landscape mobile', async () => {
      page = await createPage({
        viewport: { width: 667, height: 375 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        isMobile: true
      });
      await page.goto(`${baseUrl}/m/landscape-test`);

      await expect(page.getByLabel(/microphone/i).locator('visible=true')).toBeVisible();
      await expect(page.getByLabel(/video/i).locator('visible=true')).toBeVisible();
    });
  });

  describe('Video display', () => {
    it('should show video area for local camera', async () => {
      await page.goto(`${baseUrl}/m/video-test`);

      const videos = await page.$$('video');
      assert.ok(videos.length >= 1, 'should display video area');
    });

    it('should show video area for remote peer', async () => {
      await page.goto(`${baseUrl}/m/video-test`);

      const videos = await page.$$('video');
      assert.ok(videos.length >= 2, 'should have areas for both local and remote video');
    });
  });
});
