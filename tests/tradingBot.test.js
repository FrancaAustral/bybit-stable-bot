/* eslint-env mocha */
'use strict'

// Third party dependencies.)
const assert = require('assert')
const sinon = require('sinon')
const rewire = require('rewire')

// Local dependencies.
const tradingBotModule = rewire('../helpers/tradingBot')
const EventProcessor = tradingBotModule.__get__('EventProcessor')

const mockKeys = {
  apiKey1: 'apiKey1',
  apiSecret1: 'apiSecret1',
  apiKey2: 'apiKey2',
  apiSecret2: 'apiSecret2',
  apiKey3: 'apiKey3',
  apiSecret3: 'apiSecret3'
}

const mockParams = {
  currency: 'USDT',
  asset: 'USDC',
  pair: 'USDCUSDT',
  bollingerParams: {
    movingAverageTimeframe: '60',
    movingAverageLength: 18,
    movingAverageSource: 'close',
    minStdConsidered: 0.0002,
    openBollingerBand: 2,
    closeBollingerBand: 0
  },
  minSellPrice: 1,
  maxBuyPrice: 1.0002,
  leverage: 10
}

const TradingBot = tradingBotModule.__get__('TradingBot')
const bot = new TradingBot(mockKeys, mockParams)
bot.logger = () => {}

describe('Test on TradingBot class.', function () {
  it('Parent class shoud be TradingBot.', function () {
    assert(bot instanceof EventProcessor)
  })

  it('Should have all needed methods.', function () {
    // Data.
    const neededMethods = [
      'constructor', 'subscribeNecessaryChannels', 'startWSConnections',
      'startTrading'
    ]

    // Assertions.
    const protoMethods = Object.getOwnPropertyNames(
      tradingBotModule.TradingBot.prototype
    )
    for (const method of protoMethods) {
      assert(neededMethods.includes(method), `${method} not in neededMethods.`)
    }
    for (const method of neededMethods) {
      assert(protoMethods.includes(method), `${method} not in protoMethods.`)
    }
  })

  it('Method subscribeNecessaryChannels shouls subcribe public and private.',
    function () {
      // Data.
      const stubPubSubs = sinon.stub(bot.publicWS, 'subscribe')
      const stubPrivSubs = sinon.stub(bot.privateWS, 'subscribe')

      // Assertions.
      bot.subscribeNecessaryChannels()
      const [bookSubsArgs, candlesSubsArgs] = stubPubSubs.args
      assert.strictEqual(bookSubsArgs[0], 'orderbook.1.USDCUSDT')
      assert.strictEqual(bookSubsArgs[1].name, 'bound manageOrderbookMsg')
      assert.strictEqual(candlesSubsArgs[0], 'kline.60.USDCUSDT')
      assert.strictEqual(candlesSubsArgs[1].name, 'bound manageCandleMsg')

      const [walletSubsArgs, execSubsArgs, orderSubsArgs] = stubPrivSubs.args
      assert.strictEqual(walletSubsArgs[0], 'wallet')
      assert.strictEqual(walletSubsArgs[1].name, 'bound manageWalletMsg')
      assert.strictEqual(execSubsArgs[0], 'execution.spot')
      assert.strictEqual(execSubsArgs[1].name, 'bound logWSMessage')
      assert.strictEqual(orderSubsArgs[0], 'order.spot')
      assert.strictEqual(orderSubsArgs[1].name, 'bound manageOrderMsg')

      // Restores.
      stubPubSubs.restore()
      stubPrivSubs.restore()
    }
  )

  it('Method startWSConnections should open websockets and subscribe channels.',
    async function () {
      // Data.
      const stubPublic = sinon.stub(bot.publicWS, 'open').resolves()
      const stubPrivate = sinon.stub(bot.privateWS, 'open').resolves()
      const stubTrade = sinon.stub(bot.tradeWS, 'open').resolves()
      const stubSubscribe = sinon.stub(bot, 'subscribeNecessaryChannels')

      // Assertions.
      await bot.startWSConnections()
      assert(stubPublic.calledOnceWithExactly())
      assert(stubPrivate.calledOnceWithExactly())
      assert(stubTrade.calledOnceWithExactly())
      assert(stubSubscribe.calledOnceWithExactly())

      // Restores.
      stubPublic.restore()
      stubPrivate.restore()
      stubTrade.restore()
      stubSubscribe.restore()
    }
  )

  it('Method startTrading should init data, start ws & checkOrders',
    async function () {
      // Data.
      const stubInit = sinon.stub(bot, 'initTradingData')
      const stubStart = sinon.stub(bot, 'startWSConnections')
      const stubCheck = sinon.stub(bot, 'checkOrders')

      // Assertions.
      await bot.startTrading()
      assert(stubInit.calledOnceWithExactly())
      assert(stubStart.calledOnceWithExactly())
      assert(stubCheck.calledOnceWithExactly())

      // Restores.
      stubInit.restore()
      stubStart.restore()
      stubCheck.restore()
    }
  )
})
