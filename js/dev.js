// 개발용 도구: 주소 끝에 ?dev=1 을 붙였을 때만 보인다 (일반 플레이에는 없음).
// 날짜 건너뛰기·장소 이동·물자·동료 추가로, 뒤쪽 날짜의 내용을 처음부터 플레이하지 않고 확인한다.
// 건너뛴 시간 동안의 식사·기력·좀비는 계산하지 않는다 (확인용이라 결과가 실제 플레이와 다를 수 있다).
window.LS = window.LS || {};

LS.Dev = (function () {
  const on = /[?&]dev=1\b/.test(location.search);
  const $ = (id) => document.getElementById(id);

  function s() { return LS.game; }
  function say(t) { LS.UI.toast(t); }

  function clearWork(st) {
    st.tasks = [];
    st.crew.forEach((m) => { m.task = null; });
  }

  function clearZombies(st) {
    st.zombie.horde = null;
    st.zombie.siege = null;
    st.zombie.pursuit = null;
    st.zombie.hidOnce = false;
    st.stop = { since: st.minute, nextRoll: st.minute + LS.CONFIG.zombie.stopMin };
  }

  // day일째 hour시로 건너뛴다. 사이의 예정 사건(라디오·다리 폐쇄 등)은 차례로 연다
  function jump(day, hour) {
    const st = s();
    if (st.dialogOpen) return say('대화창을 먼저 닫아 주세요.');
    if (st.travel) return say('이동 중에는 건너뛸 수 없어요. 도착한 뒤에 써 주세요.');
    const target = (day - 1) * 1440 + hour * 60;
    if (target <= st.minute) return say('지금보다 뒤의 시각을 골라 주세요.');
    LS.Time.pause();
    clearWork(st);
    st.minute = Math.min(target, LS.Clock.end() - 1);
    clearZombies(st);
    LS.State.addLog(st, `[개발] ${day}일째 ${String(hour).padStart(2, '0')}시로 건너뜀`, false, 'system', '사이의 식사·기력·좀비는 계산하지 않음');
    const due = LS.SCHEDULE.filter((e) => !st.fired[e.event] && e.at <= st.minute).sort((a, b) => a.at - b.at);
    due.forEach((e) => { st.fired[e.event] = true; });
    LS.UI.renderAll();
    if (due.length) LS.Time.handle(due.map((e) => ({ dialog: e.event })));
  }

  function teleport(id) {
    const st = s();
    if (st.dialogOpen) return say('대화창을 먼저 닫아 주세요.');
    if (st.travel) return say('이동 중에는 쓸 수 없어요.');
    LS.Time.pause();
    clearWork(st);
    clearZombies(st);
    LS.UI.renderAll();
    st.arrivedFrom = null;
    LS.Time.handle(LS.Travel.landAt(st, id));
  }

  function give(kind) {
    const r = s().resources;
    if (kind === 'food') LS.Meals.addFood(s(), 10, 0);
    if (kind === 'parts') r.parts += 5;
    if (kind === 'fuel') r.fuel = Math.min(r.fuelCap, r.fuel + 2);
    if (kind === 'meds') r.meds += 3;
    LS.UI.renderAll();
  }

  function healAll() {
    s().crew.forEach((m) => { m.hp = 100; m.energy = 100; m.mental = 80; m.deficit = 0; m.poisonUntil = 0; });
    LS.UI.renderAll();
  }

  function addCrew(id) {
    if (!id) return;
    LS.State.addMember(s(), id, '[개발] 바로 합류');
    LS.UI.renderAll();
  }

  function render() {
    const st = s();
    const box = $('devbox');
    const locs = Object.keys(LS.LOCATIONS).filter((id) => !LS.LOCATIONS[id].exit)
      .map((id) => `<option value="${id}">${LS.REGIONS[LS.LOCATIONS[id].region].name} · ${LS.LOCATIONS[id].name}</option>`).join('');
    const chars = Object.keys(LS.CHARACTERS).filter((id) => !st.crew.some((m) => m.id === id))
      .map((id) => `<option value="${id}">${LS.CHARACTERS[id].name}</option>`).join('');
    const day = LS.Clock.day(st.minute);
    box.innerHTML =
      '<div class="dev-head">개발 도구 <small>(?dev=1 일 때만 보임)</small></div>' +
      `<label>날짜 <input id="dev-day" type="number" min="1" max="30" value="${Math.min(30, day + 1)}">일째 ` +
      '<input id="dev-hour" type="number" min="0" max="23" value="6">시</label> <button data-dev="jump">건너뛰기</button>' +
      `<label>장소 <select id="dev-loc">${locs}</select></label> <button data-dev="tp">이동</button>` +
      `<label>동료 <select id="dev-char"><option value="">(고르기)</option>${chars}</select></label> <button data-dev="add">합류</button>` +
      '<div class="dev-row"><button data-dev="food">식량 +10</button><button data-dev="parts">부품 +5</button>' +
      '<button data-dev="fuel">연료 +2</button><button data-dev="meds">약 +3</button></div>' +
      '<div class="dev-row"><button data-dev="heal">전원 회복</button><button data-dev="nozombie">좀비 없애기</button></div>';
    $('dev-loc').value = st.locationId in LS.LOCATIONS ? st.locationId : 'start_firestation';
  }

  function init() {
    if (!on) return;
    const btn = document.createElement('button');
    btn.id = 'devtoggle';
    btn.textContent = '개발';
    const box = document.createElement('div');
    box.id = 'devbox';
    box.className = 'hidden';
    document.body.appendChild(btn);
    document.body.appendChild(box);
    btn.addEventListener('click', () => { box.classList.toggle('hidden'); if (!box.classList.contains('hidden')) render(); });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dev]');
      if (!b) return;
      const k = b.dataset.dev;
      if (k === 'jump') jump(Number($('dev-day').value), Number($('dev-hour').value));
      else if (k === 'tp') teleport($('dev-loc').value);
      else if (k === 'add') addCrew($('dev-char').value);
      else if (k === 'heal') healAll();
      else if (k === 'nozombie') { clearZombies(s()); LS.UI.renderAll(); }
      else give(k);
      render();
    });
  }

  return { on, init, jump, teleport, give, healAll, addCrew };
})();

LS.Dev.init();
