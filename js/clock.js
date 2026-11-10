// 공통 시계 (02장): 1일째 00시 ~ 30일째 24시, 내부는 분 단위
window.LS = window.LS || {};

LS.Clock = (function () {
  const C = () => LS.CONFIG;
  const pad = (n) => String(n).padStart(2, '0');

  function end() { return C().totalHours * 60; }

  function day(m) {
    if (m >= end()) return C().totalHours / 24;        // 마감 시각은 'D30 24:00'으로 표시
    return Math.floor(m / 1440) + 1;
  }

  function hour(m) {
    if (m >= end()) return 24;
    return Math.floor((m % 1440) / 60);
  }

  function timeLabel(m) { return pad(hour(m)) + ':' + pad(m >= end() ? 0 : m % 60); }
  function fullLabel(m) { return 'D' + day(m) + ' ' + timeLabel(m); }

  function isNight(m) {
    const h = Math.floor((m % 1440) / 60);
    return h >= C().nightStartHour || h < C().dayStartHour;
  }

  function remaining(m) { return Math.max(0, end() - m); }

  function remainingLabel(m) {
    const r = remaining(m);
    const d = Math.floor(r / 1440);
    const h = Math.floor((r % 1440) / 60);
    const mm = r % 60;
    return d + '일 ' + h + '시간' + (mm ? ' ' + mm + '분' : '');
  }

  // 밤 보정의 '일차' 번호. 자정(nightRolloverHour)에 바뀐다. 3단계 좀비 시스템에서 사용.
  function rolloverIndex(m) { return Math.floor((m - C().nightRolloverHour * 60) / 1440); }

  // m 이후 첫 정규 식사 시각
  function nextMealAfter(m) {
    for (let t = (Math.floor(m / 60) + 1) * 60; t <= end(); t += 60) {
      if (C().mealHours.includes(Math.floor((t % 1440) / 60))) return t;
    }
    return end();
  }

  return { end, day, hour, timeLabel, fullLabel, isNight, remaining, remainingLabel, rolloverIndex, nextMealAfter };
})();
