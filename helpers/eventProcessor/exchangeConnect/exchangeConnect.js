'use strict'

// Local dependencies.
const { logger } = require('../../logger')
const {
  BybitRestV5,
  BybitWSV5
} = require('./bybit')

class XchgConnect {
  constructor (keys, inputParams) {
    this.logger = logger
    this.initInputParams(inputParams)
    const {
      apiKey1,
      apiSecret1,
      apiKey2,
      apiSecret2,
      apiKey3,
      apiSecret3
    } = keys
    this.rest = new BybitRestV5({ apiKey: apiKey1, apiSecret: apiSecret1 })
    this.publicWS = new BybitWSV5({ type: 'public', reconnect: true })
    this.privateWS = new BybitWSV5({
      apiKey: apiKey2,
      apiSecret: apiSecret2,
      type: 'private',
      reconnect: true
    })
    this.tradeWS = new BybitWSV5({
      apiKey: apiKey3,
      apiSecret: apiSecret3,
      type: 'trade',
      reconnect: true
    })

    // Constants
    this.accountType = 'UNIFIED'
    this.maxCandlesLength = 500

    // Storage.
    this.wallet = {}
    this.orderbook = { bid: {}, ask: {} }
    this.candles = []
    this.tradingInfo = {}
    this.closeOrder = null

    this.lastCandleMsgMts = 0
    this.lastOrderbookMsgMts = 0
  }

  initInputParams (inputParams) {
    this.currency = inputParams.currency
    this.asset = inputParams.asset
    this.pair = inputParams.pair
    this.bollingerParams = inputParams.bollingerParams
    this.minSellPrice = inputParams.minSellPrice
    this.maxBuyPrice = inputParams.maxBuyPrice
    this.maxAssetBalance = inputParams.maxAssetBalance
    this.leverage = inputParams.leverage

    this.walletCoins = [this.currency, this.asset]
  }

  setWallet (w) {
    const { totalMarginBalance: mBce, totalAvailableBalance: aBce } = w
    this.logger('log', true, `WU: marginBce: ${mBce} availableBce: ${aBce}`)
    const coinsToWallet = w.coin.reduce((prev, curr) => {
      const { coin, walletBalance: balance, borrowAmount } = curr
      if (!this.walletCoins.includes(coin)) return prev
      this.logger('log', true, 'WU:', [coin, balance, borrowAmount])
      prev[coin] = curr
      return prev
    }, this.wallet.coinsToWallet || {}) // In case missing any coin update.
    this.wallet = { ...w, coinsToWallet }
  }

  async updateWallets () {
    const params = {
      accountType: this.accountType,
      coin: `${this.currency},${this.asset}` // get zero asset info.
    }
    const walletInfo = await this.rest.getWalletBalance(params)
    this.setWallet(walletInfo.result.list[0])
  }

  manageWalletMsg (msg) {
    this.setWallet(msg.data[0])
  }

  storeNewLimitOrder (order, type) {
    this[type] = order
    this.logger('log', true, 'ON', order)
  }

  storeLimitOrder (order, type) {
    const actualOrder = this[type]
    if (!actualOrder) return this.storeNewLimitOrder(order, type)
    if (actualOrder.orderId !== order.orderId) {
      this.cancelLimitOrder(actualOrder)
      return this.storeNewLimitOrder(order, type)
    }
    this[type] = order
    if (JSON.stringify(actualOrder) !== JSON.stringify(this[type])) {
      this.logger('log', true, 'OU:', order)
    }
  }

  removeLimitOrder (order, type) {
    if (this[type]?.orderId === order.orderId) delete this[type]
    this.logger('log', true, 'OC:', order)
  }

  isCloseOrder (orderStatus) {
    // Bot not using Conditional order, in that case add 'Untriggered'
    return !['New', 'PartiallyFilled'].includes(orderStatus)
  }

  manageOrderMsg (msg) {
    const order = msg.data[0]
    const { category, orderType, orderStatus } = order
    if (category !== 'spot' || orderType !== 'Limit') return false
    return (this.isCloseOrder(orderStatus))
      ? this.removeLimitOrder(order, 'closeOrder')
      : this.storeLimitOrder(order, 'closeOrder')
  }

  async getLimitOrders () {
    const params = {
      category: 'spot',
      symbol: this.pair,
      openOnly: 0, // Only returns open orders.
      limit: 50
    }
    const ordersResponse = await this.rest.getOrders(params)
    return ordersResponse.result.list.map((o) => {
      return { category: 'spot', ...o } // Response missing 'category'.
    })
  }

  async updateLimitOrders () {
    const orders = await this.getLimitOrders()
    if (orders.length > 1) {
      const canceled = await this.rest.cancelAllOrders({
        category: 'spot',
        symbol: this.pair
      })
      return this.logger(
        'log',
        true,
        'Canceled multiple limit orders:',
        canceled.result.list.map((o) => o.orderId)
      )
    }
    orders.forEach((o) => this.storeLimitOrder(o, 'closeOrder'))
  }

