// DFC Fleet Ops — server entry point.
// Serves static files, REST API, and WebSocket rooms.
//
// Usage:
//   node server.js            (production)
//   node --watch server.js    (dev — auto-restart on file changes)
//
// Then open: http://localhost:3000/client/index.html

import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { router as apiRouter, handleConnection } from './src/api.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

// REST API
app.use('/api', apiRouter);

// Serve everything from the repo root as static files so the browser can load:
//   /client/index.html        — module-based client
//   /src/engine/constants.js  — ES modules imported by the client
//   /web/index.html           — legacy monolith (unchanged)
app.use(express.static(__dirname));

// Redirect bare /client → /client/index.html
app.get('/client', (_req, res) => res.redirect('/client/index.html'));

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

// Upgrade HTTP → WebSocket only for /ws paths.
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws')) {
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

// Delegate connection handling to api.js.
wss.on('connection', handleConnection);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`DFC Fleet Ops server listening on http://localhost:${PORT}`);
  console.log(`  Module client : http://localhost:${PORT}/client/index.html`);
  console.log(`  Legacy client : http://localhost:${PORT}/web/index.html`);
  console.log(`  API           : http://localhost:${PORT}/api/rooms`);
});
