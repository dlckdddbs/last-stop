// 시작점: 상태를 만들고 화면·시간·대화창을 연결한다.
(function () {
  const state = LS.State.create();
  LS.game = state;   // 개발 중 확인용 (브라우저 콘솔에서 LS.game)

  LS.UI.init(state);
  LS.Panel.init(state);
  LS.Time.init(state);
  LS.Dialog.bind();
  LS.Guide.init(state);

  const $ = (id) => document.getElementById(id);
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
  document.addEventListener('click', (e) => { if (!e.target.closest('.wait-wrap')) $('wait-menu').classList.add('hidden'); });

  // Space: 진행/멈춤 전환 (대화창이 열려 있으면 대사 넘기기로 쓰인다)
  document.addEventListener('keydown', (e) => {
    if (state.dialogOpen || state.gameOver) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (state.running) LS.Time.pause(); else LS.Time.play();
    }
  });

  LS.State.addLog(state, '게임 시작', false, 'system');
  LS.UI.renderAll();
  LS.Time.fireDue();
})();
