const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer so Render can find it
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};