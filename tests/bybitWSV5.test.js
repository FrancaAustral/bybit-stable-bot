/* eslint-env mocha */
'use strict'

// Third party dependencies.)
const assert = require('assert')
const sinon = require('sinon')
const rewire = require('rewire')

// Local dependencies.
const wsV5Module = rewire(
  '../helpers/eventProcessor/exchangeConnect/bybit/lib/ws/bybitWSV5'
)
const mockGenAuthSig = sinon.stub()
wsV5Module.__set__('genAuthSig', mockGenAuthSig)
wsV5Module.__set__('logger', () => {})

const wsV5 = new wsV5Module.BybitWSV5({
  apiKey: 'apiKey',
  apiSecret: 'apiSecret',
  type: 'private',
  reconnect: true,
  name: 'tests',
  useTestNet: false
})

describe('Test on WSV5Module class.', function () {
  it('Constructor should init all needed attribures.', function () {
    // Assertions.
    assert.strictEqual(wsV5.apiKey, 'apiKey')
    assert.strictEqual(wsV5.apiSecret, 'apiSecret')
    assert.deepStrictEqual(
      wsV5.authArgs,
      {
        apiKey: 'apiKey',
        apiSecret: 'apiSecret'
      }
    )
    assert.strictEqual(
      wsV5.baseURL,
      'wss://stream.bybit.com/v5/private'
    )
    assert.strictEqual(wsV5.reconnect, true)
    assert.strictEqual(wsV5.name, 'tests')
    assert.strictEqual(wsV5.reconnectDelay, 2000)
    assert.strictEqual(wsV5.pingIntervalDelay, 20000)
    assert.strictEqual(wsV5.pongDelayAllowed, 5000)
    assert.strictEqual(wsV5.pingTimeout, null)
    assert.strictEqual(wsV5.pongTimeout, null)
    assert.strictEqual(wsV5.reconnectTimeout, null)

    assert.strictEqual(wsV5._ws, null)
    assert.deepStrictEqual(wsV5._subscriptions, {})
    assert.strictEqual(wsV5._prevSubscriptions, null)

    assert.strictEqual(wsV5._isOpen, false)
    assert.strictEqual(wsV5._isClosing, false)
    assert.strictEqual(wsV5._isAuthenticated, false)

    assert.strictEqual(wsV5._onWSOpen.name, 'bound _onWSOpen')
    assert.strictEqual(wsV5._onWSMessage.name, 'bound _onWSMessage')
    assert.strictEqual(wsV5._onWSError.name, 'bound _onWSError')
    assert.strictEqual(wsV5._onWSClose.name, 'bound _onWSClose')
  })

  it('Constructor should select correct url.', function () {
    const ws1 = new wsV5Module.BybitWSV5({ type: 'public', useTestNet: false })
    const ws2 = new wsV5Module.BybitWSV5({ type: 'public', useTestNet: true })
    const ws3 = new wsV5Module.BybitWSV5({ type: 'private', useTestNet: false })
    const ws4 = new wsV5Module.BybitWSV5({ type: 'private', useTestNet: true })
    const ws5 = new wsV5Module.BybitWSV5({ type: 'trade', useTestNet: false })
    const ws6 = new wsV5Module.BybitWSV5({ type: 'trade', useTestNet: true })

    assert(ws1.baseURL, 'wss://stream.bybit.com/v5/public/spot')
    assert(ws2.baseURL, 'wss://stream-testnet.bybit.com/v5/public/spot')
    assert(ws3.baseURL, 'wss://stream.bybit.com/v5/private')
    assert(ws4.baseURL, 'wss://stream-testnet.bybit.com/v5/private')
    assert(ws5.baseURL, 'wss://stream.bybit.com/v5/trade')
    assert(ws6.baseURL, 'wss://stream-testnet.bybit.com/v5/trade')
  })

  it('Should have all needed methods.', function () {
    // Data.
    const neededMethods = [
      'constructor', 'open', '_onWSOpen', '_onWSMessage', '_onWSClose',
      '_onWSError', 'resetPingPong', 'reconnectAfterClose', 'resubscribe',
      'subscribe', 'unsubscribe', 'authenticate', 'createOrder',
      'updateOrder', 'cancelOrder', 'send', 'close', 'cleanTimers'
    ]

    // Assertions.
    const protoMethods = Object.getOwnPropertyNames(
      wsV5Module.BybitWSV5.prototype
    )
    for (const method of protoMethods) {
      assert(neededMethods.includes(method), `${method} not in neededMethods.`)
    }
    for (const method of neededMethods) {
      assert(protoMethods.includes(method), `${method} not in protoMethods.`)
    }
  })

  it('Method _onWSOpen should start ping-pong, authenticate and resubscribe.',
    async function () {
      // Data.
      const tests = [
        {
          authArgs: null,
          authCall: false,
          prevSubs: null,
          resubCall: false
        },
        {
          authArgs: 'authArgs',
          authCall: true,
          prevSubs: null,
          resubCall: false
        },
        {
          authArgs: null,
          authCall: false,
          prevSubs: 'prevSubs',
          resubCall: true
        },
        {
          authArgs: 'authArgs',
          authCall: true,
          prevSubs: 'prevSubs',
          resubCall: true
        }
      ]

      // Assertions.
      for (const test of tests) {
        wsV5._isOpen = false
        wsV5.authArgs = test.authArgs
        wsV5._prevSubscriptions = test.prevSubs
        const stubEmit = sinon.stub(wsV5, 'emit')
        const stubReset = sinon.stub(wsV5, 'resetPingPong')
        const stubAuth = sinon.stub(wsV5, 'authenticate')
        const stubSub = sinon.stub(wsV5, 'resubscribe')

        await wsV5._onWSOpen()
        assert.strictEqual(wsV5._isOpen, true)
        assert(stubEmit.calledOnceWithExactly('open'))
        assert(stubReset.calledOnceWithExactly())
        assert.strictEqual(stubAuth.calledOnceWithExactly(), test.authCall)
        assert.strictEqual(stubSub.calledOnceWithExactly(), test.resubCall)
        assert.strictEqual(wsV5._prevSubscriptions, null)

        // Restores.
        wsV5._isOpen = false
        wsV5.authArgs = test.authArgs
        wsV5._prevSubscriptions = null
        stubEmit.restore()
        stubReset.restore()
        stubAuth.restore()
        stubSub.restore()
      }
    }
  )

  it('Method _onWSMessage should propagate.', function () {
    // Data.
    const tests = [
      {
        dataObj: { op: 'auth' },
        emitArgs: ['auth', JSON.stringify({ op: 'auth' })],
        emitCalled: true,
        resetCalled: false,
        cbCall: false
      },
      {
        dataObj: { op: 'subscribe', conn_id: 123 },
        emitArgs: ['subscribe', 123],
        emitCalled: true,
        resetCalled: false,
        cbCall: false
      },
      {
        dataObj: { op: 'ping' },
        emitArgs: [],
        emitCalled: false,
        resetCalled: true,
        cbCall: false
      },
      {
        dataObj: { op: 'pong' },
        emitArgs: [],
        emitCalled: false,
        resetCalled: true,
        cbCall: false
      },
      {
        dataObj: { op: 'message', topic: 'testCb' },
        emitArgs: ['message', { op: 'message', topic: 'testCb' }],
        emitCalled: true,
        resetCalled: false,
        cbCall: true
      },
      {
        dataObj: { op: 'message', topic: 'nonTestCb' },
        emitArgs: ['message', { op: 'message', topic: 'nonTestCb' }],
        emitCalled: true,
        resetCalled: false,
        cbCall: false
      }
    ]

    // Assertinos.
    for (const test of tests) {
      wsV5._subscriptions.testCb = sinon.stub()
      const stubEmit = sinon.stub(wsV5, 'emit')
      const stubReset = sinon.stub(wsV5, 'resetPingPong')

      wsV5._onWSMessage(JSON.stringify(test.dataObj))
      assert.strictEqual(
        stubEmit.calledOnceWithExactly(...test.emitArgs),
        test.emitCalled
      )
      assert.strictEqual(
        stubReset.calledOnceWithExactly(),
        test.resetCalled
      )

      // Retores.
      delete wsV5._subscriptions.testCb
      stubEmit.restore()
      stubReset.restore()
    }
  })

  it('Method _onWSClose should reset attributes and reconnect if needed.',
    function () {
      // Data.
      const tests = [
        {
          reconnect: false,
          _isClosing: false,
          reconnectCalled: false
        },
        {
          reconnect: true,
          _isClosing: true,
          reconnectCalled: false
        },
        {
          reconnect: true,
          _isClosing: false,
          reconnectCalled: true
        }
      ]

      // Assertions.
      for (const test of tests) {
        wsV5._ws = 'WebSocketObject'
        wsV5.reconnect = test.reconnect
        wsV5._isClosing = test._isClosing
        const stubClean = sinon.stub(wsV5, 'cleanTimers')
        const stubEmit = sinon.stub(wsV5, 'emit')
        const stubReconnect = sinon.stub(wsV5, 'reconnectAfterClose')

        wsV5._onWSClose()
        assert(stubClean.calledOnceWithExactly())
        assert.strictEqual(wsV5._isOpen, false)
        assert.strictEqual(wsV5._ws, null)
        assert(stubEmit.calledOnceWithExactly('close'))
        assert.strictEqual(
          stubReconnect.calledOnceWithExactly(),
          test.reconnectCalled
        )
        assert.strictEqual(wsV5._isClosing, false)

        // Retores.
        wsV5._ws = null
        wsV5.reconnect = true
        wsV5._isClosing = false
        stubClean.restore()
        stubEmit.restore()
        stubReconnect.restore()
      }
    }
  )

  it('Method _onWSError should emit error.', function () {
    const stub = sinon.stub(wsV5, 'emit')
    wsV5._onWSError('errorMsg')
    assert(stub.calledOnceWithExactly('error', 'errorMsg'))
    stub.restore()
  })

  it('Method reconnectAfterClose should store subscriptions and set timer.',
    function () {
      // Data.
      // Needs new rewire to use fake clock.
      const clock = sinon.useFakeTimers()
      const wsV5Module = rewire(
        '../helpers/eventProcessor/exchangeConnect/bybit/lib/ws/bybitWSV5'
      )
      const mockGenAuthSig = sinon.stub()
      wsV5Module.__set__('genAuthSig', mockGenAuthSig)
      wsV5Module.__set__('logger', () => {})
      const wsV5 = new wsV5Module.BybitWSV5({
        apiKey: 'apiKey',
        apiSecret: 'apiSecret',
        type: 'private',
        reconnect: true,
        name: 'tests',
        useTestNet: false
      })

      wsV5.reconnectTimeout = null
      wsV5.reconnectDelay = 100
      wsV5._prevSubscriptions = null
      wsV5._subscriptions = { order: 'orderCb' }
      const stubEmit = sinon.stub(wsV5, 'emit')
      const stubOpen = sinon.stub(wsV5, 'open')

      // Assertions.
      wsV5.reconnectAfterClose()
      assert.deepStrictEqual(wsV5._prevSubscriptions, { order: 'orderCb' })

      clock.tick(99)
      assert(stubEmit.notCalled)
      assert(stubOpen.notCalled)
      assert(!!wsV5.reconnectTimeout)

      clock.tick(1)
      assert(stubEmit.calledOnceWithExactly('reconnect'))
      assert(stubOpen.calledOnceWithExactly())
      assert.strictEqual(wsV5.reconnectTimeout, null)

      // Restores.
      clock.restore()
      stubEmit.restore()
      stubOpen.restore()
    }
  )

  it('Method resubscribe should subcribe to _prevSubscriptions.', function () {
    const stub = sinon.stub(wsV5, 'subscribe')
    wsV5._prevSubscriptions = { order: 'orderCb', wallet: 'walletCb' }
    wsV5.resubscribe()
    assert.deepStrictEqual(
      stub.args,
      [['order', 'orderCb'], ['wallet', 'walletCb']]
    )
    stub.restore()
  })

  it('Method subscribe should send subcribe message & store cb.', function () {
    // Data.
    const stub = sinon.stub(wsV5, 'send')
    wsV5._subscriptions = {}

    // Assertions.
    wsV5.subscribe('order', 'orderCb')
    assert(stub.calledOnceWithExactly({ op: 'subscribe', args: ['order'] }))
    assert.deepStrictEqual(wsV5._subscriptions, { order: 'orderCb' })

    // Restores.
    stub.restore()
    wsV5._subscriptions = {}
  })

  it('Method unsubscribe should send unsubcribe message & store cb.',
    function () {
      // Data.
      const stub = sinon.stub(wsV5, 'send')
      wsV5._subscriptions = { order: 'orderCb' }

      // Assertions.
      wsV5.unsubscribe('order')
      assert(stub.calledOnceWithExactly({ op: 'unsubscribe', args: ['order'] }))
      assert.deepStrictEqual(wsV5._subscriptions, {})

      // Restores.
      stub.restore()
      wsV5._subscriptions = {}
    })

  it('Method createOrder should send order message.', function () {
    // Data.
    const stubDate = sinon.stub(Date, 'now')
    stubDate.returns(100)
    const stubSend = sinon.stub(wsV5, 'send')

    // Assertions.
    wsV5.createOrder('orderObject')
    assert(stubSend.calledOnceWithExactly({
      header: { 'X-BAPI-TIMESTAMP': '100' },
      op: 'order.create',
      args: ['orderObject']
    }))

    // Restores.
    stubDate.restore()
    stubSend.restore()
  })

  it('Method updateOrder should send update message.', function () {
    // Data.
    const stubDate = sinon.stub(Date, 'now')
    stubDate.returns(100)
    const stubSend = sinon.stub(wsV5, 'send')

    // Assertions.
    wsV5.updateOrder('updateArgs')
    assert(stubSend.calledOnceWithExactly({
      header: { 'X-BAPI-TIMESTAMP': '100' },
      op: 'order.amend',
      args: ['updateArgs']
    }))

    // Restores.
    stubDate.restore()
    stubSend.restore()
  })

  it('Method cancelOrder should send cancel message.', function () {
    // Data.
    const stubDate = sinon.stub(Date, 'now')
    stubDate.returns(100)
    const stubSend = sinon.stub(wsV5, 'send')

    // Assertions.
    wsV5.cancelOrder({ category: 'spot', symbol: 'USDCUSDT', orderId: 1 })
    assert(stubSend.calledOnceWithExactly({
      header: { 'X-BAPI-TIMESTAMP': '100' },
      op: 'order.cancel',
      args: [{ category: 'spot', symbol: 'USDCUSDT', orderId: 1 }]
    }))

    // Restores.
    stubDate.restore()
    stubSend.restore()
  })
})
