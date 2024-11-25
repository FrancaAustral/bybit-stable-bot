'use strict'

// Local dependencies.
const { XchgConnect } = require('./exchangeConnect/exchangeConnect.js')
const { Strategy } = require('./strategy.js')

class EventProcessor extends XchgConnect {
  constructor (keys, inputParams) {
    super(keys, inputParams)
    this.strategy = new Strategy(inputParams)
    this.tradeTimeout = null // Check orders in every interval.
    this.intervalCount = 0 // Used to update exchange data.
  }

  async initTradingData () {
    await this.updateWallets()
    await this.updateCandles()
    await this.updateOrderbook()
    await this.updateLimitOrders()
    const tradingInfo = await this.updatePairTradingInfo()
    const maxTradesInfo = await this.updateMaxTradesInfo()
    this.strategy.setAttributesValue({ tradingInfo, maxTradesInfo })
  }

  async updateTradeData () {
    const maxTradesInfo = await this.updateMaxTradesInfo()
    this.strategy.setAttributesValue({ maxTradesInfo })
    if (this.intervalCount >= 6) {
      this.intervalCount = 0
      await this.updateLimitOrders()
    }
  }

  resetCheckTimeout () {
    clearTimeout(this.tradeTimeout)
    this.tradeTimeout = setTimeout(async () => {
      try {
        await this.updateTradeData()
      } catch (e) {
        this.logger('error', true, 'Interval error:', e.message, e.stack)
      }
      this.intervalCount++
      this.checkOrders()
    }, Math.floor((Math.random() * (12 - 8) + 8)) * 1000) // 8 to 12 seconds.
  }

  createOpenOrder (openOrderInfo, orderbook) {
    const msg = ['NEW OPEN ORDER INFO:', openOrderInfo, '\nob:', orderbook]
    this.logger('log', true, ...msg)
    this.submitMarketOrder(openOrderInfo)
  }

  getUpdateQty (amount, order) {
    const amountBasePrec = 1 / +this.tradingInfo.lotSizeFilter.basePrecision
    const baseAmount = (+order.cumExecQty) + amount
    return Math.round(baseAmount * amountBasePrec) / amountBasePrec
  }

  verifyCloseOrder (closeOrderInfo, orderbook) {
    const { side, amount, price } = closeOrderInfo
    if (amount < +this.tradingInfo.lotSizeFilter.minOrderQty) {
      this.logger('log', true, `REPAY: ${amount}`)
      return this.repayLiability()
    }
    if (!this.closeOrder) {
      const n = ['NEW CLOSE ORDER INFO:', closeOrderInfo, '\nob:', orderbook]
      this.logger('log', true, ...n)
      return this.submitLimitOrder(closeOrderInfo)
    }
    if (side !== this.closeOrder.side) {
      const c = ['WRONG ORDER SIDE:', this.closeOrder, closeOrderInfo]
      this.logger('log', 'error', ...c)
      return this.cancelLimitOrder(this.closeOrder) // Just in case.
    }
    const updateParams = {}
    if (amount !== +this.closeOrder.leavesQty) {
      const qty = this.getUpdateQty(amount, this.closeOrder)
      updateParams.qty = qty.toString()
    }
    if (price !== +this.closeOrder.price) updateParams.price = price.toString()
    if (Object.keys(updateParams).length) {
      const m = ['UPDATE CLOSE ORDER INFO:', closeOrderInfo, '\nob:', orderbook]
      this.logger('log', true, ...m)
      return this.updateLimitOrder(this.closeOrder, updateParams)
    }
  }

  checkOrders () {
    try {
      const orderbook = this.getLastOrderbook()
      if (!orderbook) return false
      const candles = this.getLastCandles()
      const wallet = this.getLastWallet()
      const {
        openOrderInfo,
        closeOrderInfo
      } = this.strategy.getOrderNeededInfo(wallet, orderbook, candles)
      if (openOrderInfo) return this.createOpenOrder(openOrderInfo, orderbook)
      if (closeOrderInfo) this.verifyCloseOrder(closeOrderInfo, orderbook)
    } catch (e) {
      this.logger('error', true, 'Check orders error:', e.message, e.stack)
    } finally {
      this.resetCheckTimeout()
    }
  }
}

module.exports = {
  EventProcessor
}
