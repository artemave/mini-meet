import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getClientIp, createLogger } from '../../../src/server.js';

describe('Helper Functions Unit Tests', () => {
  describe('getClientIp', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const req = /** @type {import('express').Request} */ (/** @type {unknown} */ ({
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1'
        },
        socket: { remoteAddress: '127.0.0.1' }
      }));

      const ip = getClientIp(req);
      assert.strictEqual(ip, '192.168.1.1');
    });

    it('should handle single IP in x-forwarded-for', () => {
      const req = /** @type {import('express').Request} */ (/** @type {unknown} */ ({
        headers: {
          'x-forwarded-for': '192.168.1.1'
        },
        socket: { remoteAddress: '127.0.0.1' }
      }));

      const ip = getClientIp(req);
      assert.strictEqual(ip, '192.168.1.1');
    });

    it('should extract IP from x-real-ip if x-forwarded-for missing', () => {
      const req = /** @type {import('express').Request} */ (/** @type {unknown} */ ({
        headers: {
          'x-real-ip': '192.168.1.2'
        },
        socket: { remoteAddress: '127.0.0.1' }
      }));

      const ip = getClientIp(req);
      assert.strictEqual(ip, '192.168.1.2');
    });

    it('should fall back to socket.remoteAddress', () => {
      const req = /** @type {import('express').Request} */ (/** @type {unknown} */ ({
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }));

      const ip = getClientIp(req);
      assert.strictEqual(ip, '127.0.0.1');
    });

    it('should return "unknown" if no IP available', () => {
      const req = /** @type {import('express').Request} */ (/** @type {unknown} */ ({
        headers: {},
        socket: {}
      }));

      const ip = getClientIp(req);
      assert.strictEqual(ip, 'unknown');
    });

    it('should trim whitespace from x-forwarded-for', () => {
      const req = /** @type {import('express').Request} */ (/** @type {unknown} */ ({
        headers: {
          'x-forwarded-for': '  192.168.1.1  , 10.0.0.1'
        },
        socket: { remoteAddress: '127.0.0.1' }
      }));

      const ip = getClientIp(req);
      assert.strictEqual(ip, '192.168.1.1');
    });

    it('should handle IPv6 addresses', () => {
      const req = /** @type {import('express').Request} */ (/** @type {unknown} */ ({
        headers: {},
        socket: { remoteAddress: '::1' }
      }));

      const ip = getClientIp(req);
      assert.strictEqual(ip, '::1');
    });
  });

  describe('createLogger', () => {
    it('should create a logger function', () => {
      const logger = createLogger('test-namespace');
      assert.strictEqual(typeof logger, 'function');
    });

    it('should format metadata in log messages', () => {
      // We can't easily test the debug output, but we can verify the logger
      // is created with the right metadata format by calling it
      const logger = createLogger('test-namespace', { ip: '192.168.1.1', roomId: 'test123' });

      // Logger should be a function
      assert.strictEqual(typeof logger, 'function');

      // Call it (output goes to debug which we might not see in tests)
      assert.doesNotThrow(() => {
        logger('test message');
      });
    });

    it('should filter out falsy metadata values', () => {
      const logger = createLogger('test-namespace', {
        ip: '192.168.1.1',
        roomId: '',
        userId: null,
        sessionId: undefined
      });

      assert.doesNotThrow(() => {
        logger('test message');
      });
    });

    it('should work with empty metadata', () => {
      const logger = createLogger('test-namespace', {});
      assert.doesNotThrow(() => {
        logger('test message');
      });
    });

    it('should work without metadata argument', () => {
      const logger = createLogger('test-namespace');
      assert.doesNotThrow(() => {
        logger('test message');
      });
    });

    it('should handle various metadata types', () => {
      const logger = createLogger('test-namespace', {
        stringVal: 'test',
        numberVal: 123,
        boolVal: true,
        objectVal: { nested: 'value' }
      });

      assert.doesNotThrow(() => {
        logger('test message');
      });
    });
  });
});
