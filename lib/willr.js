var talib = require('talib')

module.exports = function willr (s, key, length, time_period) {
 
  if (s.lookback.length > length) {
    // skip calculation if result already presented as we use historical data only,
    // no need to recalculate for each individual trade
    if (key in s.period) return
   
    // If the marketData was empty, create it
    if (!s.marketData) {
      s.marketData = { open: [], close: [], high: [], low: [], volume: [] }
    }
   
    // Backfill market data
    if (s.lookback.length > s.marketData.close.length) {
      for (var i = (s.lookback.length - s.marketData.close.length) - 1; i >= 0; i--) {
        s.marketData.high.push(s.lookback[i].high)
        s.marketData.low.push(s.lookback[i].low)
        s.marketData.close.push(s.lookback[i].close)
        s.marketData.volume.push(s.lookback[i].volume)
      }
    }
   
    // If we don't have enough data, return
    if (s.marketData.close.length < length) {
      return
    }

    let tmpHigh = s.marketData.high.slice()
    tmpHigh.push(s.period.high)

    let tmpLow = s.marketData.low.slice()
    tmpLow.push(s.period.low)

    let tmpClose = s.marketData.close.slice()
    tmpClose.push(s.period.close)

    let tmpVolume = s.marketData.volume.slice()
    tmpVolume.push(s.period.volume)

    talib.execute({
      name: 'WILLR',
      startIdx: 0,
      endIdx: tmpHigh.length -1,
      high: tmpHigh,
      low: tmpLow,
      close: tmpClose,
      optInTimePeriod: time_period || 14,
    }, function (err, result) {
      if (err) {
        console.log(err)
      }
      s.period[key] = result;
    })

    
  }
}

