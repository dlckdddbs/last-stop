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
  let active = false;    // 대화창이 실제로 열려 있는가 (안내창도 dialogOpen을 쓰므로 따로 둔다)
  let logEntry = null;   // 이 사건의 기록 한 줄 (선택·결과를 세부 줄에 덧붙인다)

  const esc = (t) => LS.UI.esc(t);

  function speakerInfo(id) {
    if (LS.CHARACTERS[id]) return { name: LS.CHARACTERS[id].name, portrait: LS.ASSETS.portraits[id] };
    const sp = LS.SPEAKERS[id] || LS.SPEAKERS.narration;
    return { name: sp.name, portrait: sp.portrait ? LS.ASSETS.portraits[sp.portrait] : null };
  }

  // eventOrId: data/events.js의 id 또는 그 자리에서 만든 사건 객체
  function open(s, eventOrId, done) {
    state = s;
    ev = typeof eventOrId === 'string' ? LS.EVENTS[eventOrId] : eventOrId;
    onDone = done || null;
    chosen = null;
    LS.Time.pause();
    state.dialogOpen = true;
    active = true;
    LS.Panel.close();                   // 사건 중에는 옆 패널을 닫는다
    LS.UI.renderCrew();
    if (ev.screen) LS.UI.setScreen(ev.screen);
    pages = ev.lines.slice();
    idx = 0;
    phase = 'lines';
    $('dlg-title').textContent = `사건 · ${ev.title} · ${LS.Clock.fullLabel(state.minute)}`;
    $('dialog').classList.remove('hidden');
    logEntry = LS.State.addLog(state, ev.title, true, 'event');
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
    $('dialog').classList.remove('has-choices', 'single-choice');
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
    $('dlg-extra').classList.toggle('single', (ev.observations && ev.observations.length ? 1 : 0) + (ev.opinions && ev.opinions.length ? 1 : 0) === 1);
    // 선택지가 하나뿐이면 고르는 척하지 않고 '계속' 버튼으로 보여준다 (Space로도 넘어간다)
    const single = ev.choices.length === 1;
    if (single) t.textContent = '확인했으면 계속하세요.';
    $('dlg-choices').innerHTML = ev.choices.map((c, i) =>
      `<button class="${single ? 'continue' : ''}" data-choice="${i}" ${c.disabled ? 'disabled' : ''}>${single ? '▶ ' : ''}${esc(c.label)}${c.desc ? `<span class="choice-desc">${esc(c.desc)}</span>` : ''}</button>`
    ).join('');
    $('dialog').classList.add('has-choices');
    $('dialog').classList.toggle('single-choice', single);
    $('dlg-page').textContent = '';
  }

  function choose(i) {
    chosen = ev.choices[i];
    if (logEntry && ev.choices.length > 1) logEntry.detail = `선택: ${chosen.label}`;
    const r = chosen.result || {};
    pages = (r.lines || []).slice();
    idx = 0;
    phase = 'result';
    if (pages.length) showLine(); else finish();
  }

  function finish() {
    const r = (chosen && chosen.result) || {};
    if (chosen && chosen.run) chosen.run(state);
    if (r.flags) Object.assign(state.flags, r.flags);
    if (r.log && logEntry) logEntry.detail = [logEntry.detail, r.log].filter(Boolean).join(' · ');
    $('dialog').classList.add('hidden');
    state.dialogOpen = false;
    active = false;
    chosen = null;
    if (r.goto) state.screen = r.goto;
    LS.UI.renderAll();
    if (onDone) onDone();
  }

  function advance() {
    if (!active) return;
    if (phase === 'decision') {
      if (ev.choices.length === 1 && !ev.choices[0].disabled) choose(0);
      return;
    }
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
      if (b) { e.stopPropagation(); if (!b.disabled) choose(Number(b.dataset.choice)); return; }
      advance();
    });
    // 대화창이 열려 있으면 Space/Enter는 대사 넘기기에만 쓴다
    document.addEventListener('keydown', (e) => {
      if (!active) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        advance();
      }
    });
  }

  return { open, bind };
})();
