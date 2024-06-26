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
    this.strategy.setTradingInfo(tradingInfo)
  }

  resetCheckTimeout () {
    clearTimeout(this.tradeTimeout)
    this.tradeTimeout = setTimeout(async () => {
      if (this.intervalCount >= 6) {
        this.intervalCount = 0
        try {
          await this.updateLimitOrders()
        } catch (e) {
          this.logger('error', true, 'Interval error:', e.message, e.stack)
        }
      }
      this.intervalCount++
      this.checkOrders('Interval check.')
    }, Math.floor((Math.random() * (12 - 8) + 8)) * 1000) // 8 to 12 seconds.
  }

  createOpenOrder (openOrderInfo, ordebook) {
    const msg = ['NEW OPEN ORDER INFO:', openOrderInfo, '\nob:', ordebook]
    this.logger('log', true, ...msg)
    this.submitMarketOrder(openOrderInfo)
  }

  verifyCloseOrder (closeOrderInfo, ordebook) {
    const { side, amount, price } = closeOrderInfo
    if (amount < +this.tradingInfo.lotSizeFilter.minOrderQty) {
      this.logger('log', true, `REPAY: ${amount}`)
      return this.repayLiability()
    }
    if (!this.closeOrder) {
      const n = ['NEW CLOSE ORDER INFO:', closeOrderInfo, '\nob:', ordebook]
      this.logger('log', true, ...n)
      return this.submitLimitOrder(closeOrderInfo)
    }
    if (side !== this.closeOrder.side) {
      const c = ['WRONG ORDER SIDE:', this.closeOrder, closeOrderInfo]
      this.logger('log', 'error', ...c)
      return this.cancelLimitOrder(this.closeOrder) // Just in case.
    }
    const updateParams = {}
    if (amount !== +this.closeOrder.qty) updateParams.qty = amount.toString()
    if (price !== +this.closeOrder.price) updateParams.price = price.toString()
    if (Object.keys(updateParams).length) {
      const m = ['UPDATED CLOSE ORDER INFO:', closeOrderInfo, '\nob:', ordebook]
      this.logger('log', true, ...m)
      return this.updateLimitOrder(this.closeOrder, updateParams)
    }
  }

  checkOrders () {
    try {
      const ordebook = this.getLastOrderbook()
      const candles = this.getLastCandles()
      const wallet = this.getLastWallet()
      const {
        openOrderInfo,
        closeOrderInfo
      } = this.strategy.getOrderNeededInfo(wallet, ordebook, candles)
      if (openOrderInfo) return this.createOpenOrder(openOrderInfo, ordebook)
      if (closeOrderInfo) this.verifyCloseOrder(closeOrderInfo, ordebook)
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
