/* eslint-env mocha */
'use strict'

// Third party dependencies.)
const assert = require('assert')
const sinon = require('sinon')
const rewire = require('rewire')

// Local dependencies.
const processorModule = rewire('../helpers/eventProcessor/eventProcessor')
const XchgConnect = processorModule.__get__('XchgConnect')

class MockStrategy {
  setTradingInfo () {}
  getOrderNeededInfo () {}
}
processorModule.__set__('Strategy', MockStrategy)

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

const EventProcessor = processorModule.__get__('EventProcessor')
const processor = new EventProcessor(mockKeys, mockParams)
processor.logger = () => {}

describe('Test on EventProcessor class.', function () {
  it('Parent class shoud be XchgConnect.', function () {
    assert(processor instanceof XchgConnect)
  })

  it('Constructor should init all needed attribures.', function () {
    // Assertions.
    assert(processor.strategy instanceof MockStrategy)
    assert.strictEqual(processor.tradeTimeout, null)
    assert.strictEqual(processor.intervalCount, 0)
  })

  it('Should have all needed methods.', function () {
    // Data.
    const neededMethods = [
      'constructor', 'initTradingData', 'resetCheckTimeout', 'createOpenOrder',
      'getUpdateQty', 'verifyCloseOrder', 'checkOrders'
    ]

    // Assertions.
    const protoMethods = Object.getOwnPropertyNames(
      processorModule.EventProcessor.prototype
    )
    for (const method of protoMethods) {
      assert(neededMethods.includes(method), `${method} not in neededMethods.`)
    }
    for (const method of neededMethods) {
      assert(protoMethods.includes(method), `${method} not in protoMethods.`)
    }
  })

  it('Method initTradingData should update trading data.', async function () {
    // Data.
    const stubWallets = sinon.stub(processor, 'updateWallets')
    const stubCandles = sinon.stub(processor, 'updateCandles')
    const stubOrderbook = sinon.stub(processor, 'updateOrderbook')
    const stubOrder = sinon.stub(processor, 'updateLimitOrders')
    const stubInfo = sinon.stub(processor, 'updatePairTradingInfo')
    const stubSet = sinon.stub(processor.strategy, 'setTradingInfo')

    stubInfo.returns('TradingInfo')

    // Assertions.
    await processor.initTradingData()
    assert(stubWallets.calledOnceWithExactly())
    assert(stubCandles.calledOnceWithExactly())
    assert(stubOrderbook.calledOnceWithExactly())
    assert(stubOrder.calledOnceWithExactly())
    assert(stubInfo.calledOnceWithExactly())
    assert(stubSet.calledOnceWithExactly('TradingInfo'))

    // Restores.
    stubWallets.restore()
    stubCandles.restore()
    stubOrderbook.restore()
    stubOrder.restore()
    stubInfo.restore()
    stubSet.restore()
  })

  it('Method createOpenOrder should submit market order.', function () {
    const stub = sinon.stub(processor, 'submitMarketOrder')
    processor.createOpenOrder('OpenOrderInfo', 'Orderbook') // Ob for logger.
    assert(stub.calledOnceWithExactly('OpenOrderInfo'))
    stub.restore()
  })

  it('Method getUpdateQty should get order qty', function () {
    // Data.
    processor.tradingInfo = {
      lotSizeFilter: { basePrecision: '0.01' },
      priceFilter: { tickSize: '0.0001' }
    }
    const tests = [
      {
        amount: 100,
        order: { cumExecQty: '30' },
        expected: 130
      },
      {
        amount: 100,
        order: { cumExecQty: '10.1111111' },
        expected: 110.11
      }
    ]

    // Assertions.
    for (const test of tests) {
      const output = processor.getUpdateQty(test.amount, test.order)
      assert.deepStrictEqual(output, test.expected)
    }
    processor.tradingInfo = null
  })

  it('Method verifyCloseOrder should repay, create, cancel or update order.',
    function () {
      // Data.
      processor.tradingInfo = { lotSizeFilter: { minOrderQty: '2' } }

      const tests = [
        {
          closeOrderInfo: { side: 'Sell', amount: 1.99, price: 1 },
          closeOrder: null,
          repayCalled: true,
          submitCalled: false,
          cancelCalled: false,
          updateArgs: {},
          updateCalled: false,
          expected: 'Repayed'
        },
        {
          closeOrderInfo: { side: 'Sell', amount: 2, price: 1 },
          closeOrder: null,
          repayCalled: false,
          submitCalled: true,
          cancelCalled: false,
          updateArgs: {},
          updateCalled: false,
          expected: 'Submited'
        },
        {
          closeOrderInfo: { side: 'Sell', amount: 2, price: 1 },
          closeOrder: { side: 'Buy', qty: 2, leavesQty: 2, price: 1 },
          repayCalled: false,
          submitCalled: false,
          cancelCalled: true,
          updateArgs: {},
          updateCalled: false,
          expected: 'Canceled'
        },
        {
          closeOrderInfo: { side: 'Sell', amount: 2.1, price: 1 },
          closeOrder: { side: 'Sell', qty: 2, leavesQty: 2, price: 1 },
          repayCalled: false,
          submitCalled: false,
          cancelCalled: false,
          updateArgs: { qty: '2.1' },
          updateCalled: true,
          expected: 'Updated'
        },
        {
          closeOrderInfo: { side: 'Sell', amount: 2, price: 1.0001 },
          closeOrder: { side: 'Sell', qty: 2, leavesQty: 2, price: 1 },
          repayCalled: false,
          submitCalled: false,
          cancelCalled: false,
          updateArgs: { price: '1.0001' },
          updateCalled: true,
          expected: 'Updated'
        },
        {
          closeOrderInfo: { side: 'Sell', amount: 2.1, price: 1.0001 },
          closeOrder: { side: 'Sell', qty: 2, leavesQty: 2, price: 1 },
          repayCalled: false,
          submitCalled: false,
          cancelCalled: false,
          updateArgs: { qty: '2.1', price: '1.0001' },
          updateCalled: true,
          expected: 'Updated'
        },
        {
          closeOrderInfo: { side: 'Sell', amount: 2, price: 1 },
          closeOrder: { side: 'Sell', qty: 2, leavesQty: 2, price: 1 },
          repayCalled: false,
          submitCalled: false,
          cancelCalled: false,
          updateArgs: {},
          updateCalled: false,
          expected: undefined
        }
      ]

      // Assertions.
      for (const test of tests) {
        processor.closeOrder = test.closeOrder

        const stubRepay = sinon.stub(processor, 'repayLiability')
        const stubSubmit = sinon.stub(processor, 'submitLimitOrder')
        const stubCancel = sinon.stub(processor, 'cancelLimitOrder')
        const stubGetQty = sinon.stub(processor, 'getUpdateQty')
        const stubUpdate = sinon.stub(processor, 'updateLimitOrder')
        stubRepay.returns('Repayed')
        stubSubmit.returns('Submited')
        stubCancel.returns('Canceled')
        stubGetQty.returns(test.closeOrderInfo.amount)
        stubUpdate.returns('Updated')

        const output = processor.verifyCloseOrder(
          test.closeOrderInfo,
          'Orderbook'
        )

        assert.strictEqual(output, test.expected)
        assert.strictEqual(stubRepay.calledOnceWithExactly(), test.repayCalled)
        assert.strictEqual(
          stubSubmit.calledOnceWithExactly(test.closeOrderInfo),
          test.submitCalled)
        assert.strictEqual(
          stubCancel.calledOnceWithExactly(test.closeOrder),
          test.cancelCalled
        )
        assert.strictEqual(
          stubUpdate.calledOnceWithExactly(test.closeOrder, test.updateArgs),
          test.updateCalled
        )

        // Restores.
        stubRepay.restore()
        stubSubmit.restore()
        stubCancel.restore()
        stubGetQty.restore()
        stubUpdate.restore()
      }

      processor.tradingInfo = null
      processor.closeOrder = null
    })

  it('Method checkOrders should get orders needed info and execute.',
    function () {
      // Data.
      const tests = [
        {
          ordersInfo: {
            openOrderInfo: null,
            closeOrderInfo: null
          },
          createCall: false,
          verifyCall: false
        },
        {
          ordersInfo: {
            openOrderInfo: 'OpenOrderInfo',
            closeOrderInfo: null
          },
          createCall: true,
          verifyCall: false
        },
        {
          ordersInfo: {
            openOrderInfo: 'OpenOrderInfo',
            closeOrderInfo: 'CloseOrderInfo'
          },
          createCall: true,
          verifyCall: false
        },
        {
          ordersInfo: {
            openOrderInfo: null,
            closeOrderInfo: 'CloseOrderInfo'
          },
          createCall: false,
          verifyCall: true
        }
      ]

      // Assertions.
      for (const test of tests) {
        const stubOrderbook = sinon.stub(processor, 'getLastOrderbook')
        const stubCandles = sinon.stub(processor, 'getLastCandles')
        const stubWallet = sinon.stub(processor, 'getLastWallet')
        const stubInfo = sinon.stub(processor.strategy, 'getOrderNeededInfo')
        const stubCreate = sinon.stub(processor, 'createOpenOrder')
        const stubVerify = sinon.stub(processor, 'verifyCloseOrder')
        const stubReset = sinon.stub(processor, 'resetCheckTimeout')

        stubOrderbook.returns('Orderbook')
        stubCandles.returns('Candles')
        stubWallet.returns('Wallet')
        stubInfo.returns(test.ordersInfo)

        processor.checkOrders()
        assert(stubOrderbook.calledOnceWithExactly())
        assert(stubCandles.calledOnceWithExactly())
        assert(stubWallet.calledOnceWithExactly())
        assert(
          stubInfo.calledOnceWithExactly('Wallet', 'Orderbook', 'Candles')
        )
        assert.strictEqual(
          stubCreate.calledOnceWithExactly('OpenOrderInfo', 'Orderbook'),
          test.createCall
        )
        assert.strictEqual(
          stubVerify.calledOnceWithExactly('CloseOrderInfo', 'Orderbook'),
          test.verifyCall
        )
        assert(stubReset.calledOnceWithExactly())

        // Restores.
        stubOrderbook.restore()
        stubCandles.restore()
        stubWallet.restore()
        stubInfo.restore()
        stubCreate.restore()
        stubVerify.restore()
        stubReset.restore()
      }
    }
  )
})
