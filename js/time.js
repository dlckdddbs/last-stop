// 시간 진행: 멈춤 / 진행(배속) / 다음 상황까지 / 기다리기 (02장)
// 행동은 배정만 하고 시간은 플레이어가 흘린다. 작업 완료·도착·도로 사건·식량 판단·예정 사건·마감에서 자동으로 멈춘다.
window.LS = window.LS || {};

LS.Time = (function () {
  let state = null;
  let timer = null;
  let mode = null;            // 'play' | 'next' | 'wait'
  let goalAt = null;          // 기다리기 목표 시각
  const queue = [];           // 차례로 열 사건(대화창)
  const SCHEDULE_LOOKAHEAD = 12 * 60;   // 할 일이 없을 때 '다음 상황'으로 칠 예정 사건 범위

  function init(s) { state = s; }

  function nextBoundary(m) { return Math.floor(m / 30) * 30 + 30; }

  // 아직 일어나지 않은 예정 사건 중 m 이후(포함) 가장 이른 것
  function scheduledFrom(m) {
    let best = null;
    for (const e of LS.SCHEDULE) {
      if (state.fired[e.event] || e.at < m) continue;
      if (!best || e.at < best.at) best = e;
    }
    return best;
  }

  function busy() { return !!state.travel || state.tasks.length > 0; }

  // '다음 상황까지'가 멈출 시점. 진행 중인 작업·이동이 있으면 가장 먼저 끝나는 것, 없으면 가까운 예정 사건. 둘 다 없으면 null
  function nextStop() {
    const cands = [];
    if (state.travel) cands.push({ at: state.minute + LS.Travel.etaMinutes(state), label: '도착 예정', busy: true });
    state.tasks.forEach((t) => cands.push({ at: state.minute + LS.Tasks.eta(state, t), label: `${LS.Tasks.taskTitle(state, t)} 끝`, busy: true }));
    const zk = LS.Zombie.nextKnown(state);   // 아는 무리·포위만 (모르는 무리는 미리 알려 주지 않는다)
    if (zk) cands.push(zk);
    const ev = scheduledFrom(state.minute + 1);
    if (ev && (busy() || ev.at - state.minute <= SCHEDULE_LOOKAHEAD)) cands.push({ at: ev.at, label: LS.EVENTS[ev.event].title });
    if (!cands.length) return null;
    cands.sort((a, b) => a.at - b.at);
    return cands[0];
  }

  // 다음 30분 경계와, 작업·이동에서 무언가 일어나는 정확한 시각 중 이른 쪽까지 진행한다
  function nextTarget() {
    let t = nextBoundary(state.minute);
    state.tasks.forEach((task) => { t = Math.min(t, state.minute + LS.Tasks.nextMilestone(state, task)); });
    if (state.travel) t = Math.min(t, state.minute + LS.Travel.nextMilestone(state));
    t = Math.min(t, state.minute + LS.Zombie.nextMilestone(state));
    t = Math.ceil(t - 1e-9);
    return Math.min(Math.max(t, state.minute + 1), LS.Clock.end());
  }

  function advanceTo(next) {
    const prev = state.minute;
    state.minute = next;
    const out = LS.Sim.advance(state, prev, next);
    const due = scheduledFrom(0);
    if (due && due.at <= state.minute) { state.fired[due.event] = true; out.unshift({ dialog: due.event }); }
    if (state.minute >= LS.Clock.end() && !state.gameOver) out.push({ gameover: 'deadline' });
    LS.UI.renderLive();
    return handle(out);
  }

  // 한 걸음 진행. 계속 진행해도 되면 true
  function step() {
    if (state.dialogOpen || state.gameOver) return false;
    // 기다리기 목표 시각이 30분 경계 사이에 있으면 정확히 거기서 멈춘다
    const t = nextTarget();
    return advanceTo(goalAt != null && goalAt > state.minute && goalAt !== Infinity ? Math.min(t, goalAt) : t);
  }

  // 알림·사건 처리. 멈춰야 하면 false
  function handle(out) {
    let halt = false;
    out.forEach((it) => {
      if (it.toast) LS.UI.toast(it.toast, { sticky: !!it.important });
      if (it.dialog) { queue.push(it); halt = true; }
      if (it.stop) halt = true;
      if (it.gameover) { gameOver(it.gameover); halt = true; }
    });
    if (halt) { stop(); drain(); return false; }
    return true;
  }

  function drain() {
    if (state.dialogOpen || state.gameOver) return;
    const it = queue.shift();
    if (!it) { LS.UI.renderAll(); LS.Guide.check(); return; }
    LS.Dialog.open(state, it.dialog, () => drain());
  }

  // 지금 시각에 이미 도래한 예정 사건이 있으면 연다 (게임 시작 시)
  function fireDue() {
    const due = scheduledFrom(0);
    if (due && due.at <= state.minute) { state.fired[due.event] = true; handle([{ dialog: due.event }]); }
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    mode = null;
    goalAt = null;
    state.running = false;
    LS.UI.renderControls();
  }

  function run(kind, msPerStep, goal) {
    if (state.dialogOpen || state.gameOver) return;
    stop();
    state.running = true;
    mode = kind;
    goalAt = goal;
    timer = setInterval(() => {
      if (!step()) return;          // 알림·사건으로 이미 멈춤
      if (state.minute >= goal) stop();
    }, msPerStep);
    LS.UI.renderControls();
  }

  function play() { run('play', LS.CONFIG.speeds[state.speedIndex].msPerStep, Infinity); }

  function runToNext() {
    const ns = nextStop();
    if (!ns) { LS.UI.toast('진행 중인 일이 없어요. 작업을 배정하거나 [기다리기]를 쓰세요.'); return; }
    // 작업·이동은 끝날 때 스스로 멈추므로 예상 시각에서 미리 멈추지 않는다 (기력 저하로 길어질 수 있음)
    run('next', LS.CONFIG.nextEventMsPerStep, ns.busy ? Infinity : ns.at);
  }

  function waitUntil(goal) {
    goal = Math.min(goal, LS.Clock.end());
    if (goal <= state.minute) return;
    run('wait', LS.CONFIG.nextEventMsPerStep, goal);
  }

  function cycleSpeed() {
    state.speedIndex = (state.speedIndex + 1) % LS.CONFIG.speeds.length;
    if (mode === 'play') play(); else LS.UI.renderControls();
  }

  const ENDINGS = {
    deadline: { title: '접수 마감', text: '30일째 24시가 지났다.' },
    protagonist: { title: '빈 운전석', text: '윤재하가 숨졌다.' },
    heroTurned: { title: '빈 운전석', text: '감염 72시간. 윤재하는 돌아오지 못했다.' },
    selfExit: { title: '마지막 정류장', text: '윤재하는 스스로 버스에서 내렸다. 남은 일행이 이어서 간다.' },
    wipe: { title: '멈춘 버스', text: '버스에 남은 사람이 없다.' }
  };

  function gameOver(reason) {
    if (state.gameOver) return;
    state.gameOver = true;
    stop();
    const e = ENDINGS[reason] || ENDINGS.deadline;
    LS.State.addLog(state, e.title, true, 'event', e.text);
    const g = document.getElementById('gameover');
    g.innerHTML = `<h2>${e.title}</h2><p>${e.text}</p><p>결말 판정은 7단계에서 연결됩니다.</p>` +
      '<button onclick="location.reload()">처음부터</button>';
    g.classList.remove('hidden');
    LS.UI.renderAll();
  }

  function runInfo() { return { mode, goal: goalAt }; }

  return { init, play, pause: stop, runToNext, waitUntil, cycleSpeed, nextStop, fireDue, handle, busy, runInfo };
})();
