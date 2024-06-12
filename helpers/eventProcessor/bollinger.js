'use strict'

// Local dependencies.
const { logger } = require('../logger')

class Bollinger {
  constructor (inputParams) {
    this.initBollingerParams(inputParams.bollingerParams)
    this.minSellPrice = inputParams.minSellPrice
    this.maxBuyPrice = inputParams.maxBuyPrice

    // Storage.
    this.candlesUsed = []
    this.bollingerPrices = {
      openBuyPrice: null,
      openSellPrice: null,
      closeBuyPrice: null,
      closeSellPrice: null
    }
  }

  initBollingerParams (bollingerParams) {
    this.bollingerParams = bollingerParams
    this.movAvgTf = bollingerParams.movingAverageTimeframe
    this.movAvgLength = bollingerParams.movingAverageLength
    this.movAvgSource = bollingerParams.movingAverageSource
    this.minStdConsidered = bollingerParams.minStdConsidered
    this.openBand = bollingerParams.openBollingerBand
    this.closeBand = bollingerParams.closeBollingerBand
  }

  getStandardDeviation (prices, ma) {
    const deviations = prices.map((price) => {
      return (price - ma) ** 2
    })
    const devsSum = deviations.reduce((a, b) => a + b, 0) // Array sum.
    const stdCalculated = (devsSum / deviations.length) ** 0.5
    return +Math.max(stdCalculated, this.minStdConsidered).toPrecision(7)
  }

  getStandardValues () {
    const candlesPrices = this.candlesUsed.map((c) => c[this.movAvgSource])
    const sumOfPrices = candlesPrices.reduce((a, b) => a + b, 0)
    const ma = +(sumOfPrices / candlesPrices.length).toPrecision(7)
    const std = this.getStandardDeviation(candlesPrices, ma)
    return { ma, std }
  }

  calcBollingerPrices (candles) {
    this.candlesUsed = [...candles]
    const { ma, std } = this.getStandardValues()
    const openBuyPrice = Math.min(
      +(ma - this.openBand * std).toPrecision(7),
      this.maxBuyPrice
    )
    const openSellPrice = Math.max(
      +(ma + this.openBand * std).toPrecision(7),
      this.minSellPrice
    )
    const bollingerPrices = {
      openBuyPrice,
      openSellPrice,
      closeBuyPrice: +(ma - this.closeBand * std).toPrecision(7),
      closeSellPrice: +(ma + this.closeBand * std).toPrecision(7)
    }
    const newCandle = this.candlesUsed[this.candlesUsed.length - 1]
    const newCandleDate = new Date(newCandle.start).toISOString()
    logger(
      'log',
      true,
      `NEW CANDLE: ${newCandleDate}`, newCandle,
      `\nma: ${ma} std: ${std}`,
      '\nBollingerPrices:', bollingerPrices
    )
    return bollingerPrices
  }

  updateBollingerPrices (candles) {
    const lastCandleClosed = candles[candles.length - 1]
    const lastCandleUsed = this.candlesUsed[this.candlesUsed.length - 1]
    if (
      candles.length !== this.candlesUsed.length ||
      lastCandleClosed.start > lastCandleUsed.start
    ) this.bollingerPrices = this.calcBollingerPrices(candles)
  }

  getBollingerPrices () {
    return this.bollingerPrices
  }
}

module.exports = {
  Bollinger
}
