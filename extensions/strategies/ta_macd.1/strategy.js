var z = require('zero-fill')
  , n = require('numbro')
  , rsi = require('../../../lib/rsi')
  , ta_macd = require('../../../lib/ta_macd')
  , Phenotypes = require('../../../lib/phenotype')

module.exports = {
  name: 'ta_macd',
  description: 'Buy when (MACD - Signal > 0) and sell when (MACD - Signal < 0).',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '10s')
    this.option('period_length', 'period length, same as --period', String, '10s')
    this.option('min_periods', 'min. number of history periods', Number, 90)

    this.option('ema_short_period', 'number of periods for the shorter EMA', Number, 24)
    this.option('ema_long_period', 'number of periods for the longer EMA', Number, 84)
    this.option('signal_period', 'number of periods for the signal EMA', Number, 30)

    this.option('overbought_rsi_periods', 'number of periods for overbought RSI', Number, 40)

    this.option('oversold_rsi_macdneg', 'sold when RSI exceeds this value', Number, 40)
    this.option('overbought_rsi_macdneg', 'sell when RSI exceeds this value', Number, 55)

    this.option('oversold_rsi_macdpos', 'sold when RSI exceeds this value', Number, 55)
    this.option('overbought_rsi_macdpos', 'sell when RSI exceeds this value', Number, 65)
  },

  calculate: function (s) {
   
    rsi(s, 'overbought_rsi', s.options.overbought_rsi_periods)
    // if (s.options.overbought_rsi) {
    //   // sync RSI display with overbought RSI periods
    //   s.options.rsi_periods = s.options.overbought_rsi_periods
    //   rsi(s, 'overbought_rsi', s.options.overbought_rsi_periods)
    //   if (!s.in_preroll && s.period.overbought_rsi >= s.options.overbought_rsi && !s.overbought) {
    //     s.overbought = true
    //     if (s.options.mode === 'sim' && s.options.verbose) console.log(('\noverbought at ' + s.period.overbought_rsi + ' RSI, preparing to sold\n').cyan)
    //   }
    // }
  },

  onPeriod: function (s, cb) {
    
    ta_macd(s, s.options.ema_long_period, s.options.ema_short_period, s.options.signal_period).then(function(signal) {
      if(!signal) {
        cb()
        return
      }

      var rsi = s.period.overbought_rsi;
      
      var macd = signal.macd;
      var macd_signal = signal.macd_signal;
      var macd_prev = s.lookback[0].macd;
      var macd_signal_prev = s.lookback[0].macd_signal;
      var macd_prev3 = s.lookback[3].macd;

      var deltaMacd = (macd - macd_signal);
      var deltaMacdPrev = (macd_prev - macd_signal_prev); 
      var deltaMacdIndicator = ((deltaMacd < deltaMacdPrev) && (macd < macd_prev3)) ? 'bad' : ((deltaMacd > deltaMacdPrev) && (macd > macd_prev3)) ? 'good' : '';

      s.period['macd'] = macd; 
      s.period['macd_signal'] = macd_signal;
      s.period['deltaMacdIndicator'] = deltaMacdIndicator;
      
      if (typeof rsi === 'number' && typeof macd === 'number' && typeof macd_prev === 'number' ) {
        if(macd < 0 && rsi < 30 && deltaMacdIndicator == 'good'){
          s.signal = 'buy';
        }
        else if(macd < 0 && rsi >= 55 && deltaMacdIndicator == 'bad'){
          s.signal = 'sell';
        } 
        if(macd > 0 && rsi < 55 && deltaMacdIndicator == 'good'){
          s.signal = 'buy';
        }
        else if(macd > 0 && rsi >= 60 && deltaMacdIndicator == 'bad'){
          s.signal = 'sell';
        } 
        else {
          s.signal = null  // hold
        }
      }
      cb()
    }).catch(function(error) {
      console.log(error)
      cb()
    })

  },

  onReport: function (s) {
    var cols = []
    if (typeof s.period.macd === 'number') {
      cols.push(z(8, 'RSI:' + n(s.period.overbought_rsi).format('00') + ' ', ' ').cyan)
      cols.push(z(8, 'Div:' + s.period.deltaMacdIndicator + ' ', ' ').cyan)
      cols.push(z(8, 'Signal:' + (s.period.macd < 0 ? '(-) ' : '(+) '), ' ').cyan)
      cols.push(z(8, 'Macd:' + n(s.period.macd).format('0.00000') + ' ', ' ').cyan)
      cols.push(z(8, 'MacdSignal:' + n(s.period.macd_signal).format('0.00000'), ' ').cyan)
    }
    else {
      cols.push('         ')
    }
    return cols
  },

  phenotypes: {
    // -- common
    period_length: Phenotypes.RangePeriod(1, 120, 'm'),
    min_periods: Phenotypes.Range(1, 200),
    markdown_buy_pct: Phenotypes.RangeFloat(-1, 5),
    markup_sell_pct: Phenotypes.RangeFloat(-1, 5),
    order_type: Phenotypes.ListOption(['maker', 'taker']),
    sell_stop_pct: Phenotypes.Range0(1, 50),
    buy_stop_pct: Phenotypes.Range0(1, 50),
    profit_stop_enable_pct: Phenotypes.Range0(1, 20),
    profit_stop_pct: Phenotypes.Range(1,20),

    // -- strategy
    // have to be minimum 2 because talib will throw an "TA_BAD_PARAM" error
    ema_short_period: Phenotypes.Range(2, 20),
    ema_long_period: Phenotypes.Range(20, 100),
    signal_period: Phenotypes.Range(1, 20),
    overbought_rsi_periods: Phenotypes.Range(1, 50),
    overbought_rsi: Phenotypes.Range(20, 100)
  }
}
