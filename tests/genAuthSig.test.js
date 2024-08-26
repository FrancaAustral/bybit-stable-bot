/* eslint-env mocha */
'use strict'

// Third party dependencies.)
const assert = require('assert')
const sinon = require('sinon')
const rewire = require('rewire')

// Local dependencies.
const signModule = rewire(
  '../helpers/eventProcessor/exchangeConnect/bybit/lib/util/genAuthSig'
)

class MockCryptoClass {
  createHmac () { return this }
  update () { return this }
  digest () {}
}

class MockURLSearchParams {
  constructor (sortedParams) {
    this.sortedParams = sortedParams
  }

  toString () {
    return JSON.stringify(this.sortedParams)
  }
}

const mockCrypto = new MockCryptoClass()
signModule.__set__('crypto', mockCrypto)
signModule.__set__('URLSearchParams', MockURLSearchParams)

const genAuthSig = signModule.__get__('genAuthSig')

describe('Test on genAuthSig script.', function () {
  it('Function should get authenticated signature.', function () {
    // Data.
    const spyHmac = sinon.spy(mockCrypto, 'createHmac')
    const spyUpdate = sinon.spy(mockCrypto, 'update')
    const stubDigest = sinon.stub(mockCrypto, 'digest')
    stubDigest.returns('digested')

    const params = {
      a: 1,
      d: 4,
      c: 3
    }

    // Assertions.
    const output1 = genAuthSig('apiSecret', params, null)
    assert(spyHmac.calledOnceWithExactly('sha256', 'apiSecret'))
    assert(spyUpdate.calledOnceWithExactly('{"a":1,"c":3,"d":4}'))
    assert(stubDigest.calledOnceWithExactly('hex'))
    assert.deepStrictEqual(
      output1,
      {
        paramString: '{"a":1,"c":3,"d":4}',
        signature: 'digested'
      }
    )
    spyHmac.resetHistory()
    spyUpdate.resetHistory()
    stubDigest.resetHistory()

    const output2 = genAuthSig('apiSecret', params, 'message')
    assert(spyHmac.calledOnceWithExactly('sha256', 'apiSecret'))
    assert(spyUpdate.calledOnceWithExactly('message'))
    assert(stubDigest.calledOnceWithExactly('hex'))
    assert.deepStrictEqual(
      output2,
      {
        paramString: 'message',
        signature: 'digested'
      }
    )
  })
})
