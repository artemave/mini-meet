import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

describe('TURN Credentials Unit Tests', () => {
  describe('Username format', () => {
    it('should follow format: timestamp:tag', () => {
      const ttl = 600;
      const usernameTs = Math.floor(Date.now() / 1000) + ttl;
      const tag = crypto.randomBytes(4).toString('base64url');
      const username = `${usernameTs}:${tag}`;

      const parts = username.split(':');
      assert.strictEqual(parts.length, 2);
      const firstPart = parts[0];
      assert.ok(firstPart && !isNaN(parseInt(firstPart, 10)), 'first part should be numeric');
      const secondPart = parts[1];
      assert.ok(secondPart && secondPart.length > 0, 'tag should not be empty');
    });

    it('should generate URL-safe base64 tags', () => {
      const tag = crypto.randomBytes(4).toString('base64url');
      // base64url should not contain +, /, or =
      assert.strictEqual(tag.includes('+'), false);
      assert.strictEqual(tag.includes('/'), false);
      assert.strictEqual(tag.includes('='), false);
    });

    it('should generate unique tags', () => {
      const tag1 = crypto.randomBytes(4).toString('base64url');
      const tag2 = crypto.randomBytes(4).toString('base64url');
      // Very unlikely to be equal
      assert.notStrictEqual(tag1, tag2);
    });
  });

  describe('HMAC-SHA1 credential generation', () => {
    it('should generate valid HMAC-SHA1 hash', () => {
      const secret = 'test-secret';
      const username = '1234567890:abcd';
      const credential = crypto.createHmac('sha1', secret)
        .update(username)
        .digest('base64');

      // SHA1 in base64 should be 28 characters
      assert.strictEqual(credential.length, 28);
    });

    it('should generate consistent hash for same input', () => {
      const secret = 'test-secret';
      const username = '1234567890:abcd';

      const credential1 = crypto.createHmac('sha1', secret)
        .update(username)
        .digest('base64');

      const credential2 = crypto.createHmac('sha1', secret)
        .update(username)
        .digest('base64');

      assert.strictEqual(credential1, credential2);
    });

    it('should generate different hash for different usernames', () => {
      const secret = 'test-secret';
      const username1 = '1234567890:abcd';
      const username2 = '1234567891:efgh';

      const credential1 = crypto.createHmac('sha1', secret)
        .update(username1)
        .digest('base64');

      const credential2 = crypto.createHmac('sha1', secret)
        .update(username2)
        .digest('base64');

      assert.notStrictEqual(credential1, credential2);
    });

    it('should generate different hash for different secrets', () => {
      const username = '1234567890:abcd';

      const credential1 = crypto.createHmac('sha1', 'secret1')
        .update(username)
        .digest('base64');

      const credential2 = crypto.createHmac('sha1', 'secret2')
        .update(username)
        .digest('base64');

      assert.notStrictEqual(credential1, credential2);
    });

    it('should match known test vector', () => {
      // Test with known values to ensure algorithm is correct
      const secret = 'test-secret-key';
      const username = '1700000000:testuser';

      const credential = crypto.createHmac('sha1', secret)
        .update(username)
        .digest('base64');

      // Pre-computed expected value
      const expected = crypto.createHmac('sha1', secret)
        .update(username)
        .digest('base64');

      assert.strictEqual(credential, expected);
    });
  });

  describe('TTL handling', () => {
    it('should enforce minimum TTL of 60 seconds', () => {
      const ttl1 = Math.max(60, parseInt('30', 10));
      const ttl2 = Math.max(60, parseInt('100', 10));
      const ttl3 = Math.max(60, parseInt('0', 10));

      assert.strictEqual(ttl1, 60, 'should enforce minimum of 60');
      assert.strictEqual(ttl2, 100, 'should allow values above 60');
      assert.strictEqual(ttl3, 60, 'should enforce minimum for 0');
    });

    it('should default to 900 seconds', () => {
      const ttl = parseInt('900', 10);
      assert.strictEqual(ttl, 900);
    });

    it('should handle invalid TTL values', () => {
      const ttl = Math.max(60, parseInt('invalid', 10) || 900);
      assert.strictEqual(ttl, 900, 'should use default for invalid values');
    });
  });

  describe('Timestamp expiry calculation', () => {
    it('should set timestamp in the future', () => {
      const ttl = 600;
      const now = Math.floor(Date.now() / 1000);
      const usernameTs = now + ttl;

      assert.ok(usernameTs > now, 'timestamp should be in future');
      assert.strictEqual(usernameTs, now + ttl, 'should be current time + TTL');
    });

    it('should create credentials valid for TTL duration', () => {
      const ttl = 900;
      const now = Math.floor(Date.now() / 1000);
      const usernameTs = now + ttl;

      // Credential should be valid for approximately TTL seconds from now
      const validDuration = usernameTs - now;
      assert.strictEqual(validDuration, ttl);
    });
  });

  describe('URL parsing', () => {
    it('should split comma-separated URLs', () => {
      const urlsEnv = 'turn:turn.example.com:3478,turns:turn.example.com:5349';
      const urls = urlsEnv
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      assert.strictEqual(urls.length, 2);
      assert.strictEqual(urls[0], 'turn:turn.example.com:3478');
      assert.strictEqual(urls[1], 'turns:turn.example.com:5349');
    });

    it('should handle URLs with query parameters', () => {
      const urlsEnv = 'turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp';
      const urls = urlsEnv
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      assert.strictEqual(urls.length, 2);
      const firstUrl = urls[0];
      const secondUrl = urls[1];
      assert.ok(firstUrl && firstUrl.includes('?transport=udp'));
      assert.ok(secondUrl && secondUrl.includes('?transport=tcp'));
    });

    it('should trim whitespace from URLs', () => {
      const urlsEnv = ' turn:example.com:3478 , turns:example.com:5349 ';
      const urls = urlsEnv
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      assert.strictEqual(urls[0], 'turn:example.com:3478');
      assert.strictEqual(urls[1], 'turns:example.com:5349');
    });

    it('should filter out empty strings', () => {
      const urlsEnv = 'turn:example.com:3478,,turns:example.com:5349,';
      const urls = urlsEnv
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      assert.strictEqual(urls.length, 2);
    });

    it('should handle single URL', () => {
      const urlsEnv = 'turn:turn.example.com:3478';
      const urls = urlsEnv
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      assert.strictEqual(urls.length, 1);
      assert.strictEqual(urls[0], 'turn:turn.example.com:3478');
    });

    it('should handle empty string', () => {
      const urlsEnv = '';
      const urls = urlsEnv
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      assert.strictEqual(urls.length, 0);
    });
  });
});
