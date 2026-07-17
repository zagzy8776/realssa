const app = require('../backend/server.js');

module.exports = function handler(req, res) {
  return app(req, res);
};
