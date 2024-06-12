const crypto = require('crypto')

/**
 * Generates signature and string parameters for API request.
 * @param {string} apiSecret - Bybit api secret.
 * @param {object} requestParams - Request params.
 * @param {string} message - message to sign in case no request params.
 * @returns {object} - String parameters and signature.
 */
const genAuthSig = (apiSecret, requestParams, message) => {
  const sortedParams = Object.keys(requestParams).sort()
    .reduce((sorted, key) => {
      sorted[key] = requestParams[key]
      return sorted
    }, {})

  const paramString = message || new URLSearchParams(sortedParams).toString()
  const signature = crypto.createHmac('sha256', apiSecret)
    .update(paramString)
    .digest('hex')
  return { paramString, signature }
}

module.exports = genAuthSig
