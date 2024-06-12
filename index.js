'use strict'

// Local dependencies.
const { TradingBot } = require('./helpers/tradingBot.js')
const { version } = require('./package.json')
const { logger } = require('./helpers/logger')

function getConfigurationParams () {
  const keys = require('./config/bybit-api.json')
  const inputParams = require('./config/input-parameters.json')
  return [keys, inputParams]
}

async function main () {
  try {
    const inputParams = getConfigurationParams()
    logger(
      'log',
      true,
      `Version: ${version}`, '\n-inputParams:', inputParams[1]
    )
    const tradingBot = new TradingBot(...inputParams)
    await tradingBot.startTrading()

    // Send ready when created as child process. For process manager usage.
    if (typeof process.send === 'function') process.send('ready')
  } catch (e) {
    logger('error', true, 'Main error:', e.message || e.msg, e.stack)
    setTimeout(() => process.exit(1), 5000)
  }
}

if (require.main === module) main() // Don't call main when rewired in tests.
