'use strict'

// Local dependencies.
const genAuthSig = require('../util/genAuthSig')
const { logger } = require('../../../../../logger')

// Third-party dependencies.
const axios = require('axios')

class BybitRestV5 {
  constructor ({ apiKey, apiSecret, useTestnet }) {
    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.baseURL = (useTestnet)
      ? 'https://api-testnet.bybit.com'
      : 'https://api.bybit.com'
  }

  async request (endpoint, method, params = {}) {
    const url = `${this.baseURL}/v5${endpoint}`
    const timestamp = Date.now()
    const recvWindow = 5000

    const requestParams = {
      api_key: this.apiKey,
      timestamp,
      recvWindow,
      ...params
    }

    const { paramString, signature } = genAuthSig(this.apiSecret, requestParams)

    try {
      let response
      if (method === 'GET') {
        const getUrl = `${url}?${paramString}&sign=${signature}`
        response = await axios.get(getUrl)
      } else if (method === 'POST') {
        const postData = { ...requestParams, sign: signature }
        response = await axios.post(url, postData)
      } else {
        throw new Error(`Unsupported request method: ${method}`)
      }
      return response.data
    } catch (error) {
      logger(`Error in request to ${endpoint}: ${error.message}`)
      throw error
    }
  }

  getCandles (params) {
    return this.request('/market/kline', 'GET', params)
  }

  getInstrumentInfo (params) {
    return this.request('/market/instruments-info', 'GET', params)
  }

  getOrderBook (params) {
    return this.request('/market/orderbook', 'GET', params)
  }

  getWalletBalance (params) {
    return this.request('/account/wallet-balance', 'GET', params)
  }

  getMaxTradeLimits (params) {
    return this.request('/order/spot-borrow-check', 'GET', params)
  }

  getOrders (params) {
    return this.request('/order/realtime', 'GET', params)
  }

  cancelAllOrders (params) {
    return this.request('/order/cancel-all', 'POST', params)
  }

  repay (params) {
    return this.request('/account/quick-repayment', 'POST', params)
  }
}

module.exports = {
  BybitRestV5
}
