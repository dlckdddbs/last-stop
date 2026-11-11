// 시간이 흐를 때 모든 시스템을 진행시킨다. 멈춰야 할 일(알림·사건)을 목록으로 돌려준다.
// 돌려주는 항목: { stop, toast, dialog, gameover }
window.LS = window.LS || {};

LS.Sim = (function () {
  const R = () => LS.Rules;

  function mealBetween(prev, next) {
    for (let t = (Math.floor(prev / 60) + 1) * 60; t <= next; t += 60) {
      if (LS.CONFIG.mealHours.includes(Math.floor((t % 1440) / 60))) return t;
    }
    return null;
  }

  function advance(state, prev, next) {
    const out = [];
    const dt = next - prev;
    if (dt <= 0) return out;
    const end = LS.Clock.end();

    LS.Meals.decay(state, dt);

    // 이동 또는 공회전
    if (state.travel) {
      out.push(...LS.Travel.advance(state, prev, next));
    } else if (state.bus.engineOn) {
      state.resources.fuel = Math.max(0, state.resources.fuel - LS.CONFIG.fuel.idlePerHour * dt / 60);
      if (state.resources.fuel <= 0) {
        state.bus.engineOn = false;
        LS.State.addLog(state, '연료가 떨어져 엔진이 꺼졌다', true, 'travel');
        out.push({ stop: true, toast: '연료가 떨어져 엔진이 꺼졌다.', important: true });
      }
    }

    // 맡은 일이 없는 동료는 버스 좌석에서 저절로 쉰다 (기력 +1/시간, 80까지. 2026-11-10 결정)
    if (!state.travel) state.crew.forEach((m) => { if (!m.task) R().applyRest(state, m, 'seatRest', dt); });

    // 작업 (경계 인원은 구간 시작 기준으로 센다)
    LS.Tasks.beginStep(state);
    LS.People.beginStep(state);
    state.tasks.slice().forEach((t) => { if (state.tasks.includes(t)) out.push(...LS.Tasks.advance(state, t, prev, next)); });

    // 좀비: 정차 판정·무리 접근·포위·감염 시계 (14~15장, 12장)
    out.push(...LS.Zombie.advance(state, prev, next));

    // 사람: 2~3일째 도로변의 두 사람, 도둑 (16~17장, 22장)
    out.push(...LS.People.advance(state, prev, next));

    // 부탁 기한·리더 약속·작은 순간 (20~21장)
    out.push(...LS.Requests.advance(state, prev, next));

    // 식중독 회복
    state.crew.forEach((m) => {
      if (m.poisonUntil && prev < m.poisonUntil && next >= m.poisonUntil) LS.State.addLog(state, `${R().name(m.id)}의 식중독이 나았다`, false, 'body');
    });

    // 낮밤·자정
    if (LS.Clock.isNight(prev) && !LS.Clock.isNight(next)) LS.State.addLog(state, '날이 밝았다', false, 'time');
    if (!LS.Clock.isNight(prev) && LS.Clock.isNight(next)) LS.State.addLog(state, '해가 졌다', false, 'time');
    if (Math.floor(next / 1440) > Math.floor(prev / 1440) && next < end) LS.State.addLog(state, `${LS.Clock.day(next)}일째 시작`, false, 'time');

    // 정규 식사 (08시·20시)
    if (mealBetween(prev, next) != null && next <= end) out.push(...LS.Meals.process(state));

    if (state.protagonistDead) out.push({ gameover: 'protagonist' });
    else if (!state.crew.length) out.push({ gameover: 'wipe' });
    return out;
  }

  return { advance };
})();
