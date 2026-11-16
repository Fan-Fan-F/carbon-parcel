/* 包裹碳足迹计算引擎（纯逻辑）
 *
 * 计算模型：
 *   运输排放 = Σ(每段距离 × 重量 × 该运输方式排放因子)
 *   包装排放 = 纸箱 + 填充物 + 胶带（按包裹重量档估算）
 *   总排放   = 运输 + 包装
 *
 * 排放因子参考：DEFRA 2023 / 中国产品全生命周期温室气体排放系数库
 * 单位：gCO2e / (吨·公里)
 */
(function (global) {
  'use strict';

  /* 运输方式排放因子（gCO2e / t·km）与速度（km/h） */
  var MODES = {
    air:   { name: '航空货运', factor: 602, speed: 800, color: '#e64545', icon: '✈️' },
    road:  { name: '公路卡车', factor: 80,  speed: 70,  color: '#f2a33c', icon: '🚚' },
    rail:  { name: '铁路运输', factor: 22,  speed: 90,  color: '#3a6df0', icon: '🚄' },
    sea:   { name: '海运集装箱', factor: 12, speed: 30,  color: '#1e9e4a', icon: '🚢' }
  };

  /* 城市坐标（纬度, 经度），用于大圆距离估算 */
  var CITIES = {
    '北京': { lat: 39.90, lon: 116.40 },
    '上海': { lat: 31.23, lon: 121.47 },
    '广州': { lat: 23.13, lon: 113.26 },
    '深圳': { lat: 22.54, lon: 114.06 },
    '杭州': { lat: 30.27, lon: 120.16 },
    '成都': { lat: 30.57, lon: 104.07 },
    '武汉': { lat: 30.59, lon: 114.31 },
    '西安': { lat: 34.34, lon: 108.94 },
    '郑州': { lat: 34.75, lon: 113.63 },
    '重庆': { lat: 29.56, lon: 106.55 },
    '沈阳': { lat: 41.80, lon: 123.43 },
    '昆明': { lat: 25.04, lon: 102.71 },
    '乌鲁木齐': { lat: 43.83, lon: 87.62 },
    '哈尔滨': { lat: 45.80, lon: 126.53 }
  };

  /* 大圆距离（km），公路绕行系数 1.2 */
  function distanceBetween(a, b) {
    var R = 6371;
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLon = (b.lon - a.lon) * toRad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /* 包装排放（gCO2e）：按重量档估算纸箱+填充+胶带 */
  function packagingEmission(weightKg) {
    if (weightKg <= 1)  return { box: 180, filler: 30, tape: 8,  total: 218 };
    if (weightKg <= 5)  return { box: 450, filler: 90, tape: 15, total: 555 };
    if (weightKg <= 15) return { box: 900, filler: 220, tape: 25, total: 1145 };
    return { box: 1800, filler: 500, tape: 40, total: 2340 };
  }

  /* 计算单条运输方案
   * legs: [{ mode: 'air'|'road'|'rail'|'sea', ratio: 0-1 }] 多式联运占比
   */
  function calcShipment(opts) {
    var from = CITIES[opts.from];
    var to = CITIES[opts.to];
    if (!from || !to) return { error: '请选择起止城市' };
    if (opts.from === opts.to) return { error: '起点与终点不能相同' };

    var weightKg = Number(opts.weightKg) || 1;
    var straightKm = distanceBetween(from, to);

    var legs = (opts.legs && opts.legs.length) ? opts.legs : [{ mode: 'road', ratio: 1 }];

    var transportGrams = 0;
    var totalHours = 0;
    var legDetail = legs.map(function (leg) {
      var mode = MODES[leg.mode];
      var km = straightKm * (leg.mode === 'road' ? 1.2 : leg.mode === 'rail' ? 1.15 : leg.mode === 'sea' ? 1.35 : 1.05) * leg.ratio;
      var grams = km * (weightKg / 1000) * mode.factor;
      transportGrams += grams;
      totalHours += km / mode.speed;
      return {
        mode: leg.mode,
        name: mode.name,
        icon: mode.icon,
        color: mode.color,
        km: Math.round(km),
        grams: Math.round(grams),
        factor: mode.factor
      };
    });

    var pack = packagingEmission(weightKg);
    var totalGrams = transportGrams + pack.total;

    return {
      from: opts.from,
      to: opts.to,
      weightKg: weightKg,
      straightKm: Math.round(straightKm),
      legs: legDetail,
      packaging: pack,
      transportGrams: Math.round(transportGrams),
      totalGrams: Math.round(totalGrams),
      hours: Math.round(totalHours * 10) / 10,
      equivalents: equivalents(totalGrams)
    };
  }

  /* 生活化换算 */
  function equivalents(grams) {
    return [
      { label: '棵树一天吸收 CO₂', value: (grams / 55).toFixed(1), unit: '棵·天' },
      { label: '智能手机充电', value: Math.round(grams / 8.2), unit: '次' },
      { label: '燃油车行驶', value: (grams / 192).toFixed(1), unit: '公里' },
      { label: 'LED 灯泡点亮', value: Math.round(grams / 24), unit: '小时' }
    ];
  }

  /* 三种方案对比：全程公路 / 铁公联运 / 全程航空 */
  function compareSchemes(from, to, weightKg) {
    return [
      { name: '公路直达（标准快递）', legs: [{ mode: 'road', ratio: 1 }] },
      { name: '铁公联运（经济件）', legs: [{ mode: 'rail', ratio: 0.85 }, { mode: 'road', ratio: 0.15 }] },
      { name: '航空直达（特快）', legs: [{ mode: 'air', ratio: 0.92 }, { mode: 'road', ratio: 0.08 }] }
    ].map(function (s) {
      var r = calcShipment({ from: from, to: to, weightKg: weightKg, legs: s.legs });
      r.schemeName = s.name;
      return r;
    });
  }

  global.CarbonEngine = {
    MODES: MODES,
    CITIES: CITIES,
    calcShipment: calcShipment,
    compareSchemes: compareSchemes,
    distanceBetween: distanceBetween
  };
})(window);
