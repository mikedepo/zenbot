let z = require('zero-fill'),
  n = require('numbro'),
  ta_stoch = require('../../../lib/ta_stoch'),
  ta_bollinger = require('../../../lib/ta_bollinger'),
  Phenotypes = require('../../../lib/phenotype')

module.exports = {
  name: 'ta_stoch_bollinger',
  description: 'Stochastic BollingerBand Strategy',

  getOptions: function() {
    this.option('period', 'period length, same as --period_length', String, '10s')
    this.option('period_length', 'period length, same as --period', String, '10s')
    this.option('min_periods', 'min. number of history periods', Number, 120)

    // this.option('rsi_periods', 'Time period for building the Fast-K line', Number, 14)
    this.option('stoch_periods', 'Time period for building the Fast-K line', Number, 14)
    this.option('stoch_k', 'Smoothing for making the Slow-K line. Usually set to 3', Number, 3)
    this.option('stoch_k_ma_type', 'Type of Moving Average for Slow-K : SMA,EMA,WMA,DEMA,TEMA,TRIMA,KAMA,MAMA,T3', String, 'SMA'),
    this.option('stoch_d', 'Smoothing for making the Slow-D line', Number, 3)
    this.option('stoch_d_ma_type', 'Type of Moving Average for Slow-D : SMA,EMA,WMA,DEMA,TEMA,TRIMA,KAMA,MAMA,T3', String, 'SMA'),
    this.option('stoch_k_sell', 'K must be above this before selling', Number, 70)
    this.option('stoch_k_buy', 'K must be below this before buying', Number, 15)

    this.option('bollinger_size', 'period size', Number, 20)
    this.option('bollinger_updev', '', Number, 1.7)
    this.option('bollinger_dndev', '', Number, 1.7)
    this.option('bollinger_dType', 'mode: : SMA,EMA,WMA,DEMA,TEMA,TRIMA,KAMA,MAMA,T3', String, 'SMA')
    this.option('bollinger_upper_bound_pct', 'pct the current price should be near the bollinger upper bound before we sell', Number, 0)
    this.option('bollinger_lower_bound_pct', 'pct the current price should be near the bollinger lower bound before we buy', Number, 0)


  },

  calculate: function(s) {
    if (s.in_preroll) return
  },

  onPeriod: function(s, cb) {
    //make sure we have all values
    if (s.in_preroll) return cb()
    ta_bollinger(s, 'tabollinger', s.options.bollinger_size, s.options.bollinger_updev, s.options.bollinger_dndev, s.options.bollinger_dType)
    .then(function(inbol) {
      ta_stoch(s, 'stoch', s.options.stoch_periods, s.options.stoch_k, s.options.stoch_k_ma_type, s.options.stoch_d, s.options.stoch_d_ma_type)
      .then(function(inres) {
        if (!inres) return cb()
        var divergent = inres.k[inres.k.length - 1] - inres.d[inres.k.length - 1]
        s.period.stoch_D = inres.d[inres.d.length - 1]
        s.period.stoch_K = inres.k[inres.k.length - 1]
        var last_divergent = inres.k[inres.k.length - 2] - inres.d[inres.d.length - 2]
        var _switch = 0
        var nextdivergent = ((divergent + last_divergent) / 2) + (divergent - last_divergent)
        if (last_divergent <= 0 && divergent > 0) {
          _switch = 1 // price rising
        }
        if (last_divergent >= 0 && divergent < 0) {
          _switch = -1 // price falling
        }

        s.period.divergent = divergent
        s.period._switch = _switch

        let upperBound = inbol.outRealUpperBand[inbol.outRealUpperBand.length - 1]
        let lowerBound = inbol.outRealLowerBand[inbol.outRealLowerBand.length - 1]
        let midBound = inbol.outRealMiddleBand[inbol.outRealMiddleBand.length - 1]
        if (!s.period.bollinger) {
          s.period.bollinger = {}
        }

        s.period.bollinger.upperBound = upperBound
        s.period.bollinger.lowerBound = lowerBound
        s.period.bollinger.midBound = midBound

        // K is fast moving

        s.signal = null
        if (_switch != 0) {
          if (s.period.close >= midBound
            && Math.max(s.period.close, s.period.open) >= (upperBound / 100) * (100 + s.options.bollinger_upper_bound_pct)
            && nextdivergent < divergent 
            && _switch == -1 
				    && s.period.stoch_K > s.options.stoch_k_sell)
          {
            s.signal = 'sell'
          } else if (Math.min(s.period.close, s.period.open) <= (lowerBound / 100) * (100 + s.options.bollinger_lower_bound_pct)
            && nextdivergent > divergent 
            && _switch == 1 
			  	  && s.period.stoch_K < s.options.stoch_k_buy)
          {
            s.signal = 'buy'
          }
        }
        cb()
      }).catch(function() {
        cb()
      })
    }).catch(function() {
      cb()
    })
  },

  onReport: function(s) {
    var cols = []
    if (s.period.bollinger) {
      if (s.period.bollinger.upperBound && s.period.bollinger.lowerBound) {
        let upperBound = s.period.bollinger.upperBound
        let lowerBound = s.period.bollinger.lowerBound
        var colorBollinger = 'grey'
        if (Math.max(s.period.close, s.period.open) > (upperBound / 100) * (100 + s.options.bollinger_upper_bound_pct)) {
          colorBollinger = 'red'
        }
        if (Math.min(s.period.close, s.period.open) < (lowerBound / 100) * (100 - s.options.bollinger_lower_bound_pct)) {
          colorBollinger = 'green'
        }

        var colorStoch = 'grey'
        if(s.period.stoch_K < s.options.stoch_k_buy)
        {
          colorStoch = "green"
        }
        else if(s.period.stoch_K > s.options.stoch_k_sell){
          colorStoch = "red"
        }

        var colorSwitch = s.period._switch < 0 ? "red" : s.period._switch > 0 ? "green" : "grey";

        cols.push(z(8, n(lowerBound).format('0.0000').substring(0, 7), ' ').cyan)
        cols.push(z(8, n(s.period.close).format('+00.0000'), ' ')[colorBollinger])
        cols.push(z(8, n(upperBound).format('0.0000').substring(0, 7), ' ').cyan)

        cols.push(z(8, n(s.period.stoch_D).format('0.0000').substring(0, 7), ' ').cyan)
        cols.push(z(8, n(s.period.stoch_K).format('0.0000').substring(0, 7), ' ')[colorBollinger])
        cols.push(z(5, n(s.period.divergent).format('0').substring(0, 7), ' ').yellow)
        cols.push(z(2, n(s.period._switch).format('0').substring(0, 2), ' ')[colorSwitch])
      }
    } else {
      cols.push('         ')
    }
    return cols
  },

  phenotypes: {
    // -- common
    period_length: Phenotypes.ListOption(['1m', '2m', '3m', '4m', '5m', '10m', '15m']),
    min_periods: Phenotypes.Range(52, 150),
    markdown_buy_pct: Phenotypes.RangeFactor(-1.0, 1.0, 0.1),
    markup_sell_pct: Phenotypes.RangeFactor(-1.0, 1.0, 0.1),
    order_type: Phenotypes.ListOption(['maker', 'taker']),
    sell_stop_pct: Phenotypes.RangeFactor(0.0, 50.0, 0.1),
    buy_stop_pct: Phenotypes.RangeFactor(0.0, 50.0, 0.1),
    profit_stop_enable_pct: Phenotypes.RangeFactor(0.0, 5.0, 0.1),
    profit_stop_pct: Phenotypes.RangeFactor(0.0, 50.0, 0.1),

    // -- strategy
    // rsi_periods: Phenotypes.Range(10, 30),
    stoch_periods: Phenotypes.Range(5, 30),
    stoch_k: Phenotypes.Range(1, 10),
    stoch_k_ma_type: Phenotypes.ListOption(['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'TRIMA', 'KAMA', 'MAMA', 'T3']),
    stoch_d: Phenotypes.Range(1, 10),
    stoch_k_sell: Phenotypes.RangeFactor(0.0, 100.0, 1.0),
    stoch_k_buy: Phenotypes.RangeFactor(0.0, 100.0, 1.0),
    stoch_d_ma_type: Phenotypes.ListOption(['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'TRIMA', 'KAMA', 'MAMA', 'T3']),

    bollinger_size: Phenotypes.RangeFactor(10, 25, 1),
    bollinger_updev: Phenotypes.RangeFactor(1, 3.0, 0.1),
    bollinger_dndev: Phenotypes.RangeFactor(1, 3.0, 0.1),
    bollinger_dType: Phenotypes.ListOption(['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'TRIMA', 'KAMA', 'MAMA', 'T3']),
    bollinger_upper_bound_pct: Phenotypes.RangeFactor(0.0, 100.0, 1.0),
    bollinger_lower_bound_pct: Phenotypes.RangeFactor(0.0, 100.0, 1.0)
  }
}
