const WebSocket = require('ws');
const { safeDecrypt, safeEncrypt } = require('../utils/cryptoUtils');
const roomManager = require('../utils/roomManager');
const messageHandlers = require('../handlers');

// Shared across connections so handlers can map users -> sockets
const peers = new Map();

// ---- Tunables ---------------------------------------------------------------
const MAX_PAYLOAD           = 10 * 1024 * 1024; // 10MB per frame
const PING_INTERVAL_MS      = 30_000;           // heartbeat period
const WORK_CONCURRENCY      = 4;                // jobs in parallel per connection
const SEND_QUEUE_BYTE_CAP   = 512 * 1024;       // per-connection send queue cap
const SEND_FLUSH_BATCH      = 32;               // max messages per flush tick
// ----------------------------------------------------------------------------

// Minimal bounded async work queue (no deps)
function makeWorkQueue(concurrency = 4) {
  let active = 0;
  const q = [];
  const add = (fn) =>
    new Promise((resolve, reject) => {
      q.push({ fn, resolve, reject });
      pump();
    });

  async function pump() {
    while (active < concurrency && q.length) {
      const { fn, resolve, reject } = q.shift();
      active++;
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      } finally {
        active--;
        setImmediate(pump);
      }
    }
  }

  return {
    add,
    clear: () => q.splice(0, q.length),
  };
}

// Per-connection sender with encryption + backpressure
function makeSender(ws) {
  const queue = [];
  let queuedBytes = 0;
  let flushing = false;

  function enqueueEncrypted(encryptedPayload) {
    const size = Buffer.byteLength(encryptedPayload);
    if (queuedBytes + size > SEND_QUEUE_BYTE_CAP) {
      // Over cap: drop non-critical messages to recover
      return false;
    }
    queue.push(encryptedPayload);
    queuedBytes += size;
    if (!flushing) setImmediate(flush);
    return true;
  }

  function flush() {
    if (flushing) return;
    flushing = true;
    try {
      let n = 0;
      while (n < SEND_FLUSH_BATCH && queue.length && ws.readyState === WebSocket.OPEN) {
        // Let kernel buffer drain if we're far behind
        if (ws.bufferedAmount > SEND_QUEUE_BYTE_CAP) break;
        const msg = queue.shift();
        queuedBytes -= Buffer.byteLength(msg);
        ws.send(msg);
        n++;
      }
    } finally {
      flushing = false;
      if (queue.length && ws.readyState === WebSocket.OPEN) setImmediate(flush);
    }
  }

  return {
    // Handlers should call ws.safeSend(obj) which uses this under the hood
    sendObject(obj) {
      try {
        const encrypted = safeEncrypt(obj); // Buffer/string
        return enqueueEncrypted(encrypted);
      } catch {
        return false;
      }
    },
    clear() { queue.length = 0; queuedBytes = 0; },
  };
}

function startWebSocketServer(server) {
  const wss = new WebSocket.Server({
    server,
    perMessageDeflate: false,   // fewer CPU surprises across clients
    maxPayload: MAX_PAYLOAD,    // clean 1009 close on oversized frames
    clientTracking: true,
  });
console.log("Message is getting prepared");
  // Heartbeat (ping/pong)
  function heartbeat() { this.isAlive = true; }
  const pinger = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        try { ws.terminate(); } catch {}
        continue;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }, PING_INTERVAL_MS);

  wss.on('close', () => clearInterval(pinger));

  wss.on('connection', (ws) => {
    console.log("Connection");
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    try { ws._socket.setNoDelay(true); } catch {}

    // Per-connection resources
    const sender = makeSender(ws);
    const workQ  = makeWorkQueue(WORK_CONCURRENCY);

    // Backpressure-aware helper for handlers (encrypts + queues safely)
    ws.safeSend = (obj) => sender.sendObject(obj);

    ws.on('message', async (raw /*, isBinary */) => {
        console.log("Message received");
        console.log("ws.state=" + ws.readyState + " Socket Open:" + WebSocket.OPEN)
      if (ws.readyState !== WebSocket.OPEN) return;
  console.log("Message processing");
      // Decrypt + parse
      let decrypted, parsed;
      try {
        decrypted = safeDecrypt(raw);
      } catch {
        try { ws.close(1003, 'decrypt_error'); } catch {}
        return;
      }
      console.log("Decrypted");
      try {
        parsed = typeof decrypted === 'string'
          ? JSON.parse(decrypted)
          : JSON.parse(decrypted.toString());
      } catch {
        try { ws.close(1003, 'bad_json'); } catch {}
        return;
      }
  console.log("safecheck");
      const { type } = parsed || {};
      const handler = messageHandlers[type];
      if (!handler) {
        ws.safeSend({ type, error: 'Unsupported message type' });
        return;
      }

      // Enqueue job; DO NOT heavy-work inline
      workQ.add(async () => {
        try {
            console.log("await");
          // IMPORTANT: We pass peers so your handlers can do: peers.set(user.id, ws)
          // Handler is responsible for replying ONCE (e.g., via ws.safeSend(...) or ws.send(safeEncrypt(...)))
          await handler(ws, parsed, peers);
        } catch (err) {
            console.log("handle error");
          // If a handler throws, send a single generic error
          ws.safeSend({ type, error: 'handler_error' });
        }
        console.log("await completed");
      }).catch(() => {
        console.log("Queue error");
        ws.safeSend({ type, error: 'queue_error' });
      });
    });

    ws.on('close', (code, reason) => {
      // Cleanup resources tied to this socket
      try { roomManager.removeFromRoom(ws); } catch {}
      if (ws.user?.id) {
        try { peers.delete(ws.user.id); } catch {}
      }
      sender.clear();
      workQ.clear();
      console.log('Client disconnected', code, reason && reason.toString ? reason.toString() : '');
    });

    ws.on('error', (e) => {
      console.warn('WS error:', e?.message || e);
    });
  });

  console.log('WebSocket server running (heartbeat, payload limits, bounded work queue, backpressure helper)');
}

module.exports = { startWebSocketServer };