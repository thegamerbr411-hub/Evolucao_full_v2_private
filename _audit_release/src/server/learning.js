const path = require('path');

// ponte para o motor real de aprendizado usado pelo dashboard API
module.exports = require(path.resolve(__dirname, '..', '..', 'dashboard', 'src', 'server', 'learning.js'));
