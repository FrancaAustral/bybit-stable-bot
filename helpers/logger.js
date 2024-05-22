'use strict'

/**
 * @param {string} type - 'log' or 'error'
 * @param {boolean} withDate - choose to log date or not.
 * @param {...any} params - data to print.
 */
function logger (type, withDate, ...params) {
  if (process.env.IS_TEST) return
  const parseParams = params.map((p) => {
    const isObject = (typeof p === 'object') && (p !== null)
    return (Array.isArray(p) || isObject) ? JSON.stringify(p) : p
  })
  const print = (type === 'log') ? console.log : console.error
  if (withDate) print(`----------\n${new Date().toUTCString()}`, Date.now())
  if (params[0]) print(...parseParams)
}

module.exports = {
  logger
}
