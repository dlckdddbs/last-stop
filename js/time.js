// 시간 진행: 멈춤 / 진행(배속) / 다음 상황까지 (02장)
// 30분 단위로 진행하며, 예정 사건이나 마감에 닿으면 자동으로 멈춘다.
window.LS = window.LS || {};

LS.Time = (function () {
  let state = null;
  let timer = null;
  let mode = null;   // 'play' | 'next'

  function init(s) { state = s; }

  // 아직 일어나지 않은 예정 사건 중 m 이후(포함) 가장 이른 것
  function scheduledFrom(m) {
    let best = null;
    for (const e of LS.SCHEDULE) {
      if (state.fired[e.event] || e.at < m) continue;
      if (!best || e.at < best.at) best = e;
    }
    return best;
  }

  // '다음 상황까지'가 멈출 시점: 예정 사건 / 다음 식사 시간 / 접수 마감 중 가장 이른 것
  // (1단계 임시: 식사 시간에도 멈춘다. 2단계부터는 식사 판단이 필요할 때만 멈춘다.)
  function nextStop() {
    const end = LS.Clock.end();
    let stop = { at: end, label: '접수 마감' };
    const meal = LS.Clock.nextMealAfter(state.minute);
    if (meal < stop.at) stop = { at: meal, label: '식사 시간' };
    const ev = scheduledFrom(state.minute + 1);
    if (ev && ev.at <= stop.at) stop = { at: ev.at, label: LS.EVENTS[ev.event].title };
    return stop;
  }

  // 시간이 흐를 때마다 처리할 일. 2단계부터 식사·기력·연료 등이 여기에 연결된다.
  function onTick(prev, now) {
    const end = LS.Clock.end();
    if (LS.Clock.isNight(prev) && !LS.Clock.isNight(now)) LS.State.addLog(state, '날이 밝았다.');
    if (!LS.Clock.isNight(prev) && LS.Clock.isNight(now)) LS.State.addLog(state, '해가 졌다.');
    if (now % 1440 === 0 && now > 0 && now < end) LS.State.addLog(state, `자정 · ${LS.Clock.day(now)}일째가 시작되었다.`);
    if (now % 60 === 0 && now < end && LS.CONFIG.mealHours.includes(LS.Clock.hour(now))) {
      LS.State.addLog(state, '식사 시간 (식사 규칙은 2단계에서 적용)');
    }
  }

  // 30분 진행. 계속 진행해도 되면 true
  function step() {
    if (state.dialogOpen || state.gameOver) return false;
    const prev = state.minute;
    state.minute = Math.min(prev + LS.CONFIG.stepMinutes, LS.Clock.end());
    onTick(prev, state.minute);
    LS.UI.renderTopbar();
    LS.UI.renderLog();
    if (LS.Clock.isNight(prev) !== LS.Clock.isNight(state.minute)) LS.UI.renderScene();

    const due = scheduledFrom(0);
    if (due && due.at <= state.minute) { fire(due.event); return false; }
    if (state.minute >= LS.Clock.end()) { gameOver(); return false; }
    LS.UI.renderControls();
    return true;
  }

  function fire(eventId) {
    state.fired[eventId] = true;
    stop();
    LS.Dialog.open(state, eventId);
  }

  // 지금 시각에 이미 도래한 예정 사건이 있으면 연다 (게임 시작 시 사용)
  function fireDue() {
    const due = scheduledFrom(0);
    if (due && due.at <= state.minute) fire(due.event);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    mode = null;
    state.running = false;
    LS.UI.renderControls();
  }

  function play() {
    if (state.dialogOpen || state.gameOver) return;
    stop();
    state.running = true;
    mode = 'play';
    timer = setInterval(() => { if (!step()) stop(); }, LS.CONFIG.speeds[state.speedIndex].msPerStep);
    LS.UI.renderControls();
  }

  function runToNext() {
    if (state.dialogOpen || state.gameOver) return;
    stop();
    const target = nextStop().at;
    state.running = true;
    mode = 'next';
    timer = setInterval(() => {
      const ok = step();
      if (!ok) return;            // 사건·마감으로 이미 멈춤
      if (state.minute >= target) stop();
    }, LS.CONFIG.nextEventMsPerStep);
    LS.UI.renderControls();
  }

  function cycleSpeed() {
    state.speedIndex = (state.speedIndex + 1) % LS.CONFIG.speeds.length;
    if (mode === 'play') play(); else LS.UI.renderControls();
  }

  function gameOver() {
    state.gameOver = true;
    stop();
    LS.State.addLog(state, '30일째 24시 · 대피편 접수가 마감되었다.', true);
    const g = document.getElementById('gameover');
    g.innerHTML = '<h2>접수 마감</h2><p>30일째 24시가 지났다.</p><p>결말 판정은 7단계에서 연결됩니다.</p>' +
      '<button onclick="location.reload()">처음부터</button>';
    g.classList.remove('hidden');
    LS.UI.renderAll();
  }

  return { init, play, pause: stop, runToNext, cycleSpeed, nextStop, fireDue };
})();
