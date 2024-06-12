'use strict'

// Local dependencies.
const { Bollinger } = require('./bollinger')

class Strategy {
  constructor (inputParams) {
    this.initStrategyParams(inputParams)
    this.bollinger = new Bollinger(inputParams)
    this.tradingInfo = null // Bybit limitations for trading pair.
  }

  initStrategyParams (inputParams) {
    this.currency = inputParams.currency
    this.asset = inputParams.asset
    this.pair = inputParams.pair
    this.bollingerParams = inputParams.bollingerParams
    this.minSellPrice = inputParams.minSellPrice
    this.maxBuyPrice = inputParams.maxBuyPrice
    this.maxAssetBalance = inputParams.maxAssetBalance
    this.leverage = inputParams.leverage
  }

  setTradingInfo (tradingInfo) {
    this.tradingInfo = tradingInfo
  }

  getCloseSellOrderInfo (assetBalance, ordebook) {
    const { closeSellPrice } = this.bollinger.getBollingerPrices()
    const { bidPrice } = ordebook.bid
    const amount = Math.round(assetBalance * 100) / 100
    return (bidPrice >= closeSellPrice)
      ? { type: 'closeSellOrder', side: 'Sell', amount }
      : false
  }

  getCloseBuyOrderInfo (assetBalance, ordebook) {
    const { closeBuyPrice } = this.bollinger.getBollingerPrices()
    const { askPrice } = ordebook.ask
    const amount = -Math.round(assetBalance * 100) / 100
    return (askPrice <= closeBuyPrice)
      ? { type: 'closeBuyOrder', side: 'Buy', amount }
      : false
  }

  getCloseOrderInfo (wallet, ordebook) {
    const assetBalance = +wallet.coinsToWallet[this.asset].walletBalance
    if (Math.abs(assetBalance) < +this.tradingInfo.lotSizeFilter.minOrderQty) {
      return false
    }
    return (assetBalance > 0)
      ? this.getCloseSellOrderInfo(assetBalance, ordebook)
      : this.getCloseBuyOrderInfo(assetBalance, ordebook)
  }

  calcCurrencyAvailable (wallet) {
    // Get ratio un usd equivalent and apply it to balance.
    const { coinsToWallet, totalMarginBalance } = wallet
    const assetUsdEq = Math.abs(coinsToWallet[this.asset].usdValue)
    const maxUsdEqToTrade = totalMarginBalance * this.leverage
    const availableRatio = (maxUsdEqToTrade - assetUsdEq) / maxUsdEqToTrade
    return Math.max(availableRatio * totalMarginBalance, 0)
  }

  getOpenBuyOrderInfo (currencyAvailable, ordebook) {
    const { openBuyPrice } = this.bollinger.getBollingerPrices()
    const { askPrice, askAmount } = ordebook.ask
    if (askPrice > openBuyPrice) return false
    const baseAmount = Math.min(
      currencyAvailable / askPrice * this.leverage,
      askAmount * 0.75
    )
    const amount = Math.round(baseAmount * 100) / 100
    if (amount < +this.tradingInfo.lotSizeFilter.minOrderQty) return false
    return { type: 'openBuyOrder', side: 'Buy', amount }
  }

  getOpenSellOrderInfo (currencyAvailable, ordebook) {
    const { openSellPrice } = this.bollinger.getBollingerPrices()
    const { bidPrice, bidAmount } = ordebook.bid
    if (bidPrice < openSellPrice) return false
    const baseAmount = Math.min(
      currencyAvailable / bidPrice * this.leverage,
      bidAmount * 0.75
    )
    const amount = Math.round(baseAmount * 100) / 100
    if (amount < +this.tradingInfo.lotSizeFilter.minOrderQty) return false
    return { type: 'openSellOrder', side: 'Sell', amount }
  }

  getOpenOrderInfo (wallet, ordebook) {
    const currencyAvailable = this.calcCurrencyAvailable(wallet)
    return (
      this.getOpenBuyOrderInfo(currencyAvailable, ordebook) ||
      this.getOpenSellOrderInfo(currencyAvailable, ordebook)
    )
  }

  getOrderNeededData (wallet, ordebook, candles) {
    // Returns { type, side, amount }.
    this.bollinger.updateBollingerPrices(candles)
    return (
      this.getCloseOrderInfo(wallet, ordebook) || // Prioritize close.
      this.getOpenOrderInfo(wallet, ordebook)
    )
  }
}

module.exports = {
  Strategy
}
