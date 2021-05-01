// Presets 
// zenbot sim binance.STMX-USDT --strategy mike_1 --days 1 --period 1m --period_length 1m --bollinger_size 15 --bollinger_time 1 --bollinger_d_ma_type SMA --bollinger_upper_bound_pct 25 --bollinger_lower_bound_pct 0 --william_periods_count 100 --william_time_period 1 --william_threshold_buy -73

let z = require('zero-fill')
  , n = require('numbro')
  , willr = require('../../../lib/willr')
  , ta_bollinger = require('../../../lib/ta_bollinger')
  , Phenotypes = require('../../../lib/phenotype')
module.exports = {
  name: 'Bollinger Mesa William',
  description: 'Buy on a uptrend, sell on a bollinger',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '1m')
    this.option('period_length', 'period length, same as --period', String, '1m')
    
    // Bollinger
    this.option('bollinger_size', 'Bollinger: period size', Number, 20)
    this.option('bollinger_time', 'Bollinger: times of standard deviation between the upper band and the moving averages', Number, 2)
    this.option('bollinger_upper_bound_pct', 'Bollinger: pct the current price should be near the bollinger upper bound before we sell', Number, 0)
    this.option('bollinger_lower_bound_pct', 'Bollinger: pct the current price should be near the bollinger lower bound before we buy', Number, 0)
    this.option('bollinger_d_ma_type', 'Bollinger: Type of Moving Average', String, "SMA")

    // William %R
    this.option('william_periods_count', 'WillR: Periods Count', Number, 100);
    this.option('william_time_period', 'WillR: Chart period', Number, 1)
    this.option('william_threshold_buy', 'WillR; Threshold Buy', Number, -73)
  },


  calculate: function (s) {
    if (s.in_preroll) return

    // calculate Bollinger Bands
    ta_bollinger(s, 'bollinger', s.options.bollinger_size, s.options.bollinger_upper_bound_pct, s.options.bollinger_lower_bound_pct, s.options.bollinger_d_ma_type  )
    // willr(s, "willr1", s.options.william_periods_count, s.options.william_time_period);  
  },

  onPeriod: function (s, cb) {
    //make sure we have all values
    if (s.in_preroll) return cb();

    // WillR
     var willrResult = null;
    // if (s.period.willr1) {
    //   if (s.period.willr1) {
    //     if (s.period.willr1 <= s.options.william_threshold_buy) {
    //       willrResult = "buy";
    //     } else {
    //       willrResult = null // hold
    //     }
    //   }
    // }

    var bollingerResult = null;
    // Bollinger
    if (s.period.bollinger) {
      if (s.period.bollinger.upperBound && s.period.bollinger.lowerBound) {
        let upperBound = s.period.bollinger.upperBound
        let lowerBound = s.period.bollinger.lowerBound
        if (s.period.close > (upperBound / 100) * (100 - s.options.bollinger_upper_bound_pct)) {
          bollingerResult = "sell";
        } else if (s.period.close < (lowerBound / 100) * (100 + s.options.bollinger_lower_bound_pct)) {
          bollingerResult = 'buy'
        } else {
          bollingerResult = null // hold
        }
      }
    } //END Bollinger

    if(bollingerResult == "sell"){
      s.signal = "sell";
    } 
    else if(bollingerResult == "buy" && willrResult == "buy"){
      s.signal = "buy";
    }
    else {
      s.signal = null;
    }


    cb();
  },

  onReport: function (s) {
    var cols = []
    var color = 'grey';

    // Bollinger
    if (s.period.bollinger) {
      if (s.period.bollinger.upperBound && s.period.bollinger.lowerBound) {
        let upperBound = s.period.bollinger.upperBound
        let lowerBound = s.period.bollinger.lowerBound
        
        if (s.period.close > (upperBound / 100) * (100 - s.options.bollinger_upper_bound_pct)) {
          color = 'green'
        } else if (s.period.close < (lowerBound / 100) * (100 + s.options.bollinger_lower_bound_pct)) {
          color = 'red'
        }
        cols.push(z(8, n(s.period.close).format('+00.0000'), ' ')[color])
        cols.push(z(8, n(lowerBound).format('0.000000').substring(0,7), ' ').cyan)
        cols.push(z(8, n(upperBound).format('0.000000').substring(0,7), ' ').cyan)
      }
    }
    else {
      cols.push('         ')
    }





    return cols
  },

  phenotypes:
        {
           // -- common
          period_length: Phenotypes.RangePeriod(1, 120, 'm'),
          markdown_buy_pct: Phenotypes.RangeFloat(-1, 5),
          markup_sell_pct: Phenotypes.RangeFloat(-1, 5),
          order_type: Phenotypes.ListOption(['maker', 'taker']),
          sell_stop_pct: Phenotypes.Range0(1, 50),
          buy_stop_pct: Phenotypes.Range0(1, 50),
          profit_stop_enable_pct: Phenotypes.Range0(1, 20),
          profit_stop_pct: Phenotypes.Range(1,20),

          // Bollinger
          bollinger_size: Phenotypes.Range(1, 40),
          bollinger_time: Phenotypes.RangeFloat(1,6),
          bollinger_upper_bound_pct: Phenotypes.RangeFloat(-1, 30),
          bollinger_lower_bound_pct: Phenotypes.RangeFloat(-1, 30),

          // William
          william_time_period: Phenotypes.Range0(1, 50),
          william_periods_count: Phenotypes.Range0(1, 240)
        }
}
