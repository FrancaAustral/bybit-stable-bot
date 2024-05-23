'use strict'

// Standard dependencies.
const { EventEmitter } = require('events')

// Local depencencies.
const genAuthSig = require('../util/genAuthSig')
const { logger } = require('../../../../../logger')

// Third-party dependencie.
const WebSocket = require('ws')

class BybitWSV5 extends EventEmitter {
  constructor ({ apiKey, apiSecret, type, reconnect, name, useTestnet }) {
    super()
    const baseURLs = {
      public: (useTestnet)
        ? 'wss://stream-testnet.bybit.com/v5/public/spot'
        : 'wss://stream.bybit.com/v5/public/spot',
      private: (useTestnet)
        ? 'wss://stream-testnet.bybit.com/v5/private'
        : 'wss://stream.bybit.com/v5/private',
      trade: (useTestnet)
        ? 'wss://stream-testnet.bybit.com/v5/trade'
        : 'wss://stream.bybit.com/v5/trade'
    }

    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.authArgs = (apiKey && apiSecret) ? { apiKey, apiSecret } : null
    this.baseURL = baseURLs[type]
    this.name = name || type
    this.reconnect = reconnect
    this.reconnectDelay = 2000
    this.pingIntervalDelay = 20000
    this.pongDelayAllowed = 5000
    this.pingTimeout = null // Sends ping message.
    this.pongTimeout = null // Set ws.terminate in case pong not received.
    this.reconnectTimeout = null

    // Storage.
    this._ws = null
    this._subscriptions = {} // { ..., topic: cb, ...}
    this._prevSubscriptions = null

    // State attributes.
    this._isOpen = false
    this._isClosing = false // No reconnect in case user close connection.
    this._isAuthenticated = false

    // Event callbacks.
    this._onWSOpen = this._onWSOpen.bind(this)
    this._onWSMessage = this._onWSMessage.bind(this)
    this._onWSError = this._onWSError.bind(this)
    this._onWSClose = this._onWSClose.bind(this)
  }

  open () {
    if (this._isOpen || this._ws !== null) {
      throw new Error(`Websocket already open - ${this.name}`)
    }

    this._ws = new WebSocket(this.baseURL)

    this._subscriptions = {}

    this._ws.on('close', this._onWSClose)
    this._ws.on('error', this._onWSError)
    this._ws.on('message', this._onWSMessage)
    this._ws.on('subscribed', (msg) => {
      logger('log', true, `Subscribed ${msg} - ${this.name}`)
    })

    return new Promise((resolve) => {
      this._ws.on('open', () => {
        this._onWSOpen()
        resolve() // Resolves after 'open' is received to ensure connection.
      })
    })
  }

  async _onWSOpen () {
    logger('log', true, `Websocket connection open - ${this.name}`)
    this._isOpen = true
    this.emit('open')
    this.resetPingPong()
    if (this.authArgs) {
      await this.authenticate()
    }
    if (this._prevSubscriptions) {
      this.resubscribe()
      this._prevSubscriptions = null
    }
  }

  _onWSMessage (data) {
    const msg = JSON.parse(data)
    if (msg.retCode) logger('error', true, msg)
    if (msg.op === 'ping' || msg.op === 'pong') return this.resetPingPong()
    if (msg.op === 'subscribe') return this.emit('subcribe', msg.conn_id)

    this.emit('message', msg)
    const subsCb = this._subscriptions[msg.topic]
    if (subsCb) subsCb(msg)
  }

  _onWSClose (reason) {
    logger('log', true, `Websocket connection closed: ${reason} - ${this.name}`)
    this.cleanTimers()
    this._isOpen = false
    this._ws = null
    this.emit('close')
    if (this.reconnect && !this._isClosing) this.reconnectAfterClose()
    this._isClosing = false
  }

  _onWSError (error) {
    logger('error', true, 'Websocket error:', error)
    this.emit('error', error)
  }

  resetPingPong () {
    clearTimeout(this.pongTimeout)
    this.pingTimeout = setTimeout(() => {
      if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
        throw new Error(`Websocket not ready to ping - ${this.name}`)
      }
      this.send({ op: 'ping' })
      this.pongTimeout = setTimeout(() => {
        logger('error', true, `No pong received - ${this.name}.`)
        this._ws.terminate()
      }, this.pongDelayAllowed)
    }, this.pingIntervalDelay)
  }

  reconnectAfterClose () {
    if (this.reconnectTimeout) return
    this._prevSubscriptions = { ...this._subscriptions }

    this.reconnectTimeout = setTimeout(() => {
      this.emit('reconnect')
      this.open()
      this.reconnectTimeout = null
    }, this.reconnectDelay)
  }

  resubscribe () {
    for (const [topic, cb] of Object.entries(this._prevSubscriptions)) {
      this.subscribe(topic, cb)
    }
  }

  subscribe (topic, params, cb) {
    const msg = {
      op: 'subscribe',
      args: [topic, ...Object.values(params)]
    }
    this.send(msg)
    this._subscriptions[topic] = cb
  }

  unsubscribe (topic) {
    const msg = {
      op: 'unsubscribe',
      args: [topic]
    }
    this.send(msg)
    delete this._subscriptions[topic]
  }

  authenticate () {
    const expires = Date.now() + 10000
    const message = `GET/realtime${expires}`
    const { signature } = genAuthSig(this.apiSecret, {}, message)
    const authMessage = {
      op: 'auth',
      args: [this.apiKey, expires, signature]
    }
    this.send(authMessage)

    return new Promise((resolve) => {
      this._ws.once('auth', (data) => {
        const message = JSON.parse(data)
        if (message.op === 'auth' && message.retCode === 0) {
          this._isAuthenticated = true
          logger(
            'log',
            true,
            `Websocket connection authenticated - ${this.name}`
          )
          resolve()
        }
      })
    })
  }

  /**
   * See for further explanation or more order parameters available:
   * bybit-exchange.github.io/docs/v5/order/create-order#request-parameters
   * (r) requested.
   * @param {object} order - Order object.
   * @param {string} category - Unified account: spot, linear, inverse, option.
   * 'spot' as default.
   * @param {string} symbol - (r) Symbol name.
   * @param {number} isLeverage - 0 spot, 1 margin. Default 0 by bybit.
   * @param {string} side - (r) Buy or Sell.
   * @param {string} orderType - (r) Market or Limit.
   * @param {string} qty - (r) Order quantity.
   * @param {string} price - Order Price.Market order will ignore this field.
   */
  createOrder (order) {
    const orderMessage = {
      header: {
        'X-BAPI-TIMESTAMP': Date.now().toString()
      },
      op: 'order.create',
      args: [order]
    }

    this.send(orderMessage)
  }

  send (msg) {
    if (
      !this._ws ||
      !this._isOpen ||
      this._ws.readyState !== WebSocket.OPEN
    ) {
      this.emit('error', new Error(`No ws client or not open - ${this.name}`))
    } else if (this._isClosing) {
      this.emit('error', new Error(`Connection closing - ${this.name}`))
    } else {
      this._ws.send(JSON.stringify(msg))
    }
  }

  close () {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      logger('log', true, `Websocket not open - ${this.name}`)
      return
    }
    this._isClosing = true
    this.cleanTimers()
    this._ws.close()
  }

  cleanTimers () {
    clearTimeout(this.pingTimeout)
    clearTimeout(this.pongTimeout)
    clearTimeout(this.reconnectTimeout)
  }
}

module.exports = {
  BybitWSV5
}
