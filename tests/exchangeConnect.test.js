/* eslint-env mocha */
'use strict'

// Third party dependencies.)
const assert = require('assert')
const sinon = require('sinon')
const rewire = require('rewire')

// Local dependencies.
const connectModule = rewire(
  '../helpers/eventProcessor/exchangeConnect/exchangeConnect'
)
const BybitRestV5 = connectModule.__get__('BybitRestV5')
const BybitWSV5 = connectModule.__get__('BybitWSV5')

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

const connect = new connectModule.XchgConnect(mockKeys, mockParams)
connect.logger = () => {}

describe('Test on XchgConnect class.', function () {
  it('Constructor should init all needed attribures.', function () {
    // Assertions.
    assert.strictEqual(connect.currency, 'USDT')
    assert.strictEqual(connect.asset, 'USDC')
    assert.strictEqual(connect.pair, 'USDCUSDT')
    assert.deepStrictEqual(
      connect.bollingerParams,
      {
        movingAverageTimeframe: '60',
        movingAverageLength: 18,
        movingAverageSource: 'close',
        minStdConsidered: 0.0002,
        openBollingerBand: 2,
        closeBollingerBand: 0
      }
    )
    assert.strictEqual(connect.minSellPrice, 1)
    assert.strictEqual(connect.maxBuyPrice, 1.0002)
    assert.strictEqual(connect.leverage, 10)
    assert.deepStrictEqual(connect.tradingInfo, {})
    assert.deepStrictEqual(connect.walletCoins, ['USDT', 'USDC'])

    assert(connect.rest instanceof BybitRestV5)
    assert.strictEqual(connect.rest.apiKey, 'apiKey1')
    assert.strictEqual(connect.rest.apiSecret, 'apiSecret1')

    assert(connect.publicWS instanceof BybitWSV5)
    assert.strictEqual(connect.publicWS.apiKey, undefined)
    assert.strictEqual(connect.publicWS.apiSecret, undefined)
    assert.strictEqual(connect.publicWS.name, 'public')
    assert.strictEqual(connect.publicWS.reconnect, true)

    assert(connect.privateWS instanceof BybitWSV5)
    assert.strictEqual(connect.privateWS.apiKey, 'apiKey2')
    assert.strictEqual(connect.privateWS.apiSecret, 'apiSecret2')
    assert.strictEqual(connect.privateWS.name, 'private')
    assert.strictEqual(connect.privateWS.reconnect, true)

    assert(connect.tradeWS instanceof BybitWSV5)
    assert.strictEqual(connect.tradeWS.apiKey, 'apiKey3')
    assert.strictEqual(connect.tradeWS.apiSecret, 'apiSecret3')
    assert.strictEqual(connect.tradeWS.name, 'trade')
    assert.strictEqual(connect.tradeWS.reconnect, true)

    assert.strictEqual(connect.accountType, 'UNIFIED')
    assert.strictEqual(connect.maxCandlesLength, 500)

    assert.deepStrictEqual(connect.wallet, {})
    assert.deepStrictEqual(connect.orderbook, { bid: {}, ask: {} })
    assert.deepStrictEqual(connect.candles, [])
    assert.deepStrictEqual(connect.tradingInfo, {})
    assert.deepStrictEqual(connect.maxTradesInfo, { buy: {}, sell: {} })
    assert.strictEqual(connect.closeOrder, null)
    assert.strictEqual(connect.lastCandleMsgMts, 0)
    assert.strictEqual(connect.lastOrderbookMsgMts, 0)
  })

  it('Should have all needed methods.', function () {
    // Data.
    const neededMethods = [
      'constructor', 'initInputParams', 'setWallet', 'updateWallets',
      'manageWalletMsg', 'storeNewLimitOrder', 'storeLimitOrder',
      'removeLimitOrder', 'isCloseOrder', 'manageOrderMsg', 'getLimitOrders',
      'updateLimitOrders', 'storeCandle', 'updateCandles', 'manageCandleMsg',
      'setOrderbook', 'updateOrderbook', 'manageOrderbookMsg',
      'updatePairTradingInfo', 'updateMaxTradesInfo', 'repayLiability',
      'logWSMessage', 'getLastWallet', 'getLastCandles', 'getLastOrderbook',
      'submitMarketOrder', 'submitLimitOrder', 'updateLimitOrder',
      'cancelLimitOrder'
    ]

    // Assertions.
    const protoMethods = Object.getOwnPropertyNames(
      connectModule.XchgConnect.prototype
    )
    for (const method of protoMethods) {
      assert(neededMethods.includes(method), `${method} not in neededMethods.`)
    }
    for (const method of neededMethods) {
      assert(protoMethods.includes(method), `${method} not in protoMethods.`)
    }
  })

  it('Method setWallet should filter wallets and store.', function () {
    // Data.
    const wallet = {
      totalEquity: '7.48990039',
      accountIMRate: '0.8499',
      totalMarginBalance: '7.48990039',
      totalInitialMargin: '6.36566832',
      accountType: 'UNIFIED',
      totalAvailableBalance: '1.12423207',
      accountMMRate: '0.3399',
      totalPerpUPL: '0',
      totalWalletBalance: '7.48990039',
      accountLTV: '0.8947',
      totalMaintenanceMargin: '2.54626733',
      coin: [
        {
          availableToBorrow: '',
          bonus: '0',
          accruedInterest: '0.00051585',
          availableToWithdraw: '0',
          totalOrderIM: '0',
          equity: '-63.65',
          totalPositionMM: '0',
          usdValue: '-63.65668325',
          unrealisedPnl: '0',
          collateralSwitch: true,
          spotHedgingQty: '0',
          borrowAmount: '63.650000000000000000',
          totalPositionIM: '0',
          walletBalance: '-63.65',
          cumRealisedPnl: '0',
          locked: '0',
          marginCollateral: true,
          coin: 'USDC'
        },
        {
          availableToBorrow: '',
          bonus: '0',
          accruedInterest: '0',
          availableToWithdraw: '1.12557488',
          totalOrderIM: '0',
          equity: '71.2315629',
          totalPositionMM: '0',
          usdValue: '71.14658364',
          unrealisedPnl: '0',
          collateralSwitch: true,
          spotHedgingQty: '0',
          borrowAmount: '0.000000000000000000',
          totalPositionIM: '0',
          walletBalance: '71.2315629',
          cumRealisedPnl: '-0.10470399',
          locked: '63.720015',
          marginCollateral: true,
          coin: 'USDT'
        },
        {
          availableToBorrow: '',
          bonus: '0',
          accruedInterest: '0',
          availableToWithdraw: '0',
          totalOrderIM: '0',
          equity: '0',
          totalPositionMM: '0',
          usdValue: '0',
          unrealisedPnl: '0',
          collateralSwitch: true,
          spotHedgingQty: '0',
          borrowAmount: '0',
          totalPositionIM: '0',
          walletBalance: '0',
          cumRealisedPnl: '0',
          locked: '0',
          marginCollateral: true,
          coin: 'DAI'
        }
      ]
    }

    const expected = {
      ...wallet,
      coinsToWallet: {
        USDC: {
          availableToBorrow: '',
          bonus: '0',
          accruedInterest: '0.00051585',
          availableToWithdraw: '0',
          totalOrderIM: '0',
          equity: '-63.65',
          totalPositionMM: '0',
          usdValue: '-63.65668325',
          unrealisedPnl: '0',
          collateralSwitch: true,
          spotHedgingQty: '0',
          borrowAmount: '63.650000000000000000',
          totalPositionIM: '0',
          walletBalance: '-63.65',
          cumRealisedPnl: '0',
          locked: '0',
          marginCollateral: true,
          coin: 'USDC'
        },
        USDT: {
          availableToBorrow: '',
          bonus: '0',
          accruedInterest: '0',
          availableToWithdraw: '1.12557488',
          totalOrderIM: '0',
          equity: '71.2315629',
          totalPositionMM: '0',
          usdValue: '71.14658364',
          unrealisedPnl: '0',
          collateralSwitch: true,
          spotHedgingQty: '0',
          borrowAmount: '0.000000000000000000',
          totalPositionIM: '0',
          walletBalance: '71.2315629',
          cumRealisedPnl: '-0.10470399',
          locked: '63.720015',
          marginCollateral: true,
          coin: 'USDT'
        }
      }
    }

    // Assertions
    connect.setWallet(wallet)
    assert.deepStrictEqual(connect.wallet, expected)

    // Restores.
    connect.wallet = {}
  })

  it('Method updateWallets should get wallet and set it.', async function () {
    // Data.
    const stubGet = sinon.stub(connect.rest, 'getWalletBalance')
    stubGet.resolves({ result: { list: ['WalletData'] } })
    const stubSet = sinon.stub(connect, 'setWallet')

    // Assertions.
    await connect.updateWallets()
    assert(stubGet.calledOnceWithExactly({
      accountType: 'UNIFIED',
      coin: 'USDT,USDC'
    }))
    assert(stubSet.calledOnceWithExactly('WalletData'))

    // Restores.
    stubGet.restore()
    stubSet.restore()
  })

  it('Method manageWalletMsg should set wallet.', function () {
    const stub = sinon.stub(connect, 'setWallet')
    connect.manageWalletMsg({ data: ['WalletData'] })
    assert(stub.calledOnceWithExactly('WalletData'))
    stub.restore()
  })

  it('Method storeNewLimitOrder should store order at given attribute name.',
    function () {
      connect.closeOrder = {}
      connect.storeNewLimitOrder('CloseOrderData', 'closeOrder')
      assert.strictEqual(connect.closeOrder, 'CloseOrderData')
      connect.closeOrder = {}
    }
  )

  it('Method storeLimitOrder should check stored and store.', function () {
    // Data.
    const tests = [
      {
        order: { orderId: 1, qty: 2 },
        actual: null,
        storeCall: true,
        cancelCall: false,
        expectedOrder: { orderId: 1, qty: 2 }
      },
      {
        order: { orderId: 2, qty: 2 },
        actual: { orderId: 1, qty: 2 },
        storeCall: true,
        cancelCall: true,
        expectedOrder: { orderId: 2, qty: 2 }
      },
      {
        order: { orderId: 1, qty: 3 },
        actual: { orderId: 1, qty: 2 },
        storeCall: false,
        cancelCall: false,
        expectedOrder: { orderId: 1, qty: 3 }
      }
    ]

    // Assertions.
    for (const test of tests) {
      connect.closeOrder = test.actual
      const spyStore = sinon.spy(connect, 'storeNewLimitOrder')
      const stubCancel = sinon.stub(connect, 'cancelLimitOrder')

      connect.storeLimitOrder(test.order, 'closeOrder')

      assert.strictEqual(
        spyStore.calledOnceWithExactly(test.order, 'closeOrder'),
        test.storeCall
      )
      assert.strictEqual(
        stubCancel.calledOnceWithExactly(test.actual),
        test.cancelCall
      )
      assert.deepStrictEqual(connect.closeOrder, test.expectedOrder)

      // Restores.
      connect.closeOrder = null
      spyStore.restore()
      stubCancel.restore()
    }
  })

  it('Method removeLimitOrder shoyld delete if existing order matched id.',
    function () {
      // Data.
      const tests = [
        {
          actual: { orderId: 1 },
          order: { orderId: 1 },
          expected: undefined
        },
        {
          actual: { orderId: 2 },
          order: { orderId: 1 },
          expected: { orderId: 2 }
        }
      ]

      // Assertions.
      for (const test of tests) {
        connect.closeOrder = test.actual
        connect.removeLimitOrder(test.order, 'closeOrder')
        assert.deepStrictEqual(connect.closeOrder, test.expected)

        // Restores.
        connect.closeOrder = null
      }
    })

  it('Method isCloseOrder should check if is close order.', function () {
    // Data.
    const tests = [
      {
        orderStatus: 'New',
        expected: false
      },
      {
        orderStatus: 'PartiallyFilled',
        expected: false
      },
      {
        orderStatus: 'Filled',
        expected: true
      }
    ]

    // Assertions.
    for (const test of tests) {
      const output = connect.isCloseOrder(test.orderStatus)
      assert.strictEqual(output, test.expected)
    }
  })

  it('Method manageOrderMsg should remove or store spot Limit orders.',
    function () {
      // Data.
      const tests = [
        {
          order: {
            category: 'nonSpot',
            orderStatus: 'status',
            orderType: 'Limit'
          },
          isCloseReturn: false,
          isCloseCall: false,
          isRemoveCall: false,
          isStoreCall: false,
          expected: false
        },
        {
          order: {
            category: 'spot',
            orderStatus: 'status',
            orderType: 'nonLimit'
          },
          isCloseReturn: false,
          isCloseCall: false,
          isRemoveCall: false,
          isStoreCall: false,
          expected: false
        },
        {
          order: {
            category: 'spot',
            orderStatus: 'status',
            orderType: 'Limit'
          },
          isCloseReturn: true,
          isCloseCall: true,
          isRemoveCall: true,
          isStoreCall: false,
          expected: 'removed'
        },
        {
          order: {
            category: 'spot',
            orderStatus: 'status',
            orderType: 'Limit'
          },
          isCloseReturn: false,
          isCloseCall: true,
          isRemoveCall: false,
          isStoreCall: true,
          expected: 'stored'
        }
      ]

      // Assertions.
      for (const test of tests) {
        const stubIsClose = sinon.stub(connect, 'isCloseOrder')
        const stubRemove = sinon.stub(connect, 'removeLimitOrder')
        const stubStore = sinon.stub(connect, 'storeLimitOrder')
        stubIsClose.returns(test.isCloseReturn)
        stubRemove.returns('removed')
        stubStore.returns('stored')

        const output = connect.manageOrderMsg({ data: [test.order] })
        assert.strictEqual(output, test.expected)
        assert.strictEqual(
          stubIsClose.calledOnceWithExactly('status'),
          test.isCloseCall
        )
        assert.strictEqual(
          stubRemove.calledOnceWithExactly(test.order, 'closeOrder'),
          test.isRemoveCall
        )
        assert.strictEqual(
          stubStore.calledOnceWithExactly(test.order, 'closeOrder'),
          test.isStoreCall
        )

        // Restores.
        stubIsClose.restore()
        stubRemove.restore()
        stubStore.restore()
      }
    }
  )

  it('Method getLimitOrders should request orders.',
    async function () {
      // Data.
      const stub = sinon.stub(connect.rest, 'getOrders')
      stub.returns({
        result: {
          list: [{ orderId: 1 }, { orderId: 2 }, { orderId: 3 }]
        }
      })

      // Assertions.
      const output = await connect.getLimitOrders()
      assert.deepStrictEqual(
        output,
        [
          { category: 'spot', orderId: 1 },
          { category: 'spot', orderId: 2 },
          { category: 'spot', orderId: 3 }
        ]
      )
      assert(stub.calledOnceWithExactly({
        category: 'spot',
        symbol: 'USDCUSDT',
        openOnly: 0,
        limit: 50
      }))

      // Restores.
      stub.restore()
    }
  )

  it('Method updateLimitOrders should cancel all if multiple orders.',
    async function () {
      // Data.
      const stubGet = sinon.stub(connect, 'getLimitOrders')
      const stubCancel = sinon.stub(connect.rest, 'cancelAllOrders')
      const stubStore = sinon.stub(connect, 'storeLimitOrder')
      stubGet.resolves([{ orderId: 1 }, { orderId: 2 }])
      stubCancel.resolves({
        result: {
          list: [{ orderId: 1 }, { orderId: 2 }]
        }
      })

      // Assertions.
      await connect.updateLimitOrders()
      assert(stubGet.calledOnceWithExactly())
      assert(stubCancel.calledOnceWithExactly({
        category: 'spot',
        symbol: 'USDCUSDT'
      }))
      assert(stubStore.notCalled)

      // Restores.
      stubGet.restore()
      stubCancel.restore()
      stubStore.restore()
    })

  it('Method updateLimitOrders should store if single orders.',
    async function () {
      // Data.
      const stubGet = sinon.stub(connect, 'getLimitOrders')
      const stubCancel = sinon.stub(connect.rest, 'cancelAllOrders')
      const stubStore = sinon.stub(connect, 'storeLimitOrder')
      stubGet.resolves([{ orderId: 1 }])
      stubCancel.resolves({
        result: {
          list: [{ orderId: 1 }]
        }
      })

      // Assertions.
      await connect.updateLimitOrders()
      assert(stubGet.calledOnceWithExactly())
      assert(stubCancel.notCalled)
      assert(stubStore.calledOnceWithExactly({ orderId: 1 }, 'closeOrder'))

      // Restores.
      stubGet.restore()
      stubCancel.restore()
      stubStore.restore()
    })

  it('Method store Candle should store candle.', function () {
    // Data.
    connect.maxCandlesLength = 2
    const tests = [
      {
        candles: [
          { mts: 1, high: 10, low: 7, open: 8, close: 9, hl2: 8.5 }
        ],
        newCandle: { mts: 2, high: 10, low: 6, open: 8, close: 9 },
        expected: [
          { mts: 1, high: 10, low: 7, open: 8, close: 9, hl2: 8.5 },
          { mts: 2, high: 10, low: 6, open: 8, close: 9, hl2: 8 }
        ]
      },
      {
        candles: [
          { mts: 1, high: 10, low: 7, open: 8, close: 9, hl2: 8.5 },
          { mts: 2, high: 10, low: 6, open: 8, close: 9, hl2: 8 }
        ],
        newCandle: { mts: 3, high: 12, low: 6, open: 8, close: 9 },
        expected: [
          { mts: 2, high: 10, low: 6, open: 8, close: 9, hl2: 8 },
          { mts: 3, high: 12, low: 6, open: 8, close: 9, hl2: 9 }
        ]
      }
    ]

    // Assertions.
    for (const test of tests) {
      connect.candles = test.candles
      connect.storeCandle(test.newCandle)
      assert.deepStrictEqual(connect.candles, test.expected)
    }

    // Restores.
    connect.maxCandlesLength = 500
    connect.candles = []
  })

  it('Method updateCandles should get and store candles.', async function () {
    // Data.
    connect.lastCandleMsgMts = 0
    const candles = [
      [8, 9, 10, 11, 12, 13, 14],
      [1, 2, 3, 4, 5, 6, 7]
    ]

    const stubGet = sinon.stub(connect.rest, 'getCandles')
    stubGet.resolves({ result: { list: candles } })
    const stubStore = sinon.stub(connect, 'storeCandle')
    const stubDate = sinon.stub(Date, 'now').returns(36000000)

    // Assertions
    await connect.updateCandles()

    assert(stubGet.calledOnceWithExactly({
      category: 'spot',
      symbol: 'USDCUSDT',
      interval: '60',
      end: 32400000,
      limit: 500
    }))
    assert.deepStrictEqual(
      stubStore.args,
      [
        [
          {
            start: 1,
            open: 2,
            high: 3,
            low: 4,
            close: 5,
            volume: 6,
            turover: 7
          }
        ],
        [
          {
            start: 8,
            open: 9,
            high: 10,
            low: 11,
            close: 12,
            volume: 13,
            turover: 14
          }
        ]
      ]
    )
    assert.strictEqual(connect.lastCandleMsgMts, 36000000)

    // Restores.
    connect.lastCandleMsgMts = 0
    connect.candles = []
    stubGet.restore()
    stubStore.restore()
    stubDate.restore()
  })

  it('Method manageCandleMsg should store candle if confirmed.', function () {
    // Data.
    connect.lastCandleMsgMts = 10
    const stub = sinon.stub(connect, 'storeCandle')

    // Assertions.
    const output1 = connect.manageCandleMsg(
      {
        ts: 12,
        data: [{
          confirm: false,
          start: 1,
          open: 2,
          high: 3,
          low: 4,
          close: 5,
          volume: 6,
          turover: 7
        }]
      }
    )
    assert.strictEqual(output1, false)
    assert(stub.notCalled)
    assert.strictEqual(connect.lastCandleMsgMts, 12)
    stub.resetHistory()

    const output2 = connect.manageCandleMsg(
      {
        ts: 14,
        data: [{
          confirm: true,
          start: 1,
          open: 2,
          high: 3,
          low: 4,
          close: 5,
          volume: 6,
          turover: 7
        }]
      }
    )
    assert.strictEqual(output2, undefined)
    assert(stub.calledOnceWithExactly({
      start: 1,
      open: 2,
      high: 3,
      low: 4,
      close: 5,
      volume: 6,
      turover: 7
    }))
    assert.strictEqual(connect.lastCandleMsgMts, 14)

    // Restores.
    stub.restore()
    connect.lastCandleMsgMts = 0
  })

  it('Method setOrderbook should store orderbook.', function () {
    // Data.
    const tests = [
      {
        ob: null,
        expected: { bid: {}, ask: {} }
      },
      {
        ob: {},
        expected: { bid: {}, ask: {} }
      },
      {
        ob: { a: [], b: [] },
        expected: { bid: {}, ask: {} }
      },
      {
        ob: { a: [[]], b: [[]] },
        expected: { bid: {}, ask: {} }
      },
      {
        ob: { a: [['1', '2', '3']], b: [[]] },
        expected: { bid: {}, ask: { askAmount: 2, askPrice: 1 } }
      },
      {
        ob: { a: [[]], b: [['1', '2', '3']] },
        expected: { bid: { bidAmount: 2, bidPrice: 1 }, ask: {} }
      },
      {
        ob: { a: [['1', '2', '3']], b: [['4', '5', '6']] },
        expected: {
          bid: { bidAmount: 5, bidPrice: 4 },
          ask: { askAmount: 2, askPrice: 1 }
        }
      }
    ]

    // Assertions.
    for (const test of tests) {
      connect.orderbook = { bid: {}, ask: {} }
      connect.setOrderbook(test.ob)
      assert.deepStrictEqual(connect.orderbook, test.expected)
    }

    // Restores.
    connect.orderbook = { bid: {}, ask: {} }
  })

  it('Method updateOrderbook should get and set orderbook.',
    async function () {
      // Data.
      connect.lastOrderbookMsgMts = 0
      const orderbook = { a: [['1', '2', '3']], b: [['4', '5', '6']] }

      const stubGet = sinon.stub(connect.rest, 'getOrderBook')
      stubGet.resolves({ result: orderbook })
      const stubStore = sinon.stub(connect, 'setOrderbook')
      const stubDate = sinon.stub(Date, 'now').returns(10)

      // Assertions
      await connect.updateOrderbook()

      assert(stubGet.calledOnceWithExactly({
        category: 'spot',
        symbol: 'USDCUSDT',
        limit: 1
      }))
      assert(stubStore.calledOnceWithExactly(orderbook))
      assert.strictEqual(connect.lastOrderbookMsgMts, 10)

      // Restores.
      connect.lastOrderbookMsgMts = 0
      stubGet.restore()
      stubStore.restore()
      stubDate.restore()
    })

  it('Method manageOrderbookMsg should set orderbook.', function () {
    // Data.
    connect.lastOrderbookMsgMts = 0
    const stub = sinon.stub(connect, 'setOrderbook')

    // Assertions.
    connect.manageOrderbookMsg({ ts: 10, data: 'Orderbook' })
    assert(stub.calledOnceWithExactly('Orderbook'))
    assert.strictEqual(connect.lastOrderbookMsgMts, 10)

    // Restores.
    stub.restore()
    connect.lastOrderbookMsgMts = 0
  })

  it('Method updatePairTradingInfo should get and set info.',
    async function () {
      // Data.
      connect.tradingInfo = null
      const stubGet = sinon.stub(connect.rest, 'getInstrumentInfo')
      stubGet.resolves({ result: { list: ['InstrumentInfo'] } })

      // Assertions
      const output = await connect.updatePairTradingInfo()

      assert.strictEqual(output, 'InstrumentInfo')
      assert(stubGet.calledOnceWithExactly({
        category: 'spot',
        symbol: 'USDCUSDT',
        status: 'Trading'
      }))

      // Restores.
      stubGet.restore()
    })

  it('Method updateMaxTradesInfo should get buy and sell limits and store.',
    async function () {
      // Data.
      connect.maxTradesInfo = { buy: {}, sell: {} }

      const stub = sinon.stub(connect.rest, 'getMaxTradeLimits')

      stub.withArgs({
        category: 'spot',
        symbol: 'USDCUSDT',
        side: 'Buy'
      }).returns({ retMsg: 'OK', result: { info: 'buyInfo' } })

      stub.withArgs({
        category: 'spot',
        symbol: 'USDCUSDT',
        side: 'Sell'
      }).returns({ retMsg: 'OK', result: { info: 'sellInfo' } })

      // Assertions.
      const output = await connect.updateMaxTradesInfo()
      assert.deepStrictEqual(
        output,
        { buy: { info: 'buyInfo' }, sell: { info: 'sellInfo' } }
      )
      assert.deepStrictEqual(
        stub.args,
        [
          [{
            category: 'spot',
            symbol: 'USDCUSDT',
            side: 'Buy'
          }],
          [{
            category: 'spot',
            symbol: 'USDCUSDT',
            side: 'Sell'
          }]
        ]
      )

      // Restores.
      connect.maxTradesInfo = { buy: {}, sell: {} }
      stub.restore()
    })

  it('Method updateMaxTradesInfo should ignore bad responses.',
    async function () {
      // Data.
      connect.maxTradesInfo = { buy: {}, sell: {} }

      const stub = sinon.stub(connect.rest, 'getMaxTradeLimits')

      stub.withArgs({
        category: 'spot',
        symbol: 'USDCUSDT',
        side: 'Buy'
      }).returns({ retMsg: 'ERROR', result: { info: 'buyInfo' } })

      stub.withArgs({
        category: 'spot',
        symbol: 'USDCUSDT',
        side: 'Sell'
      }).returns({ retMsg: 'ERROR', result: { info: 'sellInfo' } })

      // Assertions.
      const output = await connect.updateMaxTradesInfo()
      assert.deepStrictEqual(
        output,
        { buy: {}, sell: {} }
      )
      assert.deepStrictEqual(
        stub.args,
        [
          [{
            category: 'spot',
            symbol: 'USDCUSDT',
            side: 'Buy'
          }],
          [{
            category: 'spot',
            symbol: 'USDCUSDT',
            side: 'Sell'
          }]
        ]
      )

      // Restores.
      connect.maxTradesInfo = { buy: {}, sell: {} }
      stub.restore()
    }
  )

  it('Method repayLiability should rest repay.', async function () {
    const stub = sinon.stub(connect.rest, 'repay')
    await connect.repayLiability()
    assert(stub.calledOnceWithExactly({ coin: 'USDC' }))
    stub.restore()
  })

  it('Method getLastWallet should return wallet.', function () {
    connect.wallet = 'wallet'
    const output = connect.getLastWallet()
    assert.strictEqual(output, 'wallet')
    connect.wallet = {}
  })

  it('Method getLastCandles should slice last candles stored.', function () {
    // Data.
    connect.bollingerParams.movingAverageLength = 2
    connect.candles = ['candle1', 'candle2', 'candle3', 'candle4']
    const tests = [
      {
        amount: null,
        lastCandleMsgMts: 1000000,
        now: 1600000,
        exitCall: false,
        expected: ['candle3', 'candle4']
      },
      {
        amount: 4,
        lastCandleMsgMts: 1000000,
        now: 1600000,
        exitCall: false,
        expected: ['candle1', 'candle2', 'candle3', 'candle4']
      },
      {
        amount: 4,
        lastCandleMsgMts: 1000000,
        now: 1600001,
        exitCall: true,
        expected: undefined
      }
    ]

    // Assertions.
    for (const test of tests) {
      connect.lastCandleMsgMts = test.lastCandleMsgMts
      const stubDate = sinon.stub(Date, 'now')
      stubDate.returns(test.now)
      const stubExit = sinon.stub(process, 'exit')
      stubExit.callsFake(() => {
        throw new Error()
      })

      let output
      try {
        output = connect.getLastCandles(test.amount)
      } catch {}
      assert.deepStrictEqual(output, test.expected)
      assert.strictEqual(stubExit.calledOnceWithExactly('2'), test.exitCall)

      // Restores.
      stubDate.restore()
      stubExit.restore()
    }

    connect.lastCandleMsgMts = 0
    const maLength = mockParams.bollingerParams.movingAverageLength
    connect.bollingerParams.movingAverageLength = maLength
    connect.candles = []
  })

  it('Method getLastOrderbook return last orderbook stored.', function () {
    // Data.
    const tests = [
      {
        orderbook: { bid: { bidPrice: 1.0001 }, ask: { askPrice: 1.0002 } },
        lastOrderbookMsgMts: 1000000,
        now: 1600000,
        exitCall: false,
        expected: { bid: { bidPrice: 1.0001 }, ask: { askPrice: 1.0002 } }
      },
      {
        orderbook: { bid: { bidPrice: 1.0001 }, ask: { askPrice: 1.0001 } },
        lastOrderbookMsgMts: 1000000,
        now: 1600000,
        exitCall: false,
        expected: null
      },
      {
        orderbook: { bid: {}, ask: {} },
        lastOrderbookMsgMts: 1000000,
        now: 1600000,
        exitCall: false,
        expected: null
      },
      {
        orderbook: 'Orderbook',
        lastOrderbookMsgMts: 1000000,
        now: 1600001,
        exitCall: true,
        expected: undefined
      }
    ]

    // Assertions.
    for (const test of tests) {
      connect.orderbook = test.orderbook
      connect.lastOrderbookMsgMts = test.lastOrderbookMsgMts
      const stubDate = sinon.stub(Date, 'now')
      stubDate.returns(test.now)
      const stubExit = sinon.stub(process, 'exit')
      stubExit.callsFake(() => {
        throw new Error()
      })

      let output
      try {
        output = connect.getLastOrderbook()
      } catch {}
      assert.deepStrictEqual(output, test.expected)
      assert.strictEqual(stubExit.calledOnceWithExactly('2'), test.exitCall)

      // Restores.
      stubDate.restore()
      stubExit.restore()
    }

    connect.lastOrderbookMsgMts = 0
    connect.orderbook = { bid: {}, ask: {} }
  })

  it('Method submitMarketOrder should create order via tradeWS.', function () {
    // Data.
    const stub = sinon.stub(connect.tradeWS, 'createOrder')

    // Assertions.
    connect.submitMarketOrder({ side: 'Sell', amount: 10 })
    assert(stub.calledOnceWithExactly({
      category: 'spot',
      symbol: 'USDCUSDT',
      isLeverage: 1,
      side: 'Sell',
      orderType: 'Market',
      qty: '10'
    }))

    // Restores.
    stub.restore()
  })

  it('Method submitLimitOrder should create order via tradeWS.', function () {
    // Data.
    const stub = sinon.stub(connect.tradeWS, 'createOrder')

    // Assertions.
    connect.submitLimitOrder({ side: 'Buy', amount: 10, price: 1.0001 })
    assert(stub.calledOnceWithExactly({
      category: 'spot',
      symbol: 'USDCUSDT',
      isLeverage: 1,
      side: 'Buy',
      orderType: 'Limit',
      qty: '10',
      price: '1.0001'
    }))

    // Restores.
    stub.restore()
  })

  it('Method updateLimitOrder should update order via tradeWS.', function () {
    // Data.
    const stub = sinon.stub(connect.tradeWS, 'updateOrder')
    const order = { category: 'spot', symbol: 'USDCUSDT', orderId: 1 }
    const updateParams = { price: 1.001, qty: 15 }

    // Assertions.
    connect.updateLimitOrder(order, updateParams)
    assert(stub.calledOnceWithExactly({
      category: 'spot',
      symbol: 'USDCUSDT',
      orderId: 1,
      price: 1.001,
      qty: 15
    }))

    // Restores.
    stub.restore()
  })

  it('Method cancelLimitOrder should cancel order via tradeWS.', function () {
    // Data.
    const stub = sinon.stub(connect.tradeWS, 'cancelOrder')
    const order = { category: 'spot', symbol: 'USDCUSDT', orderId: 1 }

    // Assertions.
    connect.cancelLimitOrder(order)
    assert(stub.calledOnceWithExactly({
      category: 'spot',
      symbol: 'USDCUSDT',
      orderId: 1
    }))

    // Restores.
    stub.restore()
  })
})
