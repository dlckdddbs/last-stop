// 화면 그리기: 위쪽 바, 장면(버스 내부·정차 외부·지도·이동), 동료 목록, 기록, 시간 조작 상태
window.LS = window.LS || {};

LS.UI = (function () {
  const $ = (id) => document.getElementById(id);
  const A = () => LS.ASSETS;

  // 버스 내부 평면도 위치 (images/bus/interior.svg와 맞춘 백분율 좌표)
  const BUS_LAYOUT = {
    seats: [
      { x: 12.5, y: 66.7 }, { x: 23.75, y: 28.9 }, { x: 23.75, y: 68.9 },
      { x: 33.75, y: 28.9 }, { x: 33.75, y: 68.9 }, { x: 43.75, y: 28.9 }
    ],
    restorable: [{ x: 43.75, y: 68.9 }, { x: 53.75, y: 68.9 }],
    facilities: [{ x: 68.75, y: 35 }, { x: 85, y: 35 }, { x: 68.75, y: 65 }, { x: 85, y: 65 }],
    locker: { x: 12.2, y: 30 }
  };

  let state = null;

  function esc(t) {
    return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function mentalClass(label) { return label === '안정' ? '' : label === '동요' ? 'shaken' : 'broken'; }

  // ---------- 위쪽 바 ----------
  function res(icon, label, value, title) {
    return `<div class="res" title="${esc(title || '')}"><img src="${A().icons[icon]}" alt="">` +
      `<div><span class="res-label">${label}</span><span class="res-value">${value}</span></div></div>`;
  }

  function renderTopbar() {
    const m = state.minute;
    $('tb-day').textContent = 'D' + LS.Clock.day(m);
    $('tb-clock').textContent = LS.Clock.timeLabel(m);
    const night = LS.Clock.isNight(m);
    const ph = $('tb-phase');
    ph.textContent = night ? '밤' : '낮';
    ph.classList.toggle('day', !night);
    $('tb-remaining').textContent = LS.Clock.remainingLabel(m);
    $('tb-remaining-bar').style.width = (LS.Clock.remaining(m) / LS.Clock.end() * 100) + '%';

    const r = state.resources;
    $('tb-resources').innerHTML = [
      res('food', '식량', `${r.food} / ${r.foodCap}인분`, '보존식은 상하지 않는다'),
      res('fuel', '연료', `${r.fuel.toFixed(1)} / ${r.fuelCap}단위`, `기본 운전 약 ${Math.round(r.fuel * 10)}시간분`),
      res('meds', '의약품', `${r.meds}회분`),
      res('parts', '부품', `${r.parts}개`)
    ].join('');

    const b = state.bus;
    $('tb-bus').innerHTML = res('bus', '버스 내구도', `${b.durability} / ${b.maxDurability}`) +
      `<span class="engine-badge ${b.engineOn ? 'on' : ''}" title="엔진 켜고 끄기는 2단계에서">엔진 ${b.engineOn ? '켬' : '끔'}</span>`;
  }

  // ---------- 화면 탭 ----------
  function renderTabs() {
    document.querySelectorAll('#screen-tabs [data-screen]').forEach((b) => {
      b.classList.toggle('active', b.dataset.screen === state.screen);
      b.disabled = state.dialogOpen;
    });
  }

  // ---------- 장면 ----------
  function sceneOutside() {
    const loc = LS.State.location(state);
    const night = LS.Clock.isNight(state.minute);
    const bg = A().bg[loc.bg + (night ? '_night' : '_day')];
    return `<img class="scene-bg" src="${bg}" alt="">` +
      `<div class="scene-label"><div class="region">${esc(LS.REGIONS[loc.region].name)}</div><div class="name">${esc(loc.name)}</div></div>` +
      `<img class="bus-ext" src="${A().bus.exterior}" alt="버스">` +
      (state.bus.engineOn ? '<div class="engine-glow"></div>' : '') +
      loc.spots.map((s) => `<div class="spot" style="left:${s.x}%;top:${s.y}%" title="정찰·파밍은 2단계에서 열립니다">${esc(s.label)}</div>`).join('') +
      `<div class="scene-note">정차 외부 · 주변 건물 정찰, 파밍, 외부 정비, 생존자 접촉 (2단계에서 연결)</div>`;
  }

  function sceneBus() {
    let html = `<img class="scene-bg" src="${A().bus.interior}" alt="" style="object-fit:contain">`;
    const used = state.crew.length;
    html += `<div class="scene-label"><div class="region">버스 내부</div><div class="name">좌석 ${used} / ${state.bus.seats} · 설비 ${state.bus.facilities.filter(Boolean).length} / ${state.bus.facilities.length}</div></div>`;
    BUS_LAYOUT.seats.forEach((p, i) => {
      if (i >= state.bus.seats) return;
      const m = state.crew[i];
      const chip = m ? `<div class="chip" data-crew="${m.id}" title="${esc(LS.CHARACTERS[m.id].name)}"><img src="${A().portraits[m.id]}" alt=""></div>` : '';
      html += `<div class="seat" style="left:${p.x}%;top:${p.y}%">${chip}<span class="seat-label">${i === 0 ? '운전석' : '좌석 ' + (i + 1)}</span></div>`;
    });
    if (state.bus.seats < LS.CONFIG.start.maxSeats) {
      BUS_LAYOUT.restorable.forEach((p) => {
        html += `<div class="seat restorable" style="left:${p.x}%;top:${p.y}%">복구<br>가능</div>`;
      });
    }
    state.bus.facilities.forEach((f, i) => {
      const p = BUS_LAYOUT.facilities[i];
      html += `<div class="facility" style="left:${p.x}%;top:${p.y}%"><span class="fac-name">${f ? esc(f.name) : '빈 설비 칸'}</span></div>`;
    });
    html += `<div class="locker" style="left:${BUS_LAYOUT.locker.x}%;top:${BUS_LAYOUT.locker.y}%">무기<br>보관함</div>`;
    html += `<div class="scene-note bottom">버스 내부 · 동료 상태, 휴식, 치료, 설비 관리. 좌석의 동료를 누르면 상태를 볼 수 있어요.</div>`;
    return html;
  }

  function sceneMap() {
    const loc = LS.State.location(state);
    const ap = LS.REGIONS.airport.map;
    const known = !!state.flags.airportKnown;
    return `<img class="scene-bg" src="${A().map}" alt="" style="object-fit:contain">` +
      `<div class="map-marker airport ${known ? '' : 'unknown'}" style="left:${ap.x}%;top:${ap.y}%"><span class="tag">${known ? '공항 · 대피 접수' : '공항 (방송 전)'}</span><span class="pin"></span></div>` +
      `<div class="map-marker" style="left:${loc.map.x}%;top:${loc.map.y}%"><span class="tag">현재 위치 · ${esc(loc.name)}</span><span class="pin"></span></div>` +
      `<div class="scene-note bottom">지도 · 연결 경로, 이동 시간, 보급 가능성, 관측 정보 (2단계에서 장소와 경로가 열립니다). 최단 경로 순수 운전 약 130시간.</div>`;
  }

  function sceneTravel() {
    const night = LS.Clock.isNight(state.minute);
    return `<div class="travel-sky ${night ? 'night' : ''}"></div>` +
      `<div class="travel-layer travel-far" style="background-image:url('${A().travel.far}')"></div>` +
      `<div class="travel-layer travel-near" style="background-image:url('${A().travel.near}')"></div>` +
      `<img class="travel-bus" src="${A().bus.exterior}" alt="버스">` +
      `<div class="scene-note">이동 화면 미리보기 · 시간이 흐를 때 움직여요. 실제 이동과 도로 사건은 2단계에서 연결됩니다.</div>`;
  }

  function renderScene() {
    const scene = $('scene');
    const builders = { outside: sceneOutside, bus: sceneBus, map: sceneMap, travel: sceneTravel };
    scene.innerHTML = (builders[state.screen] || sceneOutside)();
    scene.classList.toggle('scene-night', LS.Clock.isNight(state.minute));
    scene.classList.toggle('paused', !state.running);
  }

  // ---------- 동료 목록 ----------
  function renderCrew() {
    $('crew-list').innerHTML = state.crew.map((m) => {
      const c = LS.CHARACTERS[m.id];
      const stage = LS.State.mentalStage(m.mental);
      return `<button class="crew-card ${state.selectedCrew === m.id ? 'selected' : ''}" data-crew="${m.id}">` +
        `<span class="crew-badge" title="새 작업 배정 가능 (작업은 2단계에서)">!</span>` +
        `<img src="${A().portraits[m.id]}" alt="">` +
        `<div class="crew-info"><div class="crew-name">${esc(c.name)}</div><div class="crew-role">${esc(c.role)}</div>` +
        `<div class="crew-bars"><span>HP</span><div class="bar"><div class="hp" style="width:${m.hp}%"></div></div>` +
        `<span>기력</span><div class="bar"><div class="energy" style="width:${m.energy}%"></div></div>` +
        `<span>정신</span><span><span class="mental-tag ${mentalClass(stage)}">${stage}</span></span></div></div></button>`;
    }).join('') + `<div class="crew-trust">리더 신뢰<br><b>${state.trust}</b> / 100</div>`;
  }

  // ---------- 상세 정보 ----------
  function stat(label, value, max, cls) {
    return `<div class="stat"><div class="stat-row"><span>${label}</span><span class="v">${value} / ${max}</span></div>` +
      `<div class="bar"><div class="${cls}" style="width:${value / max * 100}%"></div></div></div>`;
  }

  function renderDetail() {
    const box = $('detail');
    const m = state.crew.find((x) => x.id === state.selectedCrew);
    if (!m) { box.classList.add('hidden'); return; }
    const c = LS.CHARACTERS[m.id];
    const stage = LS.State.mentalStage(m.mental);
    box.innerHTML = `<button class="det-close" data-close>✕</button>` +
      `<div class="det-head"><img src="${A().portraits[m.id]}" alt=""><div><div class="det-name">${esc(c.name)}</div><div class="det-role">${esc(c.role)}</div></div></div>` +
      stat('HP', m.hp, 100, 'hp') +
      stat('기력', m.energy, 100, 'energy') +
      `<div class="stat"><div class="stat-row"><span>정신력</span><span class="mental-tag ${mentalClass(stage)}">${stage}</span></div></div>` +
      `<div class="stat"><div class="stat-row"><span>식사 결핍</span><span class="v">${m.deficit} / 6</span></div></div>` +
      `<div class="stat"><div class="stat-row"><span>상태</span><span class="v">${esc(m.status)}</span></div></div>` +
      `<div class="stat"><div class="stat-row"><span>현재 행동</span><span class="v">${esc(m.task || '대기')}</span></div></div>` +
      `<div class="stat"><div class="stat-row"><span>운전</span><span class="v">${c.canDrive ? '가능' : '불가'}</span></div></div>` +
      `<ul class="det-traits">${c.traits.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
    box.classList.remove('hidden');
  }

  // ---------- 기록 ----------
  function renderLog() {
    $('log-list').innerHTML = state.log.map((e) =>
      `<li class="${e.important ? 'important' : ''}"><span class="log-time">${LS.Clock.fullLabel(e.minute)}</span>${esc(e.text)}</li>`
    ).join('');
  }

  // ---------- 시간 조작 ----------
  function renderControls() {
    $('btn-pause').classList.toggle('active', !state.running && !state.dialogOpen);
    $('btn-play').classList.toggle('active', state.running);
    $('btn-speed').textContent = LS.CONFIG.speeds[state.speedIndex].label;
    const disabled = state.dialogOpen || state.gameOver;
    ['btn-pause', 'btn-play', 'btn-speed', 'btn-next'].forEach((id) => { $(id).disabled = disabled; });
    if (state.gameOver) {
      $('tc-status').innerHTML = '<b>접수 마감</b>';
    } else if (state.dialogOpen) {
      $('tc-status').innerHTML = '사건 진행 중 · 시간이 멈춰 있어요';
    } else {
      const nxt = LS.Time.nextStop();
      $('tc-status').innerHTML = `다음 상황: <b>${esc(nxt.label)}</b> (${LS.Clock.fullLabel(nxt.at)})`;
    }
    $('scene').classList.toggle('paused', !state.running);
    renderTabs();
  }

  function renderAll() {
    renderTopbar();
    renderTabs();
    renderScene();
    renderCrew();
    renderDetail();
    renderLog();
    renderControls();
  }

  function setScreen(id) {
    state.screen = id;
    if (state.selectedCrew) { state.selectedCrew = null; renderDetail(); renderCrew(); }
    renderTabs();
    renderScene();
  }

  function selectCrew(id) {
    state.selectedCrew = state.selectedCrew === id ? null : id;
    renderDetail();
    renderCrew();
  }

  function bind() {
    $('screen-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-screen]');
      if (!b || state.dialogOpen) return;
      setScreen(b.dataset.screen);
    });
    $('crew-list').addEventListener('click', (e) => {
      const c = e.target.closest('[data-crew]');
      if (c) selectCrew(c.dataset.crew);
    });
    $('scene').addEventListener('click', (e) => {
      const c = e.target.closest('[data-crew]');
      if (c) selectCrew(c.dataset.crew);
    });
    $('detail').addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { state.selectedCrew = null; renderDetail(); renderCrew(); }
    });
  }

  function init(s) { state = s; bind(); }

  return { init, renderAll, renderTopbar, renderTabs, renderScene, renderCrew, renderDetail, renderLog, renderControls, setScreen, esc };
})();
