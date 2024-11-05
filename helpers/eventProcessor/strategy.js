'use strict'

// Local dependencies.
const { Bollinger } = require('./bollinger')

class Strategy {
  constructor (inputParams) {
    this.initStrategyParams(inputParams)
    this.bollinger = new Bollinger(inputParams)
    this.tradingInfo = null // Bybit limitations for trading pair.
    this.maxTradesInfo = { buy: {}, sell: {} } // From rest endpoint.
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

  setAttributesValue (attributesToValue) {
    for (const [attribute, value] of Object.entries(attributesToValue)) {
      this[attribute] = value
    }
  }

  getCloseSellOrderInfo (assetBalance) {
    // Don't check against orderbook cause market orders are 0% fee.
    const { closeSellPrice } = this.bollinger.getBollingerPrices()
    const priceTickSize = 1 / +this.tradingInfo.priceFilter.tickSize
    const price = Math.ceil(closeSellPrice * priceTickSize) / priceTickSize
    const amountBasePrec = 1 / +this.tradingInfo.lotSizeFilter.basePrecision
    const amount = Math.round(assetBalance * amountBasePrec) / amountBasePrec
    return { type: 'closeSellOrder', side: 'Sell', amount, price }
  }

  getCloseBuyOrderInfo (assetBalance) {
    // Don't check against orderbook cause market orders are 0% fee.
    // assetBalance ensured < 0.
    const { closeBuyPrice } = this.bollinger.getBollingerPrices()
    const priceTickSize = 1 / +this.tradingInfo.priceFilter.tickSize
    const price = Math.floor(closeBuyPrice * priceTickSize) / priceTickSize
    const amountBasePrec = 1 / +this.tradingInfo.lotSizeFilter.basePrecision
    const amount = -Math.round(assetBalance * amountBasePrec) / amountBasePrec
    return { type: 'closeBuyOrder', side: 'Buy', amount, price }
  }

  getCloseOrderInfo (wallet) {
    const borrowed = Object.values(wallet.coinsToWallet).reduce((p, c) => {
      return p + (+c.borrowAmount)
    }, 0)
    if (borrowed === 0) return null
    const assetBalance = +wallet.coinsToWallet[this.asset].walletBalance
    return (assetBalance > 0)
      ? this.getCloseSellOrderInfo(assetBalance)
      : this.getCloseBuyOrderInfo(assetBalance)
  }

  calcCurrencyAvailable (wallet) {
    // Get ratio in usd equivalent and apply it to balance.
    const { coinsToWallet, totalEquity } = wallet
    const assetInUsd = +coinsToWallet[this.asset].usdValue
    const assetUsdEq = Math.abs(assetInUsd) / this.leverage
    return Math.max(+totalEquity - assetUsdEq, 0)
  }

  getOpenBuyOrderInfo (currencyAvailable, orderbook) {
    const { openBuyPrice } = this.bollinger.getBollingerPrices()
    const { askPrice, askAmount } = orderbook.ask
    if (askPrice > openBuyPrice) return false
    const baseAmount = Math.min(
      currencyAvailable / askPrice * this.leverage,
      askAmount * 0.75
    )
    const amountBasePrec = 1 / +this.tradingInfo.lotSizeFilter.basePrecision
    const amount = Math.round(baseAmount * amountBasePrec) / amountBasePrec
    if (amount < +this.tradingInfo.lotSizeFilter.minOrderQty) return false
    return { type: 'openBuyOrder', side: 'Buy', amount }
  }

  getOpenSellOrderInfo (currencyAvailable, orderbook) {
    const { openSellPrice } = this.bollinger.getBollingerPrices()
    const { bidPrice, bidAmount } = orderbook.bid
    if (bidPrice < openSellPrice) return false
    const baseAmount = Math.min(
      currencyAvailable / bidPrice * this.leverage,
      bidAmount * 0.75
    )
    const amountBasePrec = 1 / +this.tradingInfo.lotSizeFilter.basePrecision
    const amount = Math.round(baseAmount * amountBasePrec) / amountBasePrec
    if (amount < +this.tradingInfo.lotSizeFilter.minOrderQty) return false
    return { type: 'openSellOrder', side: 'Sell', amount }
  }

  getOpenOrderInfo (wallet, orderbook) {
    const currencyAvailable = this.calcCurrencyAvailable(wallet)
    return (
      this.getOpenBuyOrderInfo(currencyAvailable, orderbook) ||
      this.getOpenSellOrderInfo(currencyAvailable, orderbook)
    )
  }

  getOrderNeededInfo (wallet, orderbook, candles) {
    this.bollinger.updateBollingerPrices(candles)
    return {
      openOrderInfo: this.getOpenOrderInfo(wallet, orderbook),
      closeOrderInfo: this.getCloseOrderInfo(wallet)
    }
  }
}

module.exports = {
  Strategy
}
