import * as echarts from 'echarts';

/* Three fixed charts plus the price chart in the centre column.
   All options live in this one module so the component can redraw on demand
   (theme flip rebuilds with fresh token colours). Every option is built from
   the live model passed in — nothing is read from module-level constants. */

export const css = v => getComputedStyle(document.body).getPropertyValue(v).trim();

export const charts = {};
export const draw = (id, opt) => {
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = charts[id] || echarts.init(el);
  charts[id].setOption(opt, true);
};

/* A function, not a const: colours come from CSS variables and must be
   re-read on every rebuild, or a theme flip leaves the axes on the old palette. */
export const AXIS = () => ({
  axisLine: {lineStyle: {color: css('--line')}},
  axisTick: {show: false},
  axisLabel: {color: css('--muted'), fontSize: 14},
  splitLine: {lineStyle: {color: css('--line-soft')}}
});

const HOUR = ts => {
  const d = new Date(ts * 1000);
  return String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0')
       + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':00';
};

/* Centre chart: hourly gold closes with the signal's key levels marked. */
export function trendOpt(model) {
  const N = 168; /* last week of hourly candles */
  const cs = model.candles.slice(-N);
  const acc = css('--s1');
  const kl = model.signal.keyLevels;
  return {
    animation: false,
    grid: {left: 64, right: 26, top: 40, bottom: 30},
    legend: {top: 4, right: 6, itemWidth: 14, itemHeight: 4, textStyle: {color: css('--muted'), fontSize: 14}},
    xAxis: {type: 'category', data: cs.map(c => HOUR(c.time)), boundaryGap: false, ...AXIS(), splitLine: {show: false}},
    yAxis: {type: 'value', name: 'USD/oz', scale: true, nameTextStyle: {color: css('--muted'), fontSize: 13}, ...AXIS()},
    series: [
      {name: 'GC=F 1H', type: 'line', smooth: .15, symbol: 'none',
       data: cs.map(c => c.close),
       lineStyle: {width: 3, color: acc, shadowColor: acc, shadowBlur: 14},
       itemStyle: {color: acc},
       areaStyle: {color: {type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
         {offset: 0, color: 'color-mix(in srgb,' + acc + ' 42%,transparent)'},
         {offset: 1, color: 'color-mix(in srgb,' + acc + ' 0%,transparent)'}]}},
       markLine: {silent: true, symbol: 'none', data: [
         {yAxis: kl.tp, lineStyle: {color: css('--s2'), type: 'dashed', width: 1.5},
          label: {formatter: 'TP ' + kl.tp.toFixed(0), color: css('--s2'), fontSize: 12, position: 'insideEndTop'}},
         {yAxis: kl.sl, lineStyle: {color: css('--s6'), type: 'dashed', width: 1.5},
          label: {formatter: 'SL ' + kl.sl.toFixed(0), color: css('--s6'), fontSize: 12, position: 'insideEndBottom'}},
         {yAxis: kl.pivotHigh, lineStyle: {color: css('--s5'), type: 'dotted', width: 1.2},
          label: {formatter: 'PH ' + kl.pivotHigh.toFixed(0), color: css('--s5'), fontSize: 11, position: 'insideStartTop'}},
         {yAxis: kl.pivotLow, lineStyle: {color: css('--s5'), type: 'dotted', width: 1.2},
          label: {formatter: 'PL ' + kl.pivotLow.toFixed(0), color: css('--s5'), fontSize: 11, position: 'insideStartBottom'}},
       ]}},
    ]
  };
}

