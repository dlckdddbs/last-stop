// 대화창 (사건 장면). 진행: 대사 → 판단(관찰 정보·동료 의견·선택) → 결과 대사
// 사건이 열려 있는 동안 시간은 멈춘다 (01장).
window.LS = window.LS || {};

LS.Dialog = (function () {
  const $ = (id) => document.getElementById(id);
  let state = null;
  let ev = null;
  let pages = [];
  let idx = 0;
  let phase = 'lines';   // lines | decision | result
  let chosen = null;
  let onDone = null;

  const esc = (t) => LS.UI.esc(t);

  function speakerInfo(id) {
    if (LS.CHARACTERS[id]) return { name: LS.CHARACTERS[id].name, portrait: LS.ASSETS.portraits[id] };
    const sp = LS.SPEAKERS[id] || LS.SPEAKERS.narration;
    return { name: sp.name, portrait: sp.portrait ? LS.ASSETS.portraits[sp.portrait] : null };
  }

  function open(s, eventId, done) {
    state = s;
    ev = LS.EVENTS[eventId];
    onDone = done || null;
    chosen = null;
    LS.Time.pause();
    state.dialogOpen = true;
    state.selectedCrew = null;          // 사건 중에는 상세 정보 패널을 닫는다
    LS.UI.renderDetail();
    LS.UI.renderCrew();
    if (ev.screen) LS.UI.setScreen(ev.screen);
    pages = ev.lines.slice();
    idx = 0;
    phase = 'lines';
    $('dlg-title').textContent = `사건 · ${ev.title} · ${LS.Clock.fullLabel(state.minute)}`;
    $('dialog').classList.remove('hidden');
    LS.State.addLog(state, `사건: ${ev.title}`, true);
    LS.UI.renderLog();
    LS.UI.renderControls();
    showLine();
  }

  function showLine() {
    const line = pages[idx];
    const info = speakerInfo(line.speaker);
    const p = $('dlg-portrait');
    if (info.portrait) { p.src = info.portrait; p.classList.remove('none'); }
    else { p.removeAttribute('src'); p.classList.add('none'); }
    $('dlg-speaker').textContent = info.name;
    const t = $('dlg-text');
    t.textContent = line.text;
    t.classList.toggle('narration', line.speaker === 'narration');
    $('dlg-extra').innerHTML = '';
    $('dlg-choices').innerHTML = '';
    $('dialog').classList.remove('has-choices');
    $('dlg-page').textContent = `${idx + 1} / ${pages.length}`;
  }

  function showDecision() {
    phase = 'decision';
    $('dlg-portrait').classList.add('none');
    $('dlg-speaker').textContent = '판단';
    const t = $('dlg-text');
    t.classList.remove('narration');
    t.textContent = '어떻게 할까?';
    let extra = '';
    if (ev.observations && ev.observations.length) {
      extra += `<div class="dlg-box"><h4>관찰 정보</h4><ul>${ev.observations.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>`;
    }
    if (ev.opinions && ev.opinions.length) {
      extra += `<div class="dlg-box"><h4>동료 의견</h4>${ev.opinions.map((o) => `<p><b>${esc(speakerInfo(o.speaker).name)}</b> ${esc(o.text)}</p>`).join('')}</div>`;
    }
    $('dlg-extra').innerHTML = extra;
    $('dlg-choices').innerHTML = ev.choices.map((c, i) =>
      `<button data-choice="${i}">${esc(c.label)}${c.desc ? `<span class="choice-desc">${esc(c.desc)}</span>` : ''}</button>`
    ).join('');
    $('dialog').classList.add('has-choices');
    $('dlg-page').textContent = '';
  }

  function choose(i) {
    chosen = ev.choices[i];
    LS.State.addLog(state, `선택: ${chosen.label}`);
    const r = chosen.result || {};
    pages = (r.lines || []).slice();
    idx = 0;
    phase = 'result';
    if (pages.length) showLine(); else finish();
  }

  function finish() {
    const r = (chosen && chosen.result) || {};
    if (r.flags) Object.assign(state.flags, r.flags);
    if (r.log) LS.State.addLog(state, r.log);
    $('dialog').classList.add('hidden');
    state.dialogOpen = false;
    chosen = null;
    if (r.goto) state.screen = r.goto;
    LS.UI.renderAll();
    if (onDone) onDone();
  }

  function advance() {
    if (!state || !state.dialogOpen || phase === 'decision') return;
    if (idx < pages.length - 1) { idx++; showLine(); return; }
    if (phase === 'lines') {
      if (ev.choices && ev.choices.length) showDecision(); else finish();
    } else {
      finish();
    }
  }

  function bind() {
    $('dialog').addEventListener('click', (e) => {
      const b = e.target.closest('[data-choice]');
      if (b) { e.stopPropagation(); choose(Number(b.dataset.choice)); return; }
      advance();
    });
    // 대화창이 열려 있으면 Space/Enter는 대사 넘기기에만 쓴다
    document.addEventListener('keydown', (e) => {
      if (!state || !state.dialogOpen) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        advance();
      }
    });
  }

  return { open, bind };
})();
