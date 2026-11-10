// 화면 그리기: 위쪽 바, 장면(버스 내부·정차 외부·지도·이동), 동료 목록, 기록, 시간 조작, 알림
window.LS = window.LS || {};

LS.UI = (function () {
  const $ = (id) => document.getElementById(id);
  const A = () => LS.ASSETS;
  const R = () => LS.Rules;

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
  let minimapOpen = false;   // 지도 화면의 전체 지도 펼침

  function esc(t) {
    return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function mentalClass(label) { return label === '안정' ? '' : label === '동요' ? 'shaken' : 'broken'; }

  function isOutside(m) {
    if (!m.task) return false;
    const t = LS.Tasks.find(state, m.task);
    return !!(t && LS.Tasks.def(t.type).outside);
  }

  // ---------- 알림 ----------
  // sticky: 중요한 결과(작업 완료·식중독 등)는 눌러서 닫을 때까지 남는다. 나머지는 8초 뒤 사라진다
  function toast(text, opts) {
    const box = $('toasts');
    if (!box) return;
    const sticky = !!(opts && opts.sticky);
    const el = document.createElement('div');
    el.className = 'toast' + (sticky ? ' sticky' : '');
    el.innerHTML = `<span>${esc(text)}</span><small>${sticky ? '눌러서 닫기' : ''}</small>`;
    el.addEventListener('click', () => el.remove());
    box.appendChild(el);
    if (!sticky) {
      setTimeout(() => { el.classList.add('fade'); }, 7200);
      setTimeout(() => { el.remove(); }, 8000);
    }
    while (box.children.length > 4) box.firstChild.remove();
  }

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
    const fresh = LS.Meals.freshTotal(state);
    $('tb-resources').innerHTML = [
      res('food', '식량', `${R().round1(LS.State.foodTotal(state))} / ${r.foodCap}인분${fresh ? ` <small>(신선 ${R().round1(fresh)})</small>` : ''}`, '보존식은 상하지 않고, 신선식품은 시간이 지나면 상한다'),
      res('fuel', '연료', `${r.fuel.toFixed(1)} / ${r.fuelCap}단위`, `기본 운전 약 ${Math.floor(r.fuel * 10)}시간분`),
      res('meds', '의약품', `${r.meds}회분${r.suppressant ? ` <small>억제제 ${r.suppressant}</small>` : ''}`),
      res('parts', '부품', `${r.parts}개`)
    ].join('');

    const b = state.bus;
    $('tb-bus').innerHTML = res('bus', '버스 내구도', `${b.durability} / ${b.maxDurability}`) +
      `<button class="engine-badge ${b.engineOn ? 'on' : ''}" data-ui="engine" title="엔진을 켜면 정차 중에도 연료를 쓴다 (시간당 0.02단위)">엔진 ${b.engineOn ? '켬' : '끔'}</button>`;
  }

  // ---------- 화면 탭 ----------
  function renderTabs() {
    document.querySelectorAll('#screen-tabs [data-screen]').forEach((b) => {
      b.classList.toggle('active', b.dataset.screen === state.screen);
      b.disabled = state.dialogOpen;
    });
  }

  // ---------- 정차 외부 ----------
  function spotShort(spot) {
    const T = LS.SPOT_TYPES[spot.type];
    if (T.loot) {
      if (spot.farmedOnce) return LS.World.isEmpty(spot) ? '수색 완료' : '일부 남음';
      if (spot.checkedEmpty === true) return '비어 있음';
      if (spot.info === 'scouted') return { looted: '털린 듯', partial: '남은 듯', intact: '온전해 보임' }[spot.supply];
      if (spot.checkedEmpty === false) return '물자 있어 보임';
      return '미확인';
    }
    if (spot.building) return `${spot.building.checked ? (spot.building.threat ? '위협 있음' : '안전') : '안 미확인'} · 도보 ${spot.walk}분`;
    return '';
  }

  function sceneOutside() {
    const loc = LS.State.location(state);
    if (!loc) return '<div class="scene-empty">이동 중이다. 이동 화면이나 지도를 보세요.</div>';
    const place = LS.State.place(state);
    const night = LS.Clock.isNight(state.minute);
    const bg = A().bg[loc.bg + (night ? '_night' : '_day')];
    const areaTask = state.tasks.find((t) => t.locId === state.locationId && (t.type === 'scout_area' || t.type === 'remove_obstacle'));
    let status = place.scouted ? '정찰 완료' : '정찰 안 함';
    if (loc.roadside) status = state.roadside.blocked ? '길이 막혀 있다' : '도로 위에 멈춰 있다';
    if (areaTask) status += ` · ${LS.Tasks.def(areaTask.type).label} 중 (${R().hoursLabel(LS.Tasks.eta(state, areaTask))} 남음)`;
    let html = `<img class="scene-bg" src="${bg}" alt="">` +
      `<div class="scene-label"><div class="region">${esc(LS.REGIONS[loc.region].name)}</div><div class="name">${esc(loc.name)}</div><div class="region">${esc(status)}</div></div>` +
      `<img class="bus-ext" src="${A().bus.exterior}" alt="버스">` +
      (state.bus.engineOn ? '<div class="engine-glow"></div>' : '');
    LS.World.visibleSpots(state, loc).forEach((sp) => {
      const spot = place.spots[sp.id];
      const T = LS.SPOT_TYPES[sp.type];
      const work = state.tasks.filter((t) => t.locId === state.locationId && t.spotId === sp.id);
      html += `<button class="spot ${work.length ? 'busy' : ''} ${sp.type === 'shelter' ? 'shelter' : ''}" data-spot="${sp.id}" style="left:${sp.x}%;top:${sp.y}%">` +
        `<b>${esc(sp.label)}</b><small>${esc(T.name)} · ${esc(spotShort(spot))}</small>` +
        work.map((t) => `<span class="spot-work">${esc(t.members.map((id) => R().name(id)).join('·'))} · ${esc(LS.Tasks.labelFor(state, R().member(state, t.members[0])))}</span>`).join('') +
        '</button>';
    });
    const camping = state.tasks.filter((t) => t.type === 'camp' || t.type === 'watch');
    if (camping.length) {
      html += '<div class="camp-mark">' + camping.map((t) => `${t.type === 'camp' ? '침낭' : '경계'}: ${esc(t.members.map((id) => R().name(id)).join('·'))} (${R().hoursLabel(LS.Tasks.eta(state, t))})`).join(' · ') + '</div>';
    }
    if (loc.exit) html += '<div class="scene-note">도시 외곽의 끝. 주거 지역은 이후 단계에서 열립니다.</div>';
    const areaLabel = loc.roadside && state.roadside.blocked ? '장애물 조사·제거' : '주변 정찰';
    html += '<div class="scene-actions">' +
      `<button data-ui="area">${areaLabel}</button>` +
      '<button data-ui="camp">버스 옆 야영</button>' +
      '<button data-ui="screen" data-screen="bus">버스 안으로</button>' +
      '<button data-ui="screen" data-screen="map">지도 · 출발</button></div>';
    return html;
  }

  // ---------- 버스 내부 ----------
  function sceneBus() {
    let html = `<img class="scene-bg" src="${A().bus.interior}" alt="" style="object-fit:contain">`;
    html += `<div class="scene-label"><div class="region">버스 내부</div><div class="name">좌석 ${state.crew.length} / ${state.bus.seats} · 설비 ${state.bus.facilities.filter(Boolean).length} / ${state.bus.facilities.length}</div></div>`;
    BUS_LAYOUT.seats.forEach((p, i) => {
      if (i >= state.bus.seats) return;
      const m = state.crew[i];
      let chip = '';
      if (m) {
        const tag = state.travel ? (state.travel.driverId === m.id ? '운전' : 'zZ') : LS.Tasks.tagFor(state, m);
        chip = `<div class="chip ${isOutside(m) ? 'away' : ''}" data-crew="${m.id}" title="${esc(R().name(m.id))}"><img src="${A().portraits[m.id]}" alt="">${tag ? `<span class="chip-tag">${tag}</span>` : ''}</div>`;
      }
      html += `<div class="seat" style="left:${p.x}%;top:${p.y}%">${chip}<span class="seat-label">${i === 0 ? '운전석' : '좌석 ' + (i + 1)}</span></div>`;
    });
    if (state.bus.seats < LS.CONFIG.start.maxSeats) {
      BUS_LAYOUT.restorable.forEach((p) => { html += `<div class="seat restorable" style="left:${p.x}%;top:${p.y}%">복구<br>가능</div>`; });
    }
    state.bus.facilities.forEach((f, i) => {
      const p = BUS_LAYOUT.facilities[i];
      html += `<div class="facility" style="left:${p.x}%;top:${p.y}%"><span class="fac-name">${f ? esc(f.name) : '빈 설비 칸'}</span></div>`;
    });
    html += `<div class="locker" style="left:${BUS_LAYOUT.locker.x}%;top:${BUS_LAYOUT.locker.y}%">무기<br>보관함</div>`;
    html += '<div class="scene-actions">' +
      '<button data-ui="bus">휴식 · 대화</button>' +
      '<button data-ui="meal">식량 · 배급</button>' +
      `<button data-ui="engine">${state.bus.engineOn ? '엔진 끄기' : '엔진 켜기'}</button></div>`;
    return html;
  }

  // ---------- 지도 ----------
  function sceneMap() {
    const here = state.locationId;
    const adjacent = new Set(state.travel ? [] : LS.Travel.options(state).map((o) => o.to));
    let svg = '<svg class="map-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">';
    svg += '<rect width="1600" height="900" fill="#1a2027"/>';
    svg += '<path d="M60 160 L1260 120 L1300 820 L80 860 Z" fill="#202b25" stroke="#2f4136" stroke-width="3"/>';
    svg += '<path d="M1300 120 L1590 140 L1590 860 L1300 820 Z" fill="#232634" stroke="#363b52" stroke-width="3"/>';
    svg += '<text x="110" y="210" class="map-region">도시 외곽</text><text x="1330" y="180" class="map-region">주거 지역</text>';
    LS.ROUTES.forEach((r) => {
      const a = LS.LOCATIONS[r.a].map;
      const b = LS.LOCATIONS[r.b].map;
      const info = state.routes[LS.World.routeKey(r.a, r.b)];
      const known = info.known || info.traveled;
      svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="edge ${known ? 'known' : 'unknown'}"/>`;
      svg += `<text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 10}" class="edge-label">${r.hours}시간</text>`;
    });
    Object.keys(LS.LOCATIONS).forEach((id) => {
      const loc = LS.LOCATIONS[id];
      const pl = state.places[id];
      const cls = ['node', here === id ? 'current' : '', adjacent.has(id) ? 'adjacent' : '', pl.visited ? 'visited' : '', loc.exit ? 'exit' : ''].join(' ');
      const fc = LS.FIRST_COMPANION[id];
      const clue = fc && !state.flags.firstCompanion && !state.flags['companionSeen_' + id];
      svg += `<g class="${cls}" data-node="${id}"><circle cx="${loc.map.x}" cy="${loc.map.y}" r="20"/>` +
        `<text x="${loc.map.x}" y="${loc.map.y + 48}">${esc(loc.name)}</text>` +
        (clue ? `<text class="clue" x="${loc.map.x}" y="${loc.map.y + 78}">? ${esc(fc.short)}</text>` : '') + '</g>';
    });
    let bus = null;
    if (state.travel) bus = LS.Travel.position(state);
    else if (here === 'roadside') bus = LS.State.location(state).map;
    else if (here && LS.LOCATIONS[here]) bus = LS.LOCATIONS[here].map;
    if (bus) svg += `<g class="bus-marker"><rect x="${bus.x - 26}" y="${bus.y - 58}" width="52" height="24" rx="6"/><text x="${bus.x}" y="${bus.y - 41}">버스</text></g>`;
    svg += '</svg>';
    // 전체 지도는 접어 두고, 누르면 펼친다 (지역 지도를 가리지 않게)
    const inset = minimapOpen
      ? `<div class="map-inset open"><button class="mini" data-ui="minimap">전체 지도 ▴ 접기</button><img src="${A().map}" alt=""><span>지금은 도시 외곽${state.flags.airportKnown ? ' · 공항 위치 확인' : ''}</span></div>`
      : '<div class="map-inset"><button class="mini" data-ui="minimap">전체 지도 ▾</button></div>';
    return svg + inset +
      '<div class="scene-note bottom">장소를 누르면 이동 시간·연료·도로 정보를 볼 수 있어요. 점선은 미확인 큰길(도로 사건 40%), 실선은 확인한 길(20%).</div>';
  }

  // ---------- 이동 ----------
  function travelInfo() {
    const t = state.travel;
    if (!t) return '<div class="travel-panel"><b>지금은 이동 중이 아니에요.</b><div class="tp-row">지도에서 목적지를 고르면 출발할 수 있어요.</div></div>';
    const d = R().member(state, t.driverId);
    const pct = Math.min(100, t.progress / t.total * 100);
    const pass = LS.Travel.passengerRest(state, t.driverId, 0).map((x) =>
      `${esc(R().name(x.m.id))} ${x.bed ? '침상' : '좌석'} · 기력 ${x.now}${x.capped ? ` (${x.cap}, 그대로)` : ' ↑'}`);
    return '<div class="travel-panel">' +
      `<div class="tp-route">${esc(LS.LOCATIONS[t.from].name)} → ${esc(LS.LOCATIONS[t.to].name)}</div>` +
      `<div class="bar"><div class="energy" style="width:${pct}%"></div></div>` +
      `<div class="tp-row">남은 운전 약 ${R().hoursLabel(LS.Travel.etaMinutes(state))} · 운전 ${d ? esc(R().name(d.id)) + ' (기력 ' + Math.round(d.energy) + ', 30에서 멈춤)' : '없음'} · 연료 ${state.resources.fuel.toFixed(1)}단위</div>` +
      (pass.length ? `<div class="tp-row">동승자 휴식 (침상 +${LS.CONFIG.energy.bedMoving.rate}/시간·100까지, 좌석 +${LS.CONFIG.energy.seatRest.rate}/시간·${LS.CONFIG.energy.seatRest.cap}까지): ${pass.join(' · ')}</div>` : '') +
      '</div>';
  }

  function sceneTravel() {
    const night = LS.Clock.isNight(state.minute);
    return `<div class="travel-sky ${night ? 'night' : ''}"></div>` +
      `<div class="travel-layer travel-far" style="background-image:url('${A().travel.far}')"></div>` +
      `<div class="travel-layer travel-near" style="background-image:url('${A().travel.near}')"></div>` +
      `<img class="travel-bus" src="${A().bus.exterior}" alt="버스">` +
      `<div id="travel-info">${travelInfo()}</div>`;
  }

  function renderScene() {
    const scene = $('scene');
    const builders = { outside: sceneOutside, bus: sceneBus, map: sceneMap, travel: sceneTravel };
    scene.innerHTML = (builders[state.screen] || sceneOutside)();
    scene.dataset.screen = state.screen;
    scene.dataset.night = LS.Clock.isNight(state.minute) ? '1' : '0';
    scene.classList.toggle('scene-night', LS.Clock.isNight(state.minute));
    scene.classList.toggle('paused', !state.running || !state.travel);
  }

  // 시간이 흐르는 동안: 이동 화면은 배경 움직임이 끊기지 않게 정보만 바꾼다
  function renderSceneLive() {
    const scene = $('scene');
    const night = LS.Clock.isNight(state.minute) ? '1' : '0';
    if (state.screen === 'travel' && scene.dataset.screen === 'travel' && scene.dataset.night === night) {
      $('travel-info').innerHTML = travelInfo();
      scene.classList.toggle('paused', !state.running || !state.travel);
      return;
    }
    renderScene();
  }

  // ---------- 동료 목록 ----------
  function renderCrew() {
    const selected = LS.Panel.selectedCrew();
    $('crew-list').innerHTML = state.crew.map((m) => {
      const c = LS.CHARACTERS[m.id];
      const stage = LS.State.mentalStage(m.mental);
      const free = !state.dialogOpen && LS.Tasks.hasWork(state, m);
      const sick = R().isPoisoned(state, m);
      return `<button class="crew-card ${selected === m.id ? 'selected' : ''} ${isOutside(m) ? 'away' : ''}" data-crew="${m.id}">` +
        (free ? '<span class="crew-badge" title="이곳에 아직 맡길 만한 일이 있어요 (정찰·확인·파밍 등)">! 할 일</span>' : '') +
        `<img src="${A().portraits[m.id]}" alt="">` +
        `<div class="crew-info"><div class="crew-name">${esc(c.name)}${sick ? ' <small class="sick">식중독</small>' : ''}</div>` +
        `<div class="crew-role">${esc(LS.Tasks.labelFor(state, m))}</div>` +
        `<div class="crew-bars"><span>HP</span><div class="bar"><div class="hp" style="width:${m.hp}%"></div></div>` +
        `<span>기력</span><div class="bar"><div class="energy" style="width:${m.energy}%"></div></div>` +
        `<span>정신</span><span><span class="mental-tag ${mentalClass(stage)}">${stage}</span> <small class="deficit">결핍 ${m.deficit}</small></span></div></div></button>`;
    }).join('') + `<div class="crew-trust">리더 신뢰<br><b>${state.trust}</b> / 100</div>`;
  }

  // ---------- 기록 ----------
  // 최신 기록이 위로. 날짜마다 구분선, 종류 배지, 세부 내용은 작은 글씨로
  const LOG_KIND = {
    event: ['사건', 'ev'], task: ['작업', 'task'], travel: ['이동', 'trv'], meal: ['식사', 'meal'],
    body: ['몸', 'body'], time: ['시간', 'time'], system: ['안내', 'sys']
  };

  function renderLog() {
    const f = state.logFilter || 'all';
    document.querySelectorAll('#log [data-filter]').forEach((b) => b.classList.toggle('active', b.dataset.filter === f));
    const items = state.log.filter((e) => f === 'all' || e.important).slice().reverse();
    let html = '';
    let day = null;
    items.forEach((e) => {
      const d = LS.Clock.day(e.minute);
      if (d !== day) { day = d; html += `<li class="log-day">${d}일째</li>`; }
      const k = LOG_KIND[e.kind] || LOG_KIND.system;
      html += `<li class="log-item k-${k[1]} ${e.important ? 'important' : ''}">` +
        `<div class="log-line"><span class="log-time">${LS.Clock.timeLabel(e.minute)}</span><span class="log-badge">${k[0]}</span></div>` +
        `<div class="log-text">${esc(e.text)}</div>` +
        (e.detail ? `<div class="log-detail">${esc(e.detail)}</div>` : '') + '</li>';
    });
    $('log-list').innerHTML = html || '<li class="log-empty">아직 중요한 기록이 없어요.</li>';
  }

  // ---------- 시간 조작 ----------
  function renderControls() {
    $('btn-pause').classList.toggle('active', !state.running && !state.dialogOpen);
    $('btn-play').classList.toggle('active', state.running);
    $('btn-speed').textContent = LS.CONFIG.speeds[state.speedIndex].label;
    const disabled = state.dialogOpen || state.gameOver;
    ['btn-pause', 'btn-play', 'btn-speed', 'btn-next', 'btn-wait'].forEach((id) => { $(id).disabled = disabled; });
    $('btn-wait').classList.toggle('active', LS.Time.runInfo().mode === 'wait');
    if (disabled) $('wait-menu').classList.add('hidden');
    if (state.gameOver) $('tc-status').innerHTML = '<b>게임 종료</b>';
    else if (state.dialogOpen) $('tc-status').innerHTML = '사건·안내를 보는 중 · 시간이 멈춰 있어요';
    else {
      const nxt = LS.Time.nextStop();
      const run = LS.Time.runInfo();
      $('btn-next').disabled = !nxt;
      $('btn-next').classList.toggle('active', run.mode === 'next');
      if (run.mode === 'wait') $('tc-status').innerHTML = `기다리는 중 · <b>${LS.Clock.fullLabel(run.goal)}</b>까지 (작업이 끝나거나 사건이 생기면 먼저 멈춰요)`;
      else if (nxt) $('tc-status').innerHTML = `다음 상황: <b>${esc(nxt.label)}</b> (${nxt.busy ? '약 ' : ''}${LS.Clock.fullLabel(nxt.at)})`;
      else $('tc-status').innerHTML = '진행 중인 일 없음 · 작업을 배정하거나 <b>[기다리기]</b>·<b>[진행]</b>으로 시간을 보내세요';
    }
    $('scene').classList.toggle('paused', !state.running || !state.travel);
    renderTabs();
  }

  function renderAll() {
    renderTopbar();
    renderTabs();
    renderScene();
    renderCrew();
    LS.Panel.render();
    renderLog();
    renderControls();
  }

  function renderLive() {
    renderTopbar();
    renderSceneLive();
    renderCrew();
    if (LS.Panel.isOpen()) LS.Panel.render();
    renderLog();
    renderControls();
  }

  function setScreen(id) {
    state.screen = id;
    LS.Panel.close();
    renderTabs();
    renderScene();
    renderCrew();
  }

  function toggleEngine() {
    if (state.dialogOpen) return;
    if (state.travel) { toast('이동 중에는 엔진을 끌 수 없다.'); return; }
    if (!state.bus.engineOn && state.resources.fuel <= 0) { toast('연료가 없다.'); return; }
    if (!state.bus.engineOn && state.crew.every((m) => isOutside(m))) { toast('버스에 사람이 없다.'); return; }
    state.bus.engineOn = !state.bus.engineOn;
    LS.State.addLog(state, state.bus.engineOn ? '엔진을 켰다' : '엔진을 껐다', false, 'system', state.bus.engineOn ? '공회전: 연료 시간당 0.02단위' : '');
    if (state.bus.engineOn && !state.bus.facilities.some((f) => f && f.power)) {
      toast('지금은 켜도 쓸 설비가 없어요. (냉장고·의무실 같은 설비는 6단계에서 생겨요) 연료만 시간당 0.02단위 들어요.');
    }
    renderAll();
  }

  function bind() {
    $('screen-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-screen]');
      if (!b || state.dialogOpen) return;
      setScreen(b.dataset.screen);
    });
    $('crew-list').addEventListener('click', (e) => {
      const c = e.target.closest('[data-crew]');
      if (!c || state.dialogOpen) return;
      if (LS.Panel.selectedCrew() === c.dataset.crew) LS.Panel.close(); else LS.Panel.open('crew', c.dataset.crew);
      renderCrew();
    });
    $('scene').addEventListener('click', (e) => {
      if (state.dialogOpen) return;
      const crew = e.target.closest('[data-crew]');
      if (crew) { LS.Panel.open('crew', crew.dataset.crew); renderCrew(); return; }
      const spot = e.target.closest('[data-spot]');
      if (spot) { LS.Panel.open('spot', spot.dataset.spot); return; }
      const node = e.target.closest('[data-node]');
      if (node) { LS.Panel.open('route', node.dataset.node); return; }
      const ui = e.target.closest('[data-ui]');
      if (!ui) return;
      const kind = ui.dataset.ui;
      if (kind === 'screen') setScreen(ui.dataset.screen);
      else if (kind === 'engine') toggleEngine();
      else if (kind === 'minimap') { minimapOpen = !minimapOpen; renderScene(); }
      else LS.Panel.open(kind);
    });
    $('tb-bus').addEventListener('click', (e) => { if (e.target.closest('[data-ui="engine"]')) toggleEngine(); });
    $('log').addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      state.logFilter = b.dataset.filter;
      renderLog();
    });
  }

  function init(s) { state = s; bind(); }

  return { init, renderAll, renderLive, renderTopbar, renderTabs, renderScene, renderCrew, renderLog, renderControls, setScreen, toast, esc };
})();
