// 시작점: 상태를 만들고 화면·시간·대화창을 연결한다.
(function () {
  const state = LS.State.create();
  LS.game = state;   // 개발 중 확인용 (브라우저 콘솔에서 LS.game)

  LS.UI.init(state);
  LS.Time.init(state);
  LS.Dialog.bind();

  document.getElementById('btn-pause').addEventListener('click', () => LS.Time.pause());
  document.getElementById('btn-play').addEventListener('click', () => LS.Time.play());
  document.getElementById('btn-speed').addEventListener('click', () => LS.Time.cycleSpeed());
  document.getElementById('btn-next').addEventListener('click', () => LS.Time.runToNext());

  // Space: 진행/멈춤 전환 (대화창이 열려 있으면 대사 넘기기로 쓰인다)
  document.addEventListener('keydown', (e) => {
    if (state.dialogOpen || state.gameOver) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (state.running) LS.Time.pause(); else LS.Time.play();
    }
  });

  LS.State.addLog(state, '게임 시작');
  LS.UI.renderAll();
  LS.Time.fireDue();
})();
