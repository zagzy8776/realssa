const http = require('http');

// Simple test to check if the server can be started
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Test server running' }));
});

server.listen(5000, '0.0.0.0', () => {
  console.log('Test server running on port 5000');
});