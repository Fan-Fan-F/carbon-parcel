/* 碳足迹计算器页面逻辑 */
(function () {
  'use strict';

  /* 填充城市下拉 */
  var cityNames = Object.keys(CarbonEngine.CITIES);
  var fromSel = document.getElementById('from');
  var toSel = document.getElementById('to');
  cityNames.forEach(function (c) {
    fromSel.add(new Option(c, c));
    toSel.add(new Option(c, c));
  });
  fromSel.value = '深圳';
  toSel.value = '北京';

  function fmtGrams(g) {
    if (g >= 1000) return (g / 1000).toFixed(2) + ' kg';
    return Math.round(g) + ' g';
  }

  function calc() {
    var from = fromSel.value;
    var to = toSel.value;
    var weight = Number(document.getElementById('weight').value) || 1;
    var schemes = CarbonEngine.compareSchemes(from, to, weight);
    if (schemes[0].error) {
      alert(schemes[0].error);
      return;
    }

    document.getElementById('result').classList.remove('hidden');

    /* 主结果用铁公联运（中间方案）展示 */
    var main = schemes[1];
    document.getElementById('total-kg').textContent = (main.totalGrams / 1000).toFixed(2);
    document.getElementById('head-route').innerHTML =
      '<b>' + from + ' → ' + to + '</b>　直线距离 <b>' + main.straightKm + '</b> km　重量 <b>' + weight + '</b> kg';
    document.getElementById('head-detail').innerHTML =
      '运输排放 ' + fmtGrams(main.transportGrams) + ' ＋ 包装排放 ' + fmtGrams(main.packaging.total) +
      '　约 ' + Math.round(main.hours) + ' 小时送达';

    /* 生活化换算 */
    var eqBox = document.getElementById('equiv');
    eqBox.innerHTML = main.equivalents.map(function (e) {
      return '<div class="eq-item"><b>' + e.value + '</b>' + e.label + '（' + e.unit + '）</div>';
    }).join('');

    /* 排放构成 */
    var parts = main.legs.map(function (l) {
      return { label: l.icon + ' ' + l.name + '（' + l.km + ' km）', grams: l.grams, color: l.color };
    });
    parts.push({ label: '📦 包装材料', grams: main.packaging.total, color: '#8894a8' });
    var maxG = Math.max.apply(null, parts.map(function (p) { return p.grams; }));
    document.getElementById('breakdown').innerHTML = parts.map(function (p) {
      return '<div class="bd-row"><span class="lbl">' + p.label + '</span>' +
        '<div class="bd-bar"><div class="bd-fill" style="width:' + Math.max(4, p.grams / maxG * 100) + '%;background:' + p.color + '"></div></div>' +
        '<span class="bd-val">' + fmtGrams(p.grams) + '</span></div>';
    }).join('');

    /* 方案对比 */
    var sorted = schemes.slice().sort(function (a, b) { return a.totalGrams - b.totalGrams; });
    var bestG = sorted[0].totalGrams;
    var worstG = sorted[sorted.length - 1].totalGrams;
    document.getElementById('compare').innerHTML = schemes.map(function (s) {
      var cls = 'scheme' + (s.totalGrams === bestG ? ' best' : '');
      var badge = s.totalGrams === bestG ? '<span class="badge-best">最低碳</span>'
        : s.totalGrams === worstG ? '<span class="badge-worst">最高碳</span>' : '';
      return '<div class="' + cls + '">' +
        '<div class="s-name">' + s.schemeName + badge +
        '<div class="s-legs">' + s.legs.map(function (l) { return l.icon + ' ' + l.name + ' ' + l.km + 'km'; }).join(' ＋ ') + '</div></div>' +
        '<div class="s-grams">' + fmtGrams(s.totalGrams) + ' <small>CO₂e</small></div>' +
        '<div class="s-hours">约 ' + Math.round(s.hours) + ' 小时</div></div>';
    }).join('');

    drawChart(schemes, bestG);
  }

  /* 横向柱状图：三方案排放对比 */
  function drawChart(schemes) {
    var cv = document.getElementById('cv');
    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);

    var maxG = Math.max.apply(null, schemes.map(function (s) { return s.totalGrams; }));
    var barH = 34, gap = 26, x0 = 170, y0 = 30;
    var w = cv.width - x0 - 110;

    ctx.font = '13px sans-serif';
    schemes.forEach(function (s, i) {
      var y = y0 + i * (barH + gap);
      var bw = Math.max(6, s.totalGrams / maxG * w);
      var colors = ['#f2a33c', '#3a6df0', '#e64545'];

      ctx.fillStyle = '#41544a';
      ctx.textAlign = 'right';
      ctx.fillText(s.schemeName, x0 - 12, y + barH / 2 + 5);

      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.roundRect(x0, y, bw, barH, 6);
      ctx.fill();

      ctx.fillStyle = '#1f2d26';
      ctx.textAlign = 'left';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(fmtGrams(s.totalGrams) + ' CO₂e', x0 + bw + 10, y + barH / 2 + 5);
      ctx.font = '13px sans-serif';
    });
  }

  document.getElementById('btn-calc').onclick = calc;
  calc();
})();
