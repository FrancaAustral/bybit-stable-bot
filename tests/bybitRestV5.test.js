/* eslint-env mocha */
'use strict'

// Third party dependencies.)
const assert = require('assert')
const sinon = require('sinon')
const rewire = require('rewire')

// Local dependencies.
const restV5Module = rewire(
  '../helpers/eventProcessor/exchangeConnect/bybit/lib/rest/bybitRestV5'
)
const mockGenAuthSig = sinon.stub()

class MockAxiosClass {
  get () {}
  post () {}
}

const mockAxios = new MockAxiosClass()

restV5Module.__set__('axios', mockAxios)
restV5Module.__set__('genAuthSig', mockGenAuthSig)

const restV5 = new restV5Module.BybitRestV5({
  apiKey: 'apiKey',
  apiSecret: 'apiSecret',
  useTestNet: false
})

describe('Test on RestV5Module class.', function () {
  it('Constructor should init all needed attribures.', function () {
    // Assertions.
    assert.strictEqual(restV5.apiKey, 'apiKey')
    assert.strictEqual(restV5.apiSecret, 'apiSecret')
    assert.strictEqual(restV5.baseURL, 'https://api.bybit.com')

    // Testnet Assertions.
    const testV5 = new restV5Module.BybitRestV5({ useTestnet: true })
    assert.strictEqual(testV5.baseURL, 'https://api-testnet.bybit.com')
  })

  it('Should have all needed methods.', function () {
    // Data.
    const neededMethods = [
      'constructor', 'request', 'getCandles', 'getInstrumentInfo',
      'getOrderBook', 'getWalletBalance', 'getMaxTradeLimits', 'getOrders',
      'cancelAllOrders', 'repay'
    ]

    // Assertions.
    const protoMethods = Object.getOwnPropertyNames(
      restV5Module.BybitRestV5.prototype
    )
    for (const method of protoMethods) {
      assert(neededMethods.includes(method), `${method} not in neededMethods.`)
    }
    for (const method of neededMethods) {
      assert(protoMethods.includes(method), `${method} not in protoMethods.`)
    }
  })

  it('Method request should prepare url and get / post.', async function () {
    // Data.
    const tests = [
      {
        method: 'GET',
        getCalled: true,
        getArgs: [
          'https://api.bybit.com/v5/endpoint?paramString&sign=signature'
        ],
        postCalled: false,
        postArgs: [],
        expected: 'getData'
      },
      {
        method: 'POST',
        getCalled: false,
        getArgs: [],
        postCalled: false,
        postArgs: [
          'https://api.bybit.com/v5/endpoint',
          {
            api_key: 'apiKey',
            timestamp: 1000000,
            recvWindow: 5000,
            param: 'paramValue',
            sign: 'signature'
          }
        ],
        expected: 'postData'
      }
    ]

    // Assertions
    for (const test of tests) {
      const stubDate = sinon.stub(Date, 'now').returns(1000000)
      const stubGet = sinon.stub(mockAxios, 'get').returns({ data: 'getData' })
      const stubPost = sinon.stub(mockAxios, 'post').returns(
        { data: 'postData' }
      )
      mockGenAuthSig.returns({
        paramString: 'paramString',
        signature: 'signature'
      })

      const output = await restV5.request(
        '/endpoint',
        test.method,
        { param: 'paramValue' }
      )
      assert.strictEqual(output, test.expected)
      assert(stubDate.calledOnceWithExactly())
      assert(mockGenAuthSig.calledOnceWithExactly(
        'apiSecret',
        {
          api_key: 'apiKey',
          timestamp: 1000000,
          recvWindow: 5000,
          param: 'paramValue'
        }
      ))
      assert.strictEqual(
        stubGet.calledOnceWithExactly(...test.getArgs),
        stubGet.called
      )
      assert.strictEqual(
        stubPost.calledOnceWithExactly(...test.postArgs),
        stubPost.called
      )

      // Restores.
      mockGenAuthSig.reset()
      stubDate.restore()
      stubGet.restore()
      stubPost.restore()
    }
  })

  it('Method getCandles should GET kline endpoint.', function () {
    const stub = sinon.stub(restV5, 'request')
    stub.returns('response')
    const output = restV5.getCandles('params')
    assert.strictEqual(output, 'response')
    assert(stub.calledOnceWithExactly('/market/kline', 'GET', 'params'))
    stub.restore()
  })

  it('Method getInstrumentInfo should GET instruments endpoint.', function () {
    const stub = sinon.stub(restV5, 'request')
    stub.returns('response')
    const output = restV5.getInstrumentInfo('params')
    assert.strictEqual(output, 'response')
    assert(
      stub.calledOnceWithExactly('/market/instruments-info', 'GET', 'params')
    )
    stub.restore()
  })

  it('Method getOrderBook should GET ordebook endpoint.', function () {
    const stub = sinon.stub(restV5, 'request')
    stub.returns('response')
    const output = restV5.getOrderBook('params')
    assert.strictEqual(output, 'response')
    assert(
      stub.calledOnceWithExactly('/market/orderbook', 'GET', 'params')
    )
    stub.restore()
  })

  it('Method getWalletBalance should GET wallet endpoint.', function () {
    const stub = sinon.stub(restV5, 'request')
    stub.returns('response')
    const output = restV5.getWalletBalance('params')
    assert.strictEqual(output, 'response')
    assert(
      stub.calledOnceWithExactly('/account/wallet-balance', 'GET', 'params')
    )
    stub.restore()
  })

  it('Method getMaxTradeLimits should GET wallet endpoint.', function () {
    const stub = sinon.stub(restV5, 'request')
    stub.returns('response')
    const output = restV5.getMaxTradeLimits('params')
    assert.strictEqual(output, 'response')
    assert(
      stub.calledOnceWithExactly('/order/spot-borrow-check', 'GET', 'params')
    )
    stub.restore()
  })

  it('Method getOrders should GET wallet endpoint.', function () {
    const stub = sinon.stub(restV5, 'request')
    stub.returns('response')
    const output = restV5.getOrders('params')
    assert.strictEqual(output, 'response')
    assert(
      stub.calledOnceWithExactly('/order/realtime', 'GET', 'params')
    )
    stub.restore()
  })

  it('Method cancelAllOrders should POST to order endpoint.', function () {
    const stub = sinon.stub(restV5, 'request')
    stub.returns('response')
    const output = restV5.cancelAllOrders('params')
    assert.strictEqual(output, 'response')
    assert(
      stub.calledOnceWithExactly('/order/cancel-all', 'POST', 'params')
    )
    stub.restore()
  })

  it('Method repay should POST to repay endpoint.', function () {
    const stub = sinon.stub(restV5, 'request')
    stub.returns('response')
    const output = restV5.repay('params')
    assert.strictEqual(output, 'response')
    assert(
      stub.calledOnceWithExactly('/account/quick-repayment', 'POST', 'params')
    )
    stub.restore()
  })
})