  storeCandle (candle) {
    const newCandle = { ...candle, hl2: (candle.high + candle.low) / 2 }
    this.candles.push(newCandle)
    if (this.candles.length > this.maxCandlesLength) {
      this.candles.shift()
    }
  }

  async updateCandles () {
    const interval = this.bollingerParams.movingAverageTimeframe
    const params = {
      category: 'spot',
      symbol: this.pair,
      interval,
      end: Date.now() - interval * 60 * 1000, // Avoid last open.
      limit: 500
    }
    const candlesInfo = await this.rest.getCandles(params)
    candlesInfo.result.list.reverse().forEach((ci) => {
      const [start, open, high, low, close, volume, turover] = ci
      const candle = {
        start: +start,
        open: +open,
        high: +high,
        low: +low,
        close: +close,
        volume: +volume,
        turover: +turover
      }
      this.storeCandle(candle)
    })
    this.lastCandleMsgMts = Date.now()
  }

  manageCandleMsg (msg) {
    const candleInfo = msg.data[0]
    this.lastCandleMsgMts = msg.ts
    if (!candleInfo.confirm) return false
    const { start, open, high, low, close, volume, turover } = candleInfo
    const candle = {
      start: +start,
      open: +open,
      high: +high,
      low: +low,
      close: +close,
      volume: +volume,
      turover: +turover
    }
    this.storeCandle(candle)
  }

  setOrderbook (ob) {
    if (ob?.a && ob.a[0] && +ob.a[0][1]) {
      const [priceStr, amountStr] = ob.a[0]
      this.orderbook.ask = { askAmount: +amountStr, askPrice: +priceStr }
    }
    if (ob?.b && ob.b[0] && +ob.b[0][1]) {
      const [priceStr, amountStr] = ob.b[0]
      this.orderbook.bid = { bidAmount: +amountStr, bidPrice: +priceStr }
    }
  }

  async updateOrderbook () {
    const params = {
      category: 'spot',
      symbol: this.pair,
      limit: 1
    }
    const orderbookInfo = await this.rest.getOrderBook(params)
    this.setOrderbook(orderbookInfo.result)
    this.lastOrderbookMsgMts = Date.now()
  }

  manageOrderbookMsg (msg) {
    this.setOrderbook(msg.data)
    this.lastOrderbookMsgMts = msg.ts
  }

  async updatePairTradingInfo () {
    const params = {
      category: 'spot',
      symbol: this.pair,
      status: 'Trading'
    }
    const instrumentInfo = await this.rest.getInstrumentInfo(params)
    this.tradingInfo = instrumentInfo.result.list[0]
    return this.tradingInfo
  }

  async repayLiability () {
    const params = { coin: this.asset }
    try {
      await this.rest.repay(params)
    } catch (error) {
      this.logger('error', true, error)
    }
  }

  logWSMessage (msg) {
    this.logger('log', true, `${msg.topic}`, msg.data)
  }

  getLastWallet () {
    return this.wallet
  }

  getLastCandles (amount) {
    const length = amount || this.bollingerParams.movingAverageLength
    if (Date.now() - this.lastCandleMsgMts > 600000) { // 10 min delay.
      this.logger('error', true, 'NO CANDLES UPDATES.')
      process.exit('2')
    }
    return this.candles.slice(-length)
  }

  getLastOrderbook () {
    if (Date.now() - this.lastOrderbookMsgMts > 600000) { // 10 min delay.
      this.logger('error', true, 'NO ORDERBOOKS UPDATES.')
      process.exit('2')
    }
    return this.orderbook
  }

  submitMarketOrder ({ side, amount }) {
    const order = {
      category: 'spot',
      symbol: this.pair,
      isLeverage: 1,
      side,
      orderType: 'Market',
      qty: amount.toString()
    }
    this.tradeWS.createOrder(order)
  }

  submitLimitOrder ({ side, amount, price }) {
    const order = {
      category: 'spot',
      symbol: this.pair,
      isLeverage: 1,
      side,
      orderType: 'Limit',
      qty: amount.toString(),
      price: price.toString()
    }
    this.tradeWS.createOrder(order)
  }

  updateLimitOrder (order, updateParams) {
    const { category, symbol, orderId } = order
    const updateArgs = { category, symbol, orderId, ...updateParams }
    this.tradeWS.updateOrder(updateArgs)
  }

  cancelLimitOrder (order) {
    const { category, symbol, orderId } = order
    this.logger('log', true, 'Canceling:', order)
    this.tradeWS.cancelOrder({ category, symbol, orderId })
  }
}

module.exports = {
  XchgConnect
}
