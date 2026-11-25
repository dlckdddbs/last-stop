// 저장·이어하기 (참조 B "저장해야 할 상태"). 2026-11-25, 기말 피드백 1번.
// 게임 상태(state)를 통째로 브라우저에 저장한다: 시간·위치·동료·자원·작업·사건·약속·평판·기록이 모두 그 안에 있다.
// 사건 대화창이 열려 있거나 열릴 사건이 남아 있을 때는 저장하지 않는다. 그 사건의 결과가 아직 반영되지 않았기 때문이다.
// 새로고침하면 마지막으로 '멈춰 있던' 순간으로 돌아오고, 이미 받은 보상·지난 사건은 다시 일어나지 않는다.
window.LS = window.LS || {};

LS.Save = (function () {
  const KEY = 'lastStop.save';
  const VERSION = 1;
  let timer = null;
  let lastSaved = null;     // { minute, at }

  function store() { try { return window.localStorage; } catch (e) { return null; } }

  // 저장해도 되는 순간: 시간이 멈춰 있고, 대화창도 없고, 기다리는 사건도 없다
  function settled(state) {
    return !!state && !state.dialogOpen && !state.gameOver && LS.Time.queueEmpty();
  }

  function write(state) {
    const ls = store();
    if (!ls || !state || state.gameOver) return false;
    try {
      const data = { v: VERSION, savedAt: Date.now(), minute: state.minute, locationId: state.locationId, travelTo: state.travel ? state.travel.to : null, crew: state.crew.length, state };
      ls.setItem(KEY, JSON.stringify(data));
      lastSaved = { minute: state.minute, at: Date.now() };
      if (LS.UI && LS.UI.renderSaveBadge) LS.UI.renderSaveBadge();
      return true;
    } catch (e) {
      return false;
    }
  }

  // 화면이 갱신될 때마다 부른다. 짧은 시간에 여러 번 불려도 한 번만 저장한다
  function autosave(state) {
    if (!settled(state)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; if (settled(state)) write(state); }, 250);
  }

  function peek() {
    const ls = store();
    if (!ls) return null;
    try {
      const raw = ls.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.v !== VERSION || !d.state || d.state.gameOver) return null;
      return d;
    } catch (e) {
      return null;
    }
  }

  function clear() {
    const ls = store();
    try { if (ls) ls.removeItem(KEY); } catch (e) { /* 저장소를 쓸 수 없는 환경 */ }
    lastSaved = null;
  }

  // 저장한 뒤에 장소·길·집단이 추가돼도 이어할 수 있게, 없는 값은 새 게임의 기본값으로 채운다
  function migrate(s) {
    const fresh = LS.State.create();
    Object.keys(fresh).forEach((k) => { if (!(k in s)) s[k] = fresh[k]; });
    ['places', 'routes', 'reputation', 'repWhy', 'refuges', 'barricades', 'flags', 'people', 'guides'].forEach((k) => {
      if (!s[k] || typeof s[k] !== 'object') { s[k] = fresh[k]; return; }
      Object.keys(fresh[k]).forEach((x) => { if (!(x in s[k])) s[k][x] = fresh[k][x]; });
    });
    ['helped', 'letGo', 'rumors', 'betrayals'].forEach((k) => { if (!s.record[k]) s.record[k] = []; });
    Object.keys(fresh.requests).forEach((k) => { if (!(k in s.requests)) s.requests[k] = fresh.requests[k]; });
    s.running = false;
    s.dialogOpen = false;
    return s;
  }

  function load() {
    const d = peek();
    if (!d) return null;
    const s = migrate(d.state);
    lastSaved = { minute: s.minute, at: d.savedAt };
    LS.Tasks.syncSeq(s);
    LS.Requests.syncSeq(s);
    return s;
  }

  function where(d) {
    if (d.travelTo) return `${LS.Rules.josa(LS.Travel.locName(d.travelTo), '으로')} 가는 길`;
    if (d.locationId === 'roadside') return '도로 위';
    return d.locationId && LS.LOCATIONS[d.locationId] ? LS.LOCATIONS[d.locationId].name : '';
  }

  function summary(d) { return `${LS.Clock.fullLabel(d.minute)} · ${where(d)} · 동료 ${d.crew}명`; }

  function lastLabel() { return lastSaved ? LS.Clock.fullLabel(lastSaved.minute) : ''; }

  return { write, autosave, peek, clear, load, summary, settled, lastLabel };
})();