export function renderRest(model) {
  /* Signal composition: how the five drivers split by impact. */
  const m = model.signal.meta;
  draw('mix', {
    animation: false,
    series: [{
      type: 'pie', radius: ['42%', '64%'], center: ['50%', '52%'],
      itemStyle: {borderColor: css('--panel'), borderWidth: 3},
      color: [css('--s2'), css('--s6'), css('--s5')],
      label: {color: css('--ink'), fontSize: 13.5, formatter: '{b}\n{c} drivers', lineHeight: 17,
              alignTo: 'edge', edgeDistance: 6},
      labelLine: {length: 8, length2: 10, maxSurfaceAngle: 80, lineStyle: {color: css('--line')}},
      data: [
        {name: 'Bullish', value: m.bullishCount},
        {name: 'Bearish', value: m.bearishCount},
        {name: 'Neutral', value: m.neutralCount},
      ].filter(d => d.value > 0)
    }]
  });

  /* Driver scores — the bar read of the same five factors. */
  const dr = model.drivers.slice().sort((a, b) => a.v - b.v);
  draw('turn', {
    animation: false,
    grid: {left: 12, right: 52, top: 10, bottom: 10, containLabel: true},
    xAxis: {type: 'value', max: 100, ...AXIS(), axisLabel: {show: false}, splitLine: {show: false}},
    yAxis: {type: 'category', data: dr.map(d => d.n), ...AXIS(),
            splitLine: {show: false}, axisLabel: {color: css('--ink'), fontSize: 13}},
    series: [{
      type: 'bar', barWidth: 13,
      data: dr.map(d => d.v),
      itemStyle: {borderRadius: [0, 3, 3, 0],
        color: p => dr[p.dataIndex].impact === 'bearish' ? css('--s6') : css('--s1')},
      label: {show: true, position: 'right', formatter: '{c}', color: css('--muted'), fontSize: 14},
      markLine: {silent: true, symbol: 'none', data: [{xAxis: 50}],
        lineStyle: {color: css('--s5'), type: 'dashed', width: 1.5},
        label: {formatter: 'Neutral 50', color: css('--s5'), fontSize: 12, position: 'end'}}
    }]
  });

  /* Long-run composite score history from the backend's score line. */
  const hs = model.scoreHistory.filter((_, i) => i % 2 === 0);
  /* The history is monthly backtest data; the live score sits on the current
     month so "Now" is never drawn over a month it doesn't belong to. */
  const thisMonth = new Date().toISOString().slice(0, 7);
  const months = hs.map(p => p.time.slice(0, 7));
  if (hs.length && months[months.length - 1] !== thisMonth) months.push(thisMonth);
  const now = hs.length ? [[thisMonth, model.signal.score]] : [];
  draw('cash', {
    animation: false,
    grid: {left: 54, right: 20, top: 34, bottom: 28},
    legend: {top: 2, right: 2, itemWidth: 12, itemHeight: 4, textStyle: {color: css('--muted'), fontSize: 13}},
    xAxis: {type: 'category', data: months, ...AXIS(), splitLine: {show: false},
            axisLabel: {color: css('--muted'), fontSize: 12}},
    yAxis: {type: 'value', name: 'score', min: 0, max: 100,
            nameTextStyle: {color: css('--muted'), fontSize: 13}, ...AXIS()},
    series: [
      {name: 'Composite score', type: 'line', smooth: .3, symbol: 'none',
       data: hs.map(p => +p.value.toFixed(1)),
       lineStyle: {width: 2.4, color: css('--s1'), shadowColor: css('--s1'), shadowBlur: 10},
       itemStyle: {color: css('--s1')},
       areaStyle: {color: {type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
         {offset: 0, color: 'color-mix(in srgb,' + css('--s1') + ' 30%,transparent)'},
         {offset: 1, color: 'color-mix(in srgb,' + css('--s1') + ' 0%,transparent)'}]}},
       markLine: {silent: true, symbol: 'none', data: [{yAxis: 50}],
         lineStyle: {color: css('--s5'), type: 'dashed', width: 1.2},
         label: {formatter: 'Bull / bear 50', color: css('--s5'), fontSize: 12, position: 'end'}}},
      {name: 'Now', type: 'scatter', symbolSize: 10,
       data: now,
       itemStyle: {color: css('--s5'), borderColor: css('--panel'), borderWidth: 2}},
    ]
  });
}
