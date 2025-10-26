import { WebSocket } from 'ws';

/**
 * @typedef {{type: string, payload?: any, initiator?: boolean, peers?: number}} WebSocketMessage
 */

/**
 * @typedef {{
 *   ws: WebSocket,
 *   messages: WebSocketMessage[],
 *   waitForMessage: (filter: string | ((msg: WebSocketMessage) => boolean), timeout?: number) => Promise<WebSocketMessage>,
 *   send: (type: string, payload?: any) => void,
 *   close: () => Promise<void>
 * }} TestWebSocketClient
 */

/**
 * Create a WebSocket client for testing
 * @param {string} url - WebSocket URL
 * @param {string} roomId - Room ID to join
 * @returns {Promise<TestWebSocketClient>}
 */
export async function createTestWebSocketClient(url, roomId) {
  const wsUrl = `${url.replace('http', 'ws')}/ws?roomId=${roomId}`;
  const ws = new WebSocket(wsUrl);

  /** @type {WebSocketMessage[]} */
  const messages = [];
  /** @type {Array<{filter: (msg: WebSocketMessage) => boolean, resolve: (msg: WebSocketMessage) => void}>} */
  const messageWaiters = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    messages.push(msg);

    // Notify any waiters
    messageWaiters.forEach(waiter => {
      if (waiter.filter(msg)) {
        waiter.resolve(msg);
      }
    });
  });

  // Wait for connection to open
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  return {
    ws,
    messages,

    /**
     * Wait for a message matching the filter
     * @param {string | ((msg: WebSocketMessage) => boolean)} filter - Filter function or message type string
     * @param {number} [timeout] - Timeout in ms
     * @returns {Promise<WebSocketMessage>}
     */
    waitForMessage: (filter, timeout = 5000) => {
      const filterFn = typeof filter === 'string'
        ? (/** @type {WebSocketMessage} */ msg) => msg.type === filter
        : filter;

      // Check if message already received
      const existing = messages.find(filterFn);
      if (existing) {
        return Promise.resolve(existing);
      }

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const index = messageWaiters.indexOf(waiter);
          if (index > -1) messageWaiters.splice(index, 1);
          reject(new Error(`Timeout waiting for message: ${filter}`));
        }, timeout);

        const waiter = {
          filter: filterFn,
          resolve: (/** @type {WebSocketMessage} */ msg) => {
            clearTimeout(timer);
            const index = messageWaiters.indexOf(waiter);
            if (index > -1) messageWaiters.splice(index, 1);
            resolve(msg);
          }
        };

        messageWaiters.push(waiter);
      });
    },

    /**
     * Send a message
     * @param {string} type
     * @param {any} [payload]
     */
    send: (type, payload) => {
      ws.send(JSON.stringify({ type, payload }));
    },

    /**
     * Close the connection
     */
    close: () => {
      return new Promise((resolve) => {
        ws.once('close', resolve);
        ws.close();
      });
    }
  };
}

/**
 * Create multiple WebSocket clients
 * @param {string} url - Base URL
 * @param {string} roomId - Room ID
 * @param {number} count - Number of clients
 */
export async function createTestWebSocketClients(url, roomId, count) {
  const clients = [];
  for (let i = 0; i < count; i++) {
    clients.push(await createTestWebSocketClient(url, roomId));
  }
  return clients;
}
