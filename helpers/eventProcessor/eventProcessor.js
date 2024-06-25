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

  repayLiabilityIfNecessary (wallet) {
    // Repay liability in case amount smaller than min order amount.
    // Happens in asset borrowings when close order bot fullfilled.
    const borrowed = Math.abs(
      +wallet.coinsToWallet[this.asset].borrowAmount
    )
    const minOrderQty = +this.tradingInfo.lotSizeFilter.minOrderQty
    if (borrowed > 0 && borrowed < minOrderQty) {
      this.logger('log', true, `REPAY: ${borrowed}`)
      this.repayLiability()
    }
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

  checkOrders (input) {
    try {
      const ordebook = this.getLastOrderbook()
      const candles = this.getLastCandles()
      const wallet = this.getLastWallet()
      const orderInfo = this.strategy.getOrderNeededData(
        wallet,
        ordebook,
        candles
      )
      if (!orderInfo) return this.repayLiabilityIfNecessary(wallet)
      this.logger('log', true, 'NEW ORDER INFO:', orderInfo, '\nob:', ordebook)
      this.submitMarketOrder(orderInfo)
    } catch (error) {
      this.logger('log', 'error', error)
    } finally {
      this.resetCheckTimeout()
    }
  }
}

module.exports = {
  EventProcessor
}
