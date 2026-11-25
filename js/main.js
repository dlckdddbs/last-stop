// 시작점: 시작 화면(이어하기 / 새 게임)에서 상태를 고르고, 화면·시간·대화창을 연결한다.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let state = null;
  let confirmNew = false;

  // ---------- 시간 조작 버튼·단축키 ----------
  function bindControls() {
    $('btn-pause').addEventListener('click', () => LS.Time.pause());
    $('btn-play').addEventListener('click', () => LS.Time.play());
    $('btn-speed').addEventListener('click', () => LS.Time.cycleSpeed());
    $('btn-next').addEventListener('click', () => LS.Time.runToNext());

    // 기다리기: 1·2·4시간 / 아침 6시까지. 그 사이 작업이 끝나거나 사건이 생기면 먼저 멈춘다
    $('btn-wait').addEventListener('click', (e) => { e.stopPropagation(); $('wait-menu').classList.toggle('hidden'); });
    $('wait-menu').addEventListener('click', (e) => {
      const b = e.target.closest('[data-wait]');
      if (!b) return;
      $('wait-menu').classList.add('hidden');
      let goal;
      if (b.dataset.wait === 'morning') {
        goal = Math.floor(state.minute / 1440) * 1440 + LS.CONFIG.dayStartHour * 60;
        if (goal <= state.minute) goal += 1440;
      } else {
        goal = state.minute + Number(b.dataset.wait);
      }
      LS.Time.waitUntil(goal);
    });

    // 메뉴: 자동 저장 표시 · 시작 화면으로 · 처음부터 다시 (한 번 더 눌러야 지워진다)
    $('btn-menu').addEventListener('click', (e) => { e.stopPropagation(); LS.UI.renderSaveBadge(); $('game-menu').classList.toggle('hidden'); });
    $('btn-title').addEventListener('click', () => {
      if (LS.Save.settled(state)) LS.Save.write(state);
      location.reload();
    });
    $('btn-restart').addEventListener('click', (e) => {
      const b = e.currentTarget;
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = '한 번 더 누르면 지금 여정이 지워져요'; return; }
      LS.Save.clear();
      sessionStorage.setItem('lastStop.autoNew', '1');
      location.reload();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.wait-wrap')) $('wait-menu').classList.add('hidden');
      if (!e.target.closest('.tb-menu')) {
        $('game-menu').classList.add('hidden');
        const r = $('btn-restart'); delete r.dataset.sure; r.textContent = '처음부터 다시';
      }
    });

    // Space: 진행/멈춤 전환 (대화창이 열려 있으면 대사 넘기기로 쓰인다)
    document.addEventListener('keydown', (e) => {
      if (!state || state.dialogOpen || state.gameOver) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (state.running) LS.Time.pause(); else LS.Time.play();
      }
    });

    // 창을 닫거나 새로고침할 때: 멈춰 있는 상태면 바로 저장
    window.addEventListener('pagehide', () => { if (state && LS.Save.settled(state)) LS.Save.write(state); });
  }

  // ---------- 게임 시작 ----------
  // how: 'new' 새 게임 | 'continue' 이어하기 | 'demo' 시연 지름길 (A-6)
  function start(s, how, note) {
    state = s;
    LS.game = s;   // 개발 중 확인용 (브라우저 콘솔에서 LS.game)
    LS.UI.init(s);
    LS.Panel.init(s);
    LS.Time.init(s);
    LS.Dialog.bind();
    LS.Guide.init(s);
    bindControls();
    $('title').classList.add('hidden');
    if (how === 'new') LS.State.addLog(s, '게임 시작', false, 'system');
    else if (how === 'continue') LS.State.addLog(s, '이어하기', false, 'system', `${LS.Clock.fullLabel(s.minute)}에 저장한 여정`);
    LS.UI.renderAll();
    if (how === 'continue') LS.UI.toast(`이어하기 · ${LS.Clock.fullLabel(s.minute)}에 멈춘 곳에서 다시 시작해요.`);
    if (note) LS.UI.toast(note, { sticky: true });
    LS.Time.fireDue();
    if (how !== 'new') LS.Save.write(s);
  }

  function startNew() { start(LS.State.create(), 'new'); }

  // ---------- 시작 화면 ----------
  function showTitle() {
    const saved = LS.Save.peek();
    let html = '';
    if (saved) html += `<button class="title-btn primary" data-t="continue">이어하기<small>${esc(LS.Save.summary(saved))}</small></button>`;
    html += `<button class="title-btn ${saved ? '' : 'primary'}" data-t="new">새 게임<small>1일째 06:00 · 버려진 소방서에서 출발</small></button>`;
    if (LS.Demo) html += LS.Demo.titleButtons();
    $('title-buttons').innerHTML = html;
    $('title-note').textContent = saved
      ? '새 게임을 고르면 저장된 여정이 지워져요. 진행은 멈출 때마다 자동으로 저장돼요.'
      : '진행은 멈출 때마다 자동으로 저장돼요. 새로고침해도 [이어하기]로 돌아올 수 있어요.';
    $('title').classList.remove('hidden');
  }

  $('title').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b || state) return;
    const t = b.dataset.t;
    if (t === 'continue') {
      const s = LS.Save.load();
      if (s) start(s, 'continue'); else startNew();
      return;
    }
    if (t === 'new') {
      if (LS.Save.peek() && !confirmNew) {
        confirmNew = true;
        b.innerHTML = '한 번 더 누르면 새로 시작해요<small>저장된 여정은 지워져요</small>';
        return;
      }
      LS.Save.clear();
      startNew();
      return;
    }
    if (LS.Demo && t.indexOf('demo:') === 0) {
      const d = LS.Demo.build(t.slice(5));
      if (d) {
        start(d.state, 'demo', d.note);
        if (d.arrive) LS.Time.handle(LS.Travel.landAt(d.state, d.arrive));   // 그 장소에 막 도착한 장면부터
        else LS.Time.handle(LS.Travel.landAt(d.state, d.state.locationId));
      }
    }
  });

  // [처음부터 다시]로 새로고침한 경우: 시작 화면 없이 바로 새 게임
  if (sessionStorage.getItem('lastStop.autoNew')) {
    sessionStorage.removeItem('lastStop.autoNew');
    startNew();
  } else {
    showTitle();
  }
})();
