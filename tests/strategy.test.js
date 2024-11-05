/* eslint-env mocha */
'use strict'

// Third party dependencies.)
const assert = require('assert')
const sinon = require('sinon')
const rewire = require('rewire')

// Local dependencies.
const strategyModule = rewire('../helpers/eventProcessor/strategy')

class MockBollinger {
  updateBollingerPrices () {}
  getBollingerPrices () {}
}
strategyModule.__set__('Bollinger', MockBollinger)

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

const strategy = new strategyModule.Strategy(mockParams)

describe('Test on Strategy class.', function () {
  it('Constructor should init all needed attribures.', function () {
    // Assertions.
    assert.strictEqual(strategy.currency, 'USDT')
    assert.strictEqual(strategy.asset, 'USDC')
    assert.strictEqual(strategy.pair, 'USDCUSDT')
    assert.deepStrictEqual(
      strategy.bollingerParams,
      {
        movingAverageTimeframe: '60',
        movingAverageLength: 18,
        movingAverageSource: 'close',
        minStdConsidered: 0.0002,
        openBollingerBand: 2,
        closeBollingerBand: 0
      }
    )
    assert.strictEqual(strategy.minSellPrice, 1)
    assert.strictEqual(strategy.maxBuyPrice, 1.0002)
    assert.strictEqual(strategy.leverage, 10)
    assert.strictEqual(strategy.tradingInfo, null)
    assert.deepStrictEqual(strategy.maxTradesInfo, { buy: {}, sell: {} })
    assert(strategy.bollinger instanceof MockBollinger)
  })

  it('Should have all needed methods.', function () {
    // Data.
    const neededMethods = [
      'constructor', 'initStrategyParams', 'setAttributesValue',
      'getCloseSellOrderInfo', 'getCloseBuyOrderInfo', 'getCloseOrderInfo',
      'calcCurrencyAvailable', 'getOpenBuyOrderInfo', 'getOpenSellOrderInfo',
      'getOpenOrderInfo', 'getOrderNeededInfo'
    ]

    // Assertions.
    const protoMethods = Object.getOwnPropertyNames(
      strategyModule.Strategy.prototype
    )
    for (const method of protoMethods) {
      assert(neededMethods.includes(method), `${method} not in neededMethods.`)
    }
    for (const method of neededMethods) {
      assert(protoMethods.includes(method), `${method} not in protoMethods.`)
    }
  })

  it('Method setAttributesValue should set attribute value.', function () {
    strategy.tradingInfo = null
    const tradingInfo = {
      symbol: 'USDCUSDT',
      baseCoin: 'USDC',
      quoteCoin: 'USDT',
      innovation: '0',
      status: 'Trading',
      marginTrading: 'both',
      lotSizeFilter: {
        basePrecision: '0.01',
        quotePrecision: '0.000001',
        minOrderQty: '1',
        maxOrderQty: '2496045.89',
        minOrderAmt: '1',
        maxOrderAmt: '2000000'
      },
      priceFilter: { tickSize: '0.0001' },
      riskParameters: { limitParameter: '0.01', marketParameter: '0.01' }
    }
    strategy.setAttributesValue({ tradingInfo })
    assert.deepStrictEqual(strategy.tradingInfo, tradingInfo)
    strategy.tradingInfo = null
  })

  it('Method getCloseSellOrderInfo should get close order info.', function () {
    // Data.
    strategy.tradingInfo = {
      lotSizeFilter: { basePrecision: '0.01' },
      priceFilter: { tickSize: '0.0001' }
    }
    const tests = [
      {
        assetBalance: 100,
        closeSellPrice: 1.0001,
        expected: {
          type: 'closeSellOrder',
          side: 'Sell',
          amount: 100,
          price: 1.0001
        }
      },
      {
        assetBalance: 100.1111111,
        closeSellPrice: 1.00001,
        expected: {
          type: 'closeSellOrder',
          side: 'Sell',
          amount: 100.11,
          price: 1.0001
        }
      }
    ]

    // Assertions.
    for (const test of tests) {
      const stub = sinon.stub(strategy.bollinger, 'getBollingerPrices')
      stub.returns({ closeSellPrice: test.closeSellPrice })

      const output = strategy.getCloseSellOrderInfo(test.assetBalance)
      assert.deepStrictEqual(output, test.expected)

      // Restores.
      stub.restore()
    }
    strategy.tradingInfo = null
  })

  it('Method getCloseBuyOrderInfo should get close order info.', function () {
    // Data.
    strategy.tradingInfo = {
      lotSizeFilter: { basePrecision: '0.01' },
      priceFilter: { tickSize: '0.0001' }
    }
    const tests = [
      {
        assetBalance: -100,
        closeBuyPrice: 1.0001,
        expected: {
          type: 'closeBuyOrder',
          side: 'Buy',
          amount: 100,
          price: 1.0001
        }
      },
      {
        assetBalance: -100.1111111,
        closeBuyPrice: 1.00001,
        expected: {
          type: 'closeBuyOrder',
          side: 'Buy',
          amount: 100.11,
          price: 1
        }
      }
    ]

    // Assertions.
    for (const test of tests) {
      const stub = sinon.stub(strategy.bollinger, 'getBollingerPrices')
      stub.returns({ closeBuyPrice: test.closeBuyPrice })

      const output = strategy.getCloseBuyOrderInfo(test.assetBalance)
      assert.deepStrictEqual(output, test.expected)

      // Restores.
      stub.restore()
    }
    strategy.tradingInfo = null
  })

  it('Method getCloseOrderInfo should get buy | sell info.', function () {
    // Data.
    strategy.asset = 'USDC'
    const tests = [
      {
        wallet: {
          coinsToWallet: {
            USDC: { walletBalance: '0.0014', borrowAmount: '0' },
            USDT: { walletBalance: '0', borrowAmount: '0' }
          }
        },
        sellCall: false,
        buyCall: false,
        expected: null
      },
      {
        wallet: {
          coinsToWallet: {
            USDC: { walletBalance: '10', borrowAmount: '0' },
            USDT: { walletBalance: '0', borrowAmount: '8' }
          }
        },
        sellCall: true,
        buyCall: false,
        expected: 'SellOrderInfo'
      },
      {
        wallet: {
          coinsToWallet: {
            USDC: { walletBalance: '-10', borrowAmount: '10' },
            USDT: { walletBalance: '0', borrowAmount: '0' }
          }
        },
        sellCall: false,
        buyCall: true,
        expected: 'BuyOrderInfo'
      }
    ]

    // Assertions.
    for (const test of tests) {
      const stubSell = sinon.stub(strategy, 'getCloseSellOrderInfo')
      stubSell.returns('SellOrderInfo')
      const stubBuy = sinon.stub(strategy, 'getCloseBuyOrderInfo')
      stubBuy.returns('BuyOrderInfo')

      const output = strategy.getCloseOrderInfo(test.wallet)
      assert.strictEqual(output, test.expected)
      assert.strictEqual(
        stubSell.calledOnceWithExactly(
          +test.wallet.coinsToWallet.USDC.walletBalance
        ),
        test.sellCall
      )
      assert.strictEqual(
        stubBuy.calledOnceWithExactly(
          +test.wallet.coinsToWallet.USDC.walletBalance
        ),
        test.buyCall
      )

      // Restores.
      stubSell.restore()
      stubBuy.restore()
    }
    strategy.asset = mockParams.asset
  })

  it('Method calcCurrencyAvailable should return max available in wallet.',
    function () {
      // Data.
      strategy.asset = 'USDC'
      strategy.leverage = 10
      const tests = [
        {
          wallet: {
            coinsToWallet: { USDC: { usdValue: '-100' } },
            totalEquity: '19'
          },
          expected: 9
        },
        {
          wallet: {
            coinsToWallet: { USDC: { usdValue: '-1010' } },
            totalEquity: '100'
          },
          expected: 0
        }
      ]

      // Assertions.
      for (const test of tests) {
        const output = strategy.calcCurrencyAvailable(test.wallet)
        assert.strictEqual(output, test.expected)
      }

      // Restores.
      strategy.asset = mockParams.asset
      strategy.leverage = mockParams.leverage
    }
  )

  it('Method getOpenBuyOrderInfo should get open order info.', function () {
    // Data.
    strategy.leverage = 10
    strategy.tradingInfo = {
      lotSizeFilter: { minOrderQty: '1', basePrecision: '0.01' }
    }

    const tests = [
      {
        currencyAvailable: 10.1,
        orderbook: { ask: { askPrice: 1.01, askAmount: 10000 } },
        openBuyPrice: 1,
        expected: false
      },
      {
        currencyAvailable: 0.099,
        orderbook: { ask: { askPrice: 1, askAmount: 1000 } },
        openBuyPrice: 1,
        expected: false
      },
      {
        currencyAvailable: 10.1,
        orderbook: { ask: { askPrice: 1, askAmount: 1 } },
        openBuyPrice: 1,
        expected: false
      },
      {
        currencyAvailable: 10.1,
        orderbook: { ask: { askPrice: 1, askAmount: 4.44444 } },
        openBuyPrice: 1,
        expected: { type: 'openBuyOrder', side: 'Buy', amount: 3.33 }
      },
      {
        currencyAvailable: 1.01,
        orderbook: { ask: { askPrice: 1, askAmount: 100000 } },
        openBuyPrice: 1.01,
        expected: { type: 'openBuyOrder', side: 'Buy', amount: 10.1 }
      }
    ]

    // Assertions.
    for (const test of tests) {
      const stub = sinon.stub(strategy.bollinger, 'getBollingerPrices')
      stub.returns({ openBuyPrice: test.openBuyPrice })
      const output = strategy.getOpenBuyOrderInfo(
        test.currencyAvailable,
        test.orderbook
      )
      assert.deepStrictEqual(output, test.expected)

      // Restores.
      stub.restore()
    }
    strategy.leverage = mockParams.leverage
  })

  it('Method getOpenSellOrderInfo should get open order info.', function () {
    // Data.
    strategy.leverage = 10
    strategy.tradingInfo = {
      lotSizeFilter: { minOrderQty: '1', basePrecision: '0.01' }
    }

    const tests = [
      {
        currencyAvailable: 10.1,
        orderbook: { bid: { bidPrice: 0.99, bidAmount: 10000 } },
        openSellPrice: 1,
        expected: false
      },
      {
        currencyAvailable: 0.099,
        orderbook: { bid: { bidPrice: 1, bidAmount: 1000 } },
        openSellPrice: 1,
        expected: false
      },
      {
        currencyAvailable: 10.1,
        orderbook: { bid: { bidPrice: 1, bidAmount: 1 } },
        openSellPrice: 1,
        expected: false
      },
      {
        currencyAvailable: 10.1,
        orderbook: { bid: { bidPrice: 1, bidAmount: 4.44444 } },
        openSellPrice: 1,
        expected: { type: 'openSellOrder', side: 'Sell', amount: 3.33 }
      },
      {
        currencyAvailable: 1.01,
        orderbook: { bid: { bidPrice: 1, bidAmount: 100000 } },
        openSellPrice: 0.99,
        expected: { type: 'openSellOrder', side: 'Sell', amount: 10.1 }
      }
    ]

    // Assertions.
    for (const test of tests) {
      const stub = sinon.stub(strategy.bollinger, 'getBollingerPrices')
      stub.returns({ openSellPrice: test.openSellPrice })
      const output = strategy.getOpenSellOrderInfo(
        test.currencyAvailable,
        test.orderbook
      )
      assert.deepStrictEqual(output, test.expected)

      // Restores.
      stub.restore()
    }
    strategy.leverage = mockParams.leverage
  })

  it('Method getOpenOrderInfo should get buy | sell info.', function () {
    // Data.
    const tests = [
      {
        buyCall: true,
        buyReturn: false,
        sellCall: true,
        sellReturn: false,
        expected: false
      },
      {
        buyCall: true,
        buyReturn: 'BuyOrderData',
        sellCall: false,
        sellReturn: false,
        expected: 'BuyOrderData'
      },
      {
        buyCall: true, // This should never happen.
        buyReturn: 'BuyOrderData',
        sellCall: false,
        sellReturn: 'SellOrderData',
        expected: 'BuyOrderData'
      },
      {
        buyCall: true,
        buyReturn: false,
        sellCall: true,
        sellReturn: 'SellOrderData',
        expected: 'SellOrderData'
      }
    ]

    // Assertions.
    for (const test of tests) {
      const stubCalc = sinon.stub(strategy, 'calcCurrencyAvailable')
      stubCalc.returns('currencyAvailable')
      const stubBuy = sinon.stub(strategy, 'getOpenBuyOrderInfo')
      stubBuy.returns(test.buyReturn)
      const stubSell = sinon.stub(strategy, 'getOpenSellOrderInfo')
      stubSell.returns(test.sellReturn)

      const output = strategy.getOpenOrderInfo('wallet', 'orderbook')
      assert.strictEqual(output, test.expected)
      assert(stubCalc.calledOnceWithExactly('wallet'))
      assert.strictEqual(
        stubSell.calledOnceWithExactly('currencyAvailable', 'orderbook'),
        test.sellCall
      )
      assert.strictEqual(
        stubBuy.calledOnceWithExactly('currencyAvailable', 'orderbook'),
        test.buyCall
      )

      // Restores.
      stubCalc.restore()
      stubSell.restore()
      stubBuy.restore()
    }
    strategy.asset = mockParams.asset
  })

  it('Method getOrderNeededInfo should get open and close order data.',
    function () {
      // Data.
      const stubUpdate = sinon.stub(strategy.bollinger, 'updateBollingerPrices')
      const stubOpen = sinon.stub(strategy, 'getOpenOrderInfo')
      stubOpen.returns('OpenOrderInfo')
      const stubClose = sinon.stub(strategy, 'getCloseOrderInfo')
      stubClose.returns('CloseOrderInfo')

      // Assertions.
      const output = strategy.getOrderNeededInfo(
        'wallet',
        'orderbook',
        'candles'
      )
      const expected = {
        openOrderInfo: 'OpenOrderInfo',
        closeOrderInfo: 'CloseOrderInfo'
      }

      assert.deepStrictEqual(output, expected)
      assert(stubUpdate.calledOnceWithExactly('candles'))
      assert(stubOpen.calledOnceWithExactly('wallet', 'orderbook'))
      assert(stubClose.calledOnceWithExactly('wallet'))

      // Restores.
      stubUpdate.restore()
      stubOpen.restore()
      stubClose.restore()
    }
  )
})
