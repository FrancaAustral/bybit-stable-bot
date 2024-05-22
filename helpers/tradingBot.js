'use strict'

// Local dependencies.
const { EventProcessor } = require('./eventProcessor/eventProcessor.js')

class TradingBot extends EventProcessor {
  subscribeNecessaryChannels () {
    this.publicWS.subscribe(
      `orderbook.1.${this.pair}`,
      {},
      this.manageOrderbookMsg.bind(this)
    )

    this.publicWS.subscribe(
      `kline.${this.bollingerParams.movingAverageTimeframe}.${this.pair}`,
      {},
      this.manageCandleMsg.bind(this)
    )

    this.privateWS.subscribe('wallet', {}, this.manageWalletMsg.bind(this))
    this.privateWS.subscribe('execution.spot', {}, this.logWSMessage.bind(this))
    this.privateWS.subscribe('order.spot', {}, this.logWSMessage.bind(this))
  }

  async startWSConnections () {
    await this.publicWS.open()
    await this.privateWS.open()
    await this.tradeWS.open()
    this.subscribeNecessaryChannels()
  }

  async startTrading () {
    await this.initTradingData()
    await this.startWSConnections()
    this.checkOrders()
  }
}

module.exports = {
  TradingBot
}
