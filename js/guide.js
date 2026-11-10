// 처음 한 번씩 보여주는 안내창 (교수님 게임의 '오늘의 살림' 안내처럼 사건을 겪으며 하나씩 익힌다)
window.LS = window.LS || {};

LS.Guide = (function () {
  const $ = (id) => document.getElementById(id);
  let state = null;
  let after = null;

  const GUIDES = {
    time: {
      title: '이제 시간을 흘려요',
      items: [
        '방금처럼 행동은 <b>배정</b>만 해요. 배정해도 시간은 흐르지 않아요.',
        '<b>[다음 상황까지]</b>: 진행 중인 작업 중 <b>가장 먼저 끝나는 때</b>까지 진행해요.',
        '<b>[진행]</b>: 멈출 때까지 계속 흘러요. (Space)',
        '<b>[기다리기]</b>: 할 일이 없을 때 1·2·4시간이나 아침까지 기다려요.',
        '작업이 끝나거나 사건이 생기면 자동으로 멈춰요.'
      ]
    },
    work: {
      title: '작업 배정',
      items: [
        '<b>외부 확인</b> (1명·10분): 창밖에서 빈 곳인지 빠르게 확인해요.',
        '<b>파밍</b> (2명): 물자를 가져와요. 기력이 시간당 7씩 줄어요.',
        '<b>주변 정찰</b> (2명·1시간): 물자 예상을 좁히고 경보 함정을 설치해요. 그 뒤엔 침낭으로 자도 안전해요.',
        '모두 밖으로 나가면 <b>버스가 비고 엔진이 꺼져요</b>.'
      ]
    },
    rest: {
      title: '잠자리',
      items: [
        '맡은 일이 없으면 <b>저절로 좌석에서</b> 쉬어요. 기력 +1/시간, <b>80까지</b>.',
        '<b>침낭</b>(버스 옆): 바로 자요. +3/시간. 정찰(경보 함정)이나 <b>경계 2명</b>이 없으면 습격 위험.',
        '<b>잠자리 건물</b>(있을 때만): 가서 확인까지 1시간 걸리지만 +5/시간, 가장 잘 쉬어요.',
        '<b>환자용 침상</b>(1개): 아픈 사람부터 버스 안에 눕혀요.',
        '안전하게 6시간 이상 자야 정신력이, 8시간이면 HP도 조금 회복돼요.'
      ]
    },
    travel: {
      title: '이동',
      items: [
        '<b>점선</b>은 아직 모르는 큰길 (도로 사건 40%), <b>실선</b>은 확인한 길 (20%)이에요.',
        '연료는 운전 1시간에 0.1단위를 써요.',
        '운전자 기력이 <b>30에 닿으면</b> 멈춰서 교대하거나 쉬어야 해요.',
        '동승자는 침상에서 쉬어요. (기력 +2/시간, 100까지)',
        '밖에 나간 동료가 모두 돌아와야 출발할 수 있어요.'
      ]
    }
  };

  function init(s) {
    state = s;
    $('guide').addEventListener('click', (e) => { if (e.target.closest('[data-guide-ok]')) hide(); });
    // 안내창이 열려 있으면 Space/Enter로 닫는다 (시간 진행 단축키로 넘어가지 않게)
    document.addEventListener('keydown', (e) => {
      if ($('guide').classList.contains('hidden')) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        hide();
      }
    });
  }

  function show(id, then) {
    const g = GUIDES[id];
    if (!g || state.guides[id]) { if (then) then(); return false; }
    state.guides[id] = true;
    after = then || null;
    LS.Time.pause();
    state.dialogOpen = true;
    $('guide').innerHTML = `<div class="guide-card"><div class="guide-kicker">처음 오셨네요</div><h3>${g.title}</h3>` +
      `<ul>${g.items.map((t) => `<li>${t}</li>`).join('')}</ul><button data-guide-ok>알겠어요</button></div>`;
    $('guide').classList.remove('hidden');
    LS.UI.renderControls();
    return true;
  }

  function hide() {
    $('guide').classList.add('hidden');
    state.dialogOpen = false;
    const then = after;
    after = null;
    LS.UI.renderAll();
    if (then) then();
  }

  // 패널 위쪽 안내 카드용: 아직 안 본 안내면 내용을, 봤으면 null
  function card(id) { return state.guides[id] ? null : GUIDES[id]; }

  // 처음으로 시간을 흘려야 할 때(작업 배정·출발 직후) 한 번 띄운다. 사건이 모두 끝난 뒤에도 호출된다
  function check() {
    if (state.dialogOpen || state.guides.time) return;
    if (state.fired.prologue && LS.Time.busy()) show('time');
  }

  return { init, show, check, card };
})();
