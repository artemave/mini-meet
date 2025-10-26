import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer, stopTestServer } from '../../helpers/test-server.js';
import { createTestWebSocketClient } from '../../helpers/websocket-client.js';

describe('WebSocket Signaling Integration Tests', () => {
  /** @type {Awaited<ReturnType<typeof startTestServer>>} */
  let server;
  /** @type {string} */
  let baseUrl;

  before(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
  });

  after(async () => {
    await stopTestServer();
  });

  describe('Connection establishment', () => {
    it('should accept connection with valid roomId', async () => {
      const client = await createTestWebSocketClient(baseUrl, 'test-room');

      const welcome = await client.waitForMessage('welcome');
      assert.strictEqual(welcome.type, 'welcome');
      assert.strictEqual(welcome.initiator, true, 'first client should be initiator');
      assert.strictEqual(welcome.peers, 1);

      await client.close();
    });

    it('should reject connection without roomId', async () => {
      const wsUrl = `${baseUrl.replace('http', 'ws')}/ws`;
      const { WebSocket } = await import('ws');
      const ws = new WebSocket(wsUrl);

      const closePromise = new Promise((resolve) => {
        ws.on('close', (code, reason) => {
          resolve({ code, reason: reason.toString() });
        });
      });

      const result = await closePromise;
      assert.strictEqual(result.code, 1008);
      assert.strictEqual(result.reason, 'roomId required');
    });
  });

  describe('Room capacity', () => {
    it('should allow two clients in same room', async () => {
      const client1 = await createTestWebSocketClient(baseUrl, 'room-capacity');
      const welcome1 = await client1.waitForMessage('welcome');
      assert.strictEqual(welcome1.initiator, true);

      const client2 = await createTestWebSocketClient(baseUrl, 'room-capacity');
      const welcome2 = await client2.waitForMessage('welcome');
      assert.strictEqual(welcome2.initiator, false);
      assert.strictEqual(welcome2.peers, 2);

      await client1.close();
      await client2.close();
    });

    it('should reject third client with room_full', async () => {
      const client1 = await createTestWebSocketClient(baseUrl, 'full-room');
      const client2 = await createTestWebSocketClient(baseUrl, 'full-room');

      // Third client should get room_full and be disconnected
      const wsUrl = `${baseUrl.replace('http', 'ws')}/ws?roomId=full-room`;
      const { WebSocket } = await import('ws');
      const ws3 = new WebSocket(wsUrl);

      const messagePromise = new Promise((resolve) => {
        ws3.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      const closePromise = new Promise((resolve) => {
        ws3.on('close', (code) => resolve(code));
      });

      const msg = await messagePromise;
      assert.strictEqual(msg.type, 'room_full');

      const code = await closePromise;
      assert.strictEqual(code, 1008);

      await client1.close();
      await client2.close();
    });
  });

  describe('Initiator assignment', () => {
    it('should assign first peer as initiator', async () => {
      const client1 = await createTestWebSocketClient(baseUrl, 'initiator-test');
      const welcome1 = await client1.waitForMessage('welcome');

      assert.strictEqual(welcome1.initiator, true);

      await client1.close();
    });

    it('should assign second peer as non-initiator', async () => {
      const client1 = await createTestWebSocketClient(baseUrl, 'initiator-test-2');
      const client2 = await createTestWebSocketClient(baseUrl, 'initiator-test-2');

      const welcome2 = await client2.waitForMessage('welcome');
      assert.strictEqual(welcome2.initiator, false);

      await client1.close();
      await client2.close();
    });
  });

  describe('Message routing', () => {
    it('should forward offer from initiator to peer', async () => {
      const client1 = await createTestWebSocketClient(baseUrl, 'offer-test');
      await client1.waitForMessage('welcome');

      const client2 = await createTestWebSocketClient(baseUrl, 'offer-test');
      await client2.waitForMessage('welcome');

      // Client1 sends offer
      const offerPayload = { sdp: 'fake-sdp', type: 'offer' };
      client1.send('offer', offerPayload);

      // Client2 should receive it
      const offer = await client2.waitForMessage('offer');
      assert.strictEqual(offer.type, 'offer');
      assert.deepStrictEqual(offer.payload, offerPayload);

      await client1.close();
      await client2.close();
    });

    it('should forward answer from peer to initiator', async () => {
      const client1 = await createTestWebSocketClient(baseUrl, 'answer-test');
      await client1.waitForMessage('welcome');

      const client2 = await createTestWebSocketClient(baseUrl, 'answer-test');
      await client2.waitForMessage('welcome');

      // Client2 sends answer
      const answerPayload = { sdp: 'fake-answer-sdp', type: 'answer' };
      client2.send('answer', answerPayload);

      // Client1 should receive it
      const answer = await client1.waitForMessage('answer');
      assert.strictEqual(answer.type, 'answer');
      assert.deepStrictEqual(answer.payload, answerPayload);

      await client1.close();
      await client2.close();
    });

    it('should forward ICE candidates between peers', async () => {
      const client1 = await createTestWebSocketClient(baseUrl, 'ice-test');
      const client2 = await createTestWebSocketClient(baseUrl, 'ice-test');

      await client1.waitForMessage('welcome');
      await client2.waitForMessage('welcome');

      // Client1 sends candidate
      const candidatePayload = { candidate: 'fake-ice-candidate' };
      client1.send('candidate', candidatePayload);

      // Client2 should receive it
      const candidate = await client2.waitForMessage('candidate');
      assert.strictEqual(candidate.type, 'candidate');
      assert.deepStrictEqual(candidate.payload, candidatePayload);

      await client1.close();
      await client2.close();
    });

    it('should forward ready, bye, and leave messages', async () => {
      const client1 = await createTestWebSocketClient(baseUrl, 'messages-test');
      const client2 = await createTestWebSocketClient(baseUrl, 'messages-test');

      await client1.waitForMessage('welcome');
      await client2.waitForMessage('welcome');

      // Test ready
      client1.send('ready', null);
      const ready = await client2.waitForMessage('ready');
      assert.strictEqual(ready.type, 'ready');

      // Test bye
      client1.send('bye', null);
      const bye = await client2.waitForMessage('bye');
      assert.strictEqual(bye.type, 'bye');

      // Test leave
      client1.send('leave', null);
      const leave = await client2.waitForMessage('leave');
      assert.strictEqual(leave.type, 'leave');

      await client1.close();
      await client2.close();
    });

    it('should not forward messages to sender', async () => {
      const client1 = await createTestWebSocketClient(baseUrl, 'no-echo-test');
      await client1.waitForMessage('welcome');

      // Send message
      client1.send('ready', null);

      // Wait a bit to ensure message is not echoed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only have welcome message
      const readyMessages = client1.messages.filter(m => m.type === 'ready');
      assert.strictEqual(readyMessages.length, 0, 'should not echo message to sender');

      await client1.close();
    });
  });

  describe('Disconnection handling', () => {
    it('should notify peer when other peer disconnects', async () => {
      const client1 = await createTestWebSocketClient(baseUrl, 'disconnect-test');
      const client2 = await createTestWebSocketClient(baseUrl, 'disconnect-test');

      await client1.waitForMessage('welcome');
      await client2.waitForMessage('welcome');

      // Client1 disconnects
      await client1.close();

      // Client2 should receive bye message
      const bye = await client2.waitForMessage('bye');
      assert.strictEqual(bye.type, 'bye');

      await client2.close();
    });

    it('should clean up empty rooms', async () => {
      const client1 = await createTestWebSocketClient(baseUrl, 'cleanup-test');
      await client1.waitForMessage('welcome');

      // Room should exist
      assert.ok(server.rooms.has('cleanup-test'));

      await client1.close();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Room should be deleted
      assert.strictEqual(server.rooms.has('cleanup-test'), false);
    });

    it('should allow new clients after room becomes empty', async () => {
      const client1 = await createTestWebSocketClient(baseUrl, 'reuse-room');
      await client1.waitForMessage('welcome');
      await client1.close();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // New client should be able to join and be initiator again
      const client2 = await createTestWebSocketClient(baseUrl, 'reuse-room');
      const welcome = await client2.waitForMessage('welcome');
      assert.strictEqual(welcome.initiator, true);

      await client2.close();
    });
  });

  describe('Multiple rooms isolation', () => {
    it('should not forward messages between different rooms', async () => {
      const room1_client1 = await createTestWebSocketClient(baseUrl, 'room1');
      const room1_client2 = await createTestWebSocketClient(baseUrl, 'room1');
      const room2_client = await createTestWebSocketClient(baseUrl, 'room2');

      await room1_client1.waitForMessage('welcome');
      await room1_client2.waitForMessage('welcome');
      await room2_client.waitForMessage('welcome');

      // Send message in room1
      room1_client1.send('offer', { data: 'room1-offer' });

      // room1_client2 should receive it
      const offer = await room1_client2.waitForMessage('offer');
      assert.deepStrictEqual(offer.payload, { data: 'room1-offer' });

      // room2_client should not receive it
      await new Promise(resolve => setTimeout(resolve, 100));
      const room2Offers = room2_client.messages.filter(m => m.type === 'offer');
      assert.strictEqual(room2Offers.length, 0);

      await room1_client1.close();
      await room1_client2.close();
      await room2_client.close();
    });
  });
});
