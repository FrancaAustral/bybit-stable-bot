/* eslint-env mocha */
'use strict'

// Third party dependencies.)
const assert = require('assert')
const sinon = require('sinon')
const rewire = require('rewire')

// Local dependencies.
const bollingerModule = rewire('../helpers/eventProcessor/bollinger')
bollingerModule.__set__('logger', () => {})

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

const bollinger = new bollingerModule.Bollinger(mockParams)

describe('Test on Bollinger class.', function () {
  it('Constructor should init all needed attribures.', function () {
    // Assertions.
    assert.deepStrictEqual(
      bollinger.bollingerParams,
      {
        movingAverageTimeframe: '60',
        movingAverageLength: 18,
        movingAverageSource: 'close',
        minStdConsidered: 0.0002,
        openBollingerBand: 2,
        closeBollingerBand: 0
      }
    )
    assert.strictEqual(bollinger.movAvgTf, '60')
    assert.strictEqual(bollinger.movAvgLength, 18)
    assert.strictEqual(bollinger.movAvgSource, 'close')
    assert.strictEqual(bollinger.minStdConsidered, 0.0002)
    assert.strictEqual(bollinger.openBand, 2)
    assert.strictEqual(bollinger.closeBand, 0)
    assert.strictEqual(bollinger.minSellPrice, 1)
    assert.strictEqual(bollinger.maxBuyPrice, 1.0002)
    assert.deepStrictEqual(bollinger.candlesUsed, [])
    assert.deepStrictEqual(
      bollinger.bollingerPrices,
      {
        openBuyPrice: null,
        openSellPrice: null,
        closeBuyPrice: null,
        closeSellPrice: null
      }
    )
  })

  it('Should have all needed methods.', function () {
    // Data.
    const neededMethods = [
      'constructor', 'initBollingerParams', 'getStandardDeviation',
      'getStandardValues', 'calcBollingerPrices', 'updateBollingerPrices',
      'getBollingerPrices'
    ]

    // Assertions.
    const protoMethods = Object.getOwnPropertyNames(
      bollingerModule.Bollinger.prototype
    )
    for (const method of protoMethods) {
      assert(neededMethods.includes(method), `${method} not in neededMethods.`)
    }
    for (const method of neededMethods) {
      assert(protoMethods.includes(method), `${method} not in protoMethods.`)
    }
  })

  it('Method getStandardDeviation should get std from candlePrices.',
    function () {
      const prices = [1, 2, 3, 4, 5, 6, 7]
      const prices2 = [4, 4, 4, 4, 4, 4, 4]
      const ma = 4
      const std = bollinger.getStandardDeviation(prices, ma)
      assert.strictEqual(std, 2)
      const std2 = bollinger.getStandardDeviation(prices2, ma)
      assert.strictEqual(std2, bollinger.minStdConsidered)
    })

  it('Method getStandardValues should get ma & std.', function () {
    // Data.
    const tests = [
      {
        candles: [
          { mts: 1, open: 10, close: 20, high: 20, low: 0, hl2: 10, volume: 1 },
          { mts: 1, open: 10, close: 20, high: 40, low: 0, hl2: 20, volume: 1 },
          { mts: 1, open: 10, close: 20, high: 60, low: 0, hl2: 30, volume: 1 }
        ],
        movAvgSource: 'hl2',
        expected: { ma: 20, std: 'std' }
      },
      {
        candles: [
          { mts: 2, open: 10.1, close: 2, high: 2, low: 0, hl2: 10, volume: 1 },
          { mts: 2, open: 10.3, close: 2, high: 4, low: 0, hl2: 20, volume: 1 },
          { mts: 2, open: 10.2, close: 2, high: 60, low: 0, hl2: 30, volume: 1 }
        ],
        movAvgSource: 'open',
        expected: { ma: 10.2, std: 'std' }
      },
      {
        candles: [
          { mts: 3, open: 10, close: 20, high: 40, low: 0, hl2: 20, volume: 1 }
        ],
        movAvgSource: 'close',
        expected: { ma: 20, std: 'std' }
      }
    ]

    // Assertions.
    for (const test of tests) {
      bollinger.candlesUsed = test.candles
      bollinger.movAvgSource = test.movAvgSource
      const stub = sinon.stub(bollinger, 'getStandardDeviation')
      stub.returns('std')
      const output = bollinger.getStandardValues()
      assert.deepStrictEqual(output, test.expected)

      // Restores.
      bollinger.candlesUsed = []
      bollinger.movAvgSource = mockParams.bollingerParams.movingAverageSource
      stub.restore()
    }
  })

  it('Method calcBollingerPrices should return bollinger prices.',
    function () {
      // Data.
      bollinger.minSellPrice = 1.0002
      bollinger.maxBuyPrice = 1
      bollinger.openBand = 2
      bollinger.closeBand = 0.5
      const tests = [
        {
          ma: 1,
          std: 0.0004,
          expected: {
            openBuyPrice: 0.9992,
            openSellPrice: 1.0008,
            closeBuyPrice: 0.9998,
            closeSellPrice: 1.0002
          }
        },
        {
          ma: 0.99939,
          std: 0.0004,
          expected: {
            openBuyPrice: 0.99859,
            openSellPrice: 1.0002, // Min sell price.
            closeBuyPrice: 0.99919,
            closeSellPrice: 0.99959
          }
        },
        {
          ma: 1.00081,
          std: 0.0004,
          expected: {
            openBuyPrice: 1, // Max buy price.
            openSellPrice: 1.00161,
            closeBuyPrice: 1.00061,
            closeSellPrice: 1.00101
          }
        }
      ]

      // Assertions.
      for (const test of tests) {
        const stub = sinon.stub(bollinger, 'getStandardValues')
        stub.returns({ ma: test.ma, std: test.std })

        const candles = [{ start: 1 }, { start: 2 }] // Used in logger.
        const output = bollinger.calcBollingerPrices(candles)
        assert.deepStrictEqual(output, test.expected)
        assert.deepStrictEqual(bollinger.candlesUsed, candles)

        // Restores.
        stub.restore()
        bollinger.candlesUsed = []
      }
      bollinger.minSellPrice = mockParams.minSellPrice
      bollinger.maxBuyPrice = mockParams.maxBuyPrice
      bollinger.closeBand = mockParams.bollingerParams.closeBollingerBand
      bollinger.open = mockParams.bollingerParams.openBollingerBand
    }
  )

  it('Method updateBollingerPrices shouls update if new candle.', function () {
    // Data.
    const tests = [
      {
        candles: [{ start: 1 }, { start: 2 }],
        candlesUsed: [],
        calcCall: true,
        expected: 'NewBollingerPrices'
      },
      {
        candles: [{ start: 2 }, { start: 3 }],
        candlesUsed: [{ start: 1 }, { start: 2 }],
        calcCall: true,
        expected: 'NewBollingerPrices'
      },
      {
        candles: [{ start: 1 }, { start: 2 }],
        candlesUsed: [{ start: 1 }, { start: 2 }],
        calcCall: false,
        expected: 'BollingerPrices'
      }
    ]

    // Assertions.
    for (const test of tests) {
      bollinger.candlesUsed = test.candlesUsed
      bollinger.bollingerPrices = 'BollingerPrices'
      const stub = sinon.stub(bollinger, 'calcBollingerPrices')
      stub.returns('NewBollingerPrices')

      bollinger.updateBollingerPrices(test.candles)
      assert.strictEqual(bollinger.bollingerPrices, test.expected)
      assert.strictEqual(
        stub.calledOnceWithExactly(test.candles),
        test.calcCall
      )

      // Restores.
      stub.restore()
      bollinger.candlesUsed = []
      bollinger.bollingerPrices = null
    }
  })

  it('Method getBollingerPrices should return stored prices.', function () {
    bollinger.bollingerPrices = 'BollingerPrices'
    const output = bollinger.getBollingerPrices()
    assert.strictEqual(output, 'BollingerPrices')
  })
})
