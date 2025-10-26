import { createServer } from '../../src/server.js';

/**
 * @typedef {Awaited<ReturnType<typeof createServer>>} ServerInstance
 * @typedef {ServerInstance & { baseUrl: string, close: () => Promise<void> }} TestServerInstance
 */

/** @type {TestServerInstance | null} */
let serverInstance = null;

/**
 * Start test server on a random available port
 * @returns {Promise<TestServerInstance>}
 */
export async function startTestServer() {
  if (serverInstance) {
    throw new Error('Test server already running. Call closeTestServer() first.');
  }

  const { app, server, rooms, wss } = createServer();

  // Listen on random port (0 = OS assigns available port)
  await new Promise((resolve) => {
    server.listen(0, 'localhost', () => resolve(undefined));
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to get server address');
  }
  const protocol = 'key' in server && server.key ? 'https' : 'http';
  const baseUrl = `${protocol}://localhost:${address.port}`;

  serverInstance = {
    app,
    server,
    rooms,
    wss,
    baseUrl,
    close: async () => {
      // Close all WebSocket connections
      for (const room of rooms.values()) {
        for (const ws of room) {
          ws.close();
        }
      }
      rooms.clear();

      // Close WebSocket server
      await new Promise((/** @type {(err?: Error) => void} */ resolve) => wss.close(resolve));

      // Close HTTP server
      await new Promise((/** @type {(err?: Error) => void} */ resolve) => server.close(resolve));

      serverInstance = null;
    }
  };

  return serverInstance;
}

/**
 * Close the test server
 */
export async function stopTestServer() {
  if (serverInstance) {
    await serverInstance.close();
  }
}

/**
 * Get the current test server instance
 */
export function getTestServer() {
  return serverInstance;
}
