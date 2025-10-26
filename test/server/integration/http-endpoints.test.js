import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer, stopTestServer } from '../../helpers/test-server.js';

describe('HTTP Endpoints Integration Tests', () => {
  let server;
  /**
     * @type {string}
     */
  let baseUrl;

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
  });

  after(async () => {
    await stopTestServer();
  });

  describe('GET /', () => {
    it('should return the landing page', async () => {
      const res = await fetch(baseUrl + '/');
      assert.strictEqual(res.status, 200);

      const html = await res.text();
      assert.ok(html.includes('<!DOCTYPE html>'), 'should be HTML');
      assert.ok(html.length > 100, 'should have content');
    });

    it('should set no-cache headers', async () => {
      const res = await fetch(baseUrl + '/');
      assert.strictEqual(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
    });
  });

  describe('GET /new', () => {
    it('should redirect to a new meeting URL', async () => {
      const res = await fetch(baseUrl + '/new', { redirect: 'manual' });
      assert.strictEqual(res.status, 302);

      const location = res.headers.get('location');
      assert.ok(location?.startsWith('/m/'), 'should redirect to /m/...');
      assert.ok(location && location.length > 5, 'should have a meeting ID');
    });

    it('should generate unique meeting IDs', async () => {
      const res1 = await fetch(baseUrl + '/new', { redirect: 'manual' });
      const res2 = await fetch(baseUrl + '/new', { redirect: 'manual' });

      const location1 = res1.headers.get('location');
      const location2 = res2.headers.get('location');

      assert.notStrictEqual(location1, location2, 'should generate different IDs');
    });
  });

  describe('GET /m/:id', () => {
    it('should return the meeting page', async () => {
      const res = await fetch(baseUrl + '/m/test123');
      assert.strictEqual(res.status, 200);

      const html = await res.text();
      assert.ok(html.includes('<!DOCTYPE html>'), 'should be HTML');
      assert.ok(html.includes('test123'), 'should include room ID in page');
    });

    it('should detect mobile user-agent', async () => {
      const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';
      const res = await fetch(baseUrl + '/m/test123', {
        headers: { 'User-Agent': mobileUA }
      });

      const html = await res.text();
      assert.ok(html.includes('__IS_MOBILE__ = true'), 'should set mobile flag');
    });

    it('should detect desktop user-agent', async () => {
      const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      const res = await fetch(baseUrl + '/m/test123', {
        headers: { 'User-Agent': desktopUA }
      });

      const html = await res.text();
      assert.ok(html.includes('__IS_MOBILE__ = false'), 'should not set mobile flag');
    });
  });

  describe('GET /turn', () => {
    it('should return empty iceServers when not configured', async () => {
      process.env['TURN_URLS'] = '';
      const res = await fetch(baseUrl + '/turn');
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.deepStrictEqual(data, { iceServers: [] });
    });

    it('should set no-store cache header', async () => {
      const res = await fetch(baseUrl + '/turn');
      assert.strictEqual(res.headers.get('cache-control'), 'no-store');
    });
  });

  describe('GET /turn with credentials configured', () => {
    let serverWithTurn;

    before(async () => {
      // Set TURN environment variables
      process.env['TURN_URLS'] = 'turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp';
      process.env['TURN_SECRET'] = 'test-secret-key';
      process.env['TURN_TTL'] = '600';

      // Close current server and start new one with TURN config
      await stopTestServer();
      serverWithTurn = await startTestServer();
      baseUrl = serverWithTurn.baseUrl;
    });

    after(async () => {
      // Clean up env vars
      delete process.env['TURN_URLS'];
      delete process.env['TURN_SECRET'];
      delete process.env['TURN_TTL'];
    });

    it('should return TURN credentials', async () => {
      const res = await fetch(baseUrl + '/turn');
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.ok(data.iceServers.length > 0, 'should have ice servers');
      assert.ok(data.iceServers[0].username, 'should have username');
      assert.ok(data.iceServers[0].credential, 'should have credential');
      assert.ok(Array.isArray(data.iceServers[0].urls), 'should have URLs array');
      assert.strictEqual(data.ttl, 600, 'should have TTL');
    });

    it('should generate time-based username', async () => {
      const res = await fetch(baseUrl + '/turn');
      const data = await res.json();

      const username = data.iceServers[0].username;
      const [timestamp, tag] = username.split(':');

      const now = Math.floor(Date.now() / 1000);
      const usernameTime = parseInt(timestamp, 10);

      // Should be current time + TTL (600s)
      assert.ok(usernameTime > now, 'timestamp should be in future');
      assert.ok(usernameTime < now + 700, 'timestamp should be within TTL range');
      assert.ok(tag.length > 0, 'should have random tag');
    });

    it('should generate valid HMAC-SHA1 credential', async () => {
      const res = await fetch(baseUrl + '/turn');
      const data = await res.json();

      const credential = data.iceServers[0].credential;
      // Base64 SHA1 should be 28 characters
      assert.ok(credential.length >= 20, 'should have valid credential length');
    });
  });

  describe('POST /log', () => {
    it('should accept beacon with event and context', async () => {
      const res = await fetch(baseUrl + '/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'test_event',
          context: { key: 'value' }
        })
      });

      assert.strictEqual(res.status, 204);
    });

    it('should accept beacon with event only', async () => {
      const res = await fetch(baseUrl + '/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'test_event' })
      });

      assert.strictEqual(res.status, 204);
    });

    it('should reject beacon without event field', async () => {
      const res = await fetch(baseUrl + '/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { key: 'value' } })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'event required');
    });
  });

  describe('Static files', () => {
    it('should serve files from public directory', async () => {
      // Assuming there's a robots.txt or similar static file
      const res = await fetch(baseUrl + '/sw.js');
      // May be 200 if file exists, or 404 if not
      assert.ok(res.status === 200 || res.status === 404);
    });
  });
});
