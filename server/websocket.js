/**
 * Standalone WebSocket Server for Real-Time Updates
 * Handles live auction bidding, tiebreaker updates, and dashboard notifications
 */

const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ 
  server,
  path: '/api/ws'
});

// Store active connections by channel
const channels = new Map();
// Store client metadata
const clients = new Map();

console.log('🚀 WebSocket Server Starting...\n');

wss.on('connection', (ws, req) => {
  const clientId = Math.random().toString(36).substring(7);
  const clientIp = req.socket.remoteAddress;
  
  console.log(`✅ Client connected: ${clientId} from ${clientIp}`);
  console.log(`📊 Total connections: ${wss.clients.size}`);
  
  // Initialize client metadata
  clients.set(ws, {
    id: clientId,
    ip: clientIp,
    subscriptions: new Set(),
    connectedAt: new Date(),
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    data: { clientId, timestamp: Date.now() },
  }));
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, message);
    } catch (error) {
      console.error(`❌ Error parsing message from ${clientId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Invalid message format' },
      }));
    }
  });
  
  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      // Clean up subscriptions
      client.subscriptions.forEach(channel => {
        if (channels.has(channel)) {
          channels.get(channel).delete(ws);
          if (channels.get(channel).size === 0) {
            channels.delete(channel);
          }
        }
      });
      clients.delete(ws);
      console.log(`👋 Client disconnected: ${clientId}`);
      console.log(`📊 Total connections: ${wss.clients.size}`);
    }
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for ${clientId}:`, error.message);
  });
});

function handleMessage(ws, message) {
  const client = clients.get(ws);
  
  switch (message.type) {
    case 'subscribe':
      subscribe(ws, message.channel);
      console.log(`📥 ${client.id} subscribed to: ${message.channel}`);
      break;
      
    case 'unsubscribe':
      unsubscribe(ws, message.channel);
      console.log(`📤 ${client.id} unsubscribed from: ${message.channel}`);
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ 
        type: 'pong', 
        timestamp: Date.now() 
      }));
      break;
      
    default:
      console.warn(`⚠️ Unknown message type: ${message.type}`);
  }
}

function subscribe(ws, channel) {
  const client = clients.get(ws);
  if (!client) return;
  
  // Add to channel
  if (!channels.has(channel)) {
    channels.set(channel, new Set());
  }
  channels.get(channel).add(ws);
  
  // Track in client metadata
  client.subscriptions.add(channel);
  
  // Send confirmation
  ws.send(JSON.stringify({
    type: 'subscribed',
    data: { channel, timestamp: Date.now() },
  }));
}

function unsubscribe(ws, channel) {
  const client = clients.get(ws);
  if (!client) return;
  
  // Remove from channel
  if (channels.has(channel)) {
    channels.get(channel).delete(ws);
    if (channels.get(channel).size === 0) {
      channels.delete(channel);
    }
  }
  
  // Remove from client metadata
  client.subscriptions.delete(channel);
  
  // Send confirmation
  ws.send(JSON.stringify({
    type: 'unsubscribed',
    data: { channel, timestamp: Date.now() },
  }));
}

/**
 * Broadcast message to all clients in a channel
 * Called from API routes when events occur
 */
function broadcast(channel, data) {
  if (!channels.has(channel)) {
    console.log(`📢 No subscribers for channel: ${channel}`);
    return;
  }
  
  const message = JSON.stringify({
    ...data,
    timestamp: data.timestamp || Date.now(),
  });
  
  const subscribers = channels.get(channel);
  let successCount = 0;
  
  subscribers.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
        successCount++;
      } catch (error) {
        console.error('❌ Failed to send to client:', error.message);
      }
    }
  });
  
  console.log(`📢 Broadcast to ${channel}: ${successCount}/${subscribers.size} clients`);
}

/**
 * Get current server statistics
 */
function getStats() {
  return {
    totalConnections: wss.clients.size,
    channels: Array.from(channels.keys()).map(channel => ({
      name: channel,
      subscribers: channels.get(channel).size,
    })),
  };
}

// Expose broadcast function globally for API routes
global.wsBroadcast = broadcast;
global.wsStats = getStats;

// Health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      ...getStats(),
      uptime: process.uptime(),
    }));
  } else {
    res.writeHead(404);
    res.end('WebSocket server - use ws:// protocol');
  }
});

// Cleanup on shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, closing WebSocket server...');
  wss.clients.forEach(client => {
    client.close(1000, 'Server shutting down');
  });
  server.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, closing WebSocket server...');
  wss.clients.forEach(client => {
    client.close(1000, 'Server shutting down');
  });
  server.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.WS_PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ WebSocket server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/api/ws`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health\n`);
});

// Log stats every 30 seconds
setInterval(() => {
  const stats = getStats();
  if (stats.totalConnections > 0) {
    console.log(`\n📊 Current Stats:`);
    console.log(`   Connections: ${stats.totalConnections}`);
    console.log(`   Active Channels: ${stats.channels.length}`);
    stats.channels.forEach(ch => {
      console.log(`   - ${ch.name}: ${ch.subscribers} subscribers`);
    });
    console.log('');
  }
}, 30000);
