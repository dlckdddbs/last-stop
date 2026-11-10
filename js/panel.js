// 장면 오른쪽에 펼치는 패널: 동료 상세, 건물 작업 배정, 주변 정찰, 경로·출발, 버스 휴식, 식량·배급
// 배정 화면에서 소요 시간·기력 소모·실수 확률을 미리 보여준다 (07장).
window.LS = window.LS || {};

LS.Panel = (function () {
  const $ = (id) => document.getElementById(id);
  const R = () => LS.Rules;
  const esc = (t) => LS.UI.esc(t);
  let state = null;
  let current = null;        // { kind, arg }
  const sel = {};            // 작업 키 → 고른 인원
  const hours = {};          // 작업 키 → 휴식·수면 시간
  let driverSel = null;

  function init(s) { state = s; bind(); }

  function open(kind, arg) {
    if (state.dialogOpen) return;
    current = { kind, arg };
    render();
  }

  function close() {
    current = null;
    const box = $('panel');
    if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
    $('stage').classList.remove('panel-open');
  }

  function selectedCrew() { return current && current.kind === 'crew' ? current.arg : null; }

  // ---------- 공통 조각 ----------
  function hoursLabel(m) { return R().hoursLabel(m); }

  // 이 일을 지금 못 하는 이유 (있으면 선택지에서 빼고 '제외' 줄에만 보여준다)
  function excludeReason(type, m) {
    if (m.task) return '작업 중';
    const d = LS.Tasks.DEF[type];
    if (d.heavy && !R().canHeavy(state, m)) return m.energy <= LS.CONFIG.energy.heavyMin ? '기력 30 이하' : 'HP 낮음';
    if (d.outside && !d.noWork && !R().canOutside(state, m)) return R().isPoisoned(state, m) ? '식중독' : 'HP 낮음';
    return '';
  }

  // 고를 수는 있지만 알아두면 좋은 것
  function softNote(type, m) {
    if (type === 'talk' && state.minute - m.lastTalk < LS.CONFIG.talk.cooldownHours * 60) return '오늘 이미 대화함';
    if (LS.Tasks.DEF[type].isSleep && m.energy >= 100) return '기력 가득';
    if (type === 'sleep_bed' && R().isPoisoned(state, m)) return '식중독';
    return '';
  }

  function bedsLeft() {
    const used = state.tasks.filter((t) => t.type === 'sleep_bed').reduce((k, t) => k + t.members.length, 0);
    return Math.max(0, LS.State.beds(state) - used);
  }

  function maxFor(type) {
    const d = LS.Tasks.DEF[type];
    if (type === 'sleep_bed') return bedsLeft();
    return d.multi ? state.crew.length : d.crew;
  }

  function defaultSel(type, max) {
    const ok = state.crew.filter((m) => !excludeReason(type, m));
    const tired = (m) => m.energy < LS.CONFIG.energy.seatRest.cap;   // 좌석 휴식(80까지)으로 모자란 사람
    if (type === 'sleep_bed') {
      // 환자용 침상: 식중독·HP 낮은 사람부터, 없으면 가장 지친 사람
      const sick = ok.filter((m) => R().isPoisoned(state, m) || m.hp < 70).sort((a, b) => a.hp - b.hp);
      return (sick.length ? sick : ok.filter(tired).sort((a, b) => a.energy - b.energy)).slice(0, max).map((m) => m.id);
    }
    if (type === 'watch') return ok.slice().sort((a, b) => b.energy - a.energy).slice(0, 2).map((m) => m.id);
    if (LS.Tasks.DEF[type].isSleep) return ok.filter(tired).slice(0, max).map((m) => m.id);
    return ok.slice(0, max).map((m) => m.id);
  }

  function chips(key, type, max) {
    const picked = sel[key] || [];
    const ok = [];
    const out = [];
    state.crew.forEach((m) => {
      const why = excludeReason(type, m);
      if (why) out.push(`${R().name(m.id)} (${why})`); else ok.push(m);
    });
    let html = ok.length ? '<div class="chips">' + ok.map((m) => {
      const note = softNote(type, m);
      const on = picked.includes(m.id);
      return `<button class="chip-btn ${on ? 'on' : ''} ${note ? 'warn' : ''}" data-act="toggle" data-key="${esc(key)}" data-id="${m.id}" data-max="${max}">` +
        `<span class="chip-name"><span class="chk">${on ? '✓' : ''}</span>${esc(R().name(m.id))}</span>` +
        `<small>기력 ${Math.round(m.energy)} · ${R().mentalStage(m.mental)}${note ? ' · ' + note : ''}</small></button>`;
    }).join('') + '</div>' : '<div class="chip-none">지금 고를 수 있는 사람이 없어요.</div>';
    if (out.length) html += `<div class="chip-out">제외: ${esc(out.join(', '))}</div>`;
    return html;
  }

  // 고른 사람 중 그 사이 못 하게 된 사람은 빼고, 비면 다시 기본 선택
  function cleanSel(key, type, max) {
    const list = (sel[key] || []).filter((id) => { const m = R().member(state, id); return m && !excludeReason(type, m); });
    sel[key] = list.length ? list.slice(0, Math.max(1, max)) : defaultSel(type, max);
  }

  // 아침 6시까지 남은 시간. after: 그만큼 뒤에 잠들 때 (잠자리 건물은 가는 길·확인 뒤)
  function morningHours(after) {
    const m = state.minute + (after || 0);
    const day = Math.floor(m / 1440);
    let t = day * 1440 + LS.CONFIG.dayStartHour * 60;
    if (t <= m) t += 1440;
    return Math.max(0.5, Math.round((t - m) / 30) / 2);
  }

  function defHours(type) { return LS.Tasks.DEF[type] && LS.Tasks.DEF[type].isSleep ? 8 : 4; }

  function hoursPicker(key, type, after) {
    const cur = hours[key] || defHours(type);
    const opts = [2, 3, 4, 6, 8];
    const mh = morningHours(after);
    let html = '<div class="hours">시간: ';
    opts.forEach((h) => { html += `<button class="mini ${cur === h ? 'on' : ''}" data-act="hours" data-key="${esc(key)}" data-h="${h}">${h}시간</button>`; });
    // '아침까지'는 밤에만 (낮에 고르면 거의 하루를 자게 된다)
    if (mh <= 12) html += `<button class="mini ${cur === mh && !opts.includes(mh) ? 'on' : ''}" data-act="hours" data-key="${esc(key)}" data-h="${mh}">아침까지 (${mh}시간)</button>`;
    return html + '</div>';
  }

  // opts.help: 설명 바꾸기, opts.after: 잠들기까지 걸리는 분 (아침까지 계산용), opts.sub: 사람 줄 아래 한 줄
  function actionBlock(key, type, title, opts, extra) {
    opts = opts || {};
    const d = LS.Tasks.DEF[type];
    const max = maxFor(type);
    cleanSel(key, type, max);
    const o = Object.assign({}, opts);
    const pickHours = d.timed || type === 'shelter';
    if (pickHours) o.hours = hours[key] || defHours(type);
    const p = LS.Tasks.preview(state, type, sel[key], o);
    // 잠·경계는 위 설명으로 충분하니 숫자 줄을 따로 쓰지 않는다
    const info = [];
    if (!pickHours) {
      if (p.minutes) info.push(`소요 약 ${hoursLabel(p.minutes)}`);
      if (p.drain) info.push(`기력 -${p.drain}/인`);
      if (p.mistake != null) info.push(`실수 확률 ${Math.round(p.mistake * 100)}%`);
    }
    let sub = opts.sub || '';
    if (type === 'shelter' && opts.needCheck) sub = p.checker ? `<div class="act-sub">확인: ${esc(R().name(p.checker.id))} <small>(고른 사람 중 기력이 가장 많은 사람)</small></div>` : '';
    const warn = !p.reason && LS.Tasks.wouldEmptyBus(state, type, sel[key]) ? '<div class="act-warn">모두 밖으로 나가요. 버스가 비고 엔진이 꺼져요.</div>' : '';
    const need = d.multi ? (type === 'sleep_bed' ? `침상 ${max}개` : `${d.crew}명 이상`) : d.crew + '명';
    const help = opts.help || d.help;
    return `<div class="act"><div class="act-head"><b>${esc(title)}</b><span>${need}</span></div>` +
      (help ? `<div class="act-help">${esc(help)}</div>` : '') +
      (extra || '') + chips(key, type, max) + sub +
      (pickHours ? hoursPicker(key, type, opts.after || 0) : '') +
      (info.length ? `<div class="act-info">${info.join(' · ')}</div>` : '') + warn +
      (p.reason ? `<div class="act-reason">${esc(p.reason)}</div>` : '') +
      `<button class="act-go" data-act="start" data-key="${esc(key)}" data-type="${type}"` +
      `${opts.spotId ? ` data-spot="${opts.spotId}"` : ''}${opts.routeKey ? ` data-route="${opts.routeKey}"` : ''} ${p.reason ? 'disabled' : ''}>시작</button></div>`;
  }

  function runningTasks(filter) {
    const list = state.tasks.filter(filter);
    if (!list.length) return '';
    return '<div class="running">' + list.map((t) =>
      `<div class="run-row"><span>${esc(t.members.map((id) => R().name(id)).join('·'))} · ${esc(LS.Tasks.labelFor(state, R().member(state, t.members[0])))}</span>` +
      `<button class="mini" data-act="abort" data-task="${t.id}">${t.type === 'shelter' ? '돌아오기' : '중단'}</button></div>`
    ).join('') + '</div>';
  }

  // ---------- 동료 상세 ----------
  function stat(label, value, max, cls) {
    return `<div class="stat"><div class="stat-row"><span>${label}</span><span class="v">${Math.round(value)} / ${max}</span></div>` +
      `<div class="bar"><div class="${cls}" style="width:${value / max * 100}%"></div></div></div>`;
  }

  function buildCrew(id) {
    const m = R().member(state, id);
    if (!m) return null;
    const c = LS.CHARACTERS[id];
    const stage = R().mentalStage(m.mental);
    const cls = stage === '안정' ? '' : stage === '동요' ? 'shaken' : 'broken';
    const status = R().isPoisoned(state, m) ? `식중독 (${hoursLabel(m.poisonUntil - state.minute)} 남음)` : m.status;
    return `<div class="det-head"><img src="${LS.ASSETS.portraits[id]}" alt=""><div><div class="det-name">${esc(c.name)}</div><div class="det-role">${esc(c.role)}</div></div></div>` +
      stat('HP', m.hp, 100, 'hp') + stat('기력', m.energy, 100, 'energy') +
      `<div class="stat"><div class="stat-row"><span>정신력</span><span class="mental-tag ${cls}">${stage}</span></div></div>` +
      `<div class="stat"><div class="stat-row"><span>식사 결핍</span><span class="v">${m.deficit} / 6</span></div></div>` +
      `<div class="stat"><div class="stat-row"><span>상태</span><span class="v">${esc(status)}</span></div></div>` +
      `<div class="stat"><div class="stat-row"><span>현재 행동</span><span class="v">${esc(LS.Tasks.labelFor(state, m))}</span></div></div>` +
      `<div class="stat"><div class="stat-row"><span>운전</span><span class="v">${R().canDrive(state, m) ? '가능' : (c.canDrive ? '지금은 불가 (' + R().driveBlockReason(state, m) + ')' : '불가')}</span></div></div>` +
      (m.task ? `<button class="mini" data-act="abort" data-task="${m.task}">이 작업 중단</button>` : '') +
      `<ul class="det-traits">${c.traits.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }

  // ---------- 건물 ----------
  function buildSpot(spotId) {
    const loc = LS.State.location(state);
    const place = LS.State.place(state);
    if (!loc || !place) return null;
    const meta = loc.spots.find((s) => s.id === spotId);
    const spot = place.spots[spotId];
    if (!meta || !spot || spot.absent) return null;
    const T = LS.SPOT_TYPES[spot.type];
    let html = `<div class="pn-title">${esc(meta.label)}</div><div class="pn-sub">${esc(T.name)}</div>`;
    html += runningTasks((t) => t.locId === state.locationId && t.spotId === spotId);
    if (T.loot) {
      html += guideCard('work');
      html += `<div class="pn-info">${esc(LS.World.supplyHint(spot))}</div>`;
      if (!spot.farmedOnce && spot.checkedEmpty == null) html += actionBlock('check:' + spotId, 'check_outside', '외부 확인 (10분)', { spotId });
      html += actionBlock('farm:' + spotId, 'farm', `파밍 (${T.hours}시간 기준)`, { spotId });
      return html;
    }
    // 잠자리 건물: 확인하고 자기 하나만 (확인한 뒤에는 바로 가서 자기)
    html += guideCard('rest');
    html += `<div class="pn-info">${esc(LS.World.buildingHint(spot))}</div>`;
    const b = spot.building;
    if (b.checked && b.threat) return html;
    if (state.tasks.some((t) => t.type === 'shelter' && t.spotId === spotId)) return html;
    const E = LS.CONFIG.energy;
    const total = LS.CONFIG.shelter.checkTotalMin;
    if (!b.checked) {
      html += actionBlock('shelter:' + spotId, 'shelter', '확인하고 자기', {
        spotId, needCheck: true, after: total,
        help: `다 같이 걸어가서 한 명이 안을 확인하고(가는 길 포함 ${total}분), 안전하면 바로 자요. 기력 +${E.sleepBuilding.rate}/시간 · 깊은 잠. 일어나면 버스로 돌아와요(${spot.walk}분).`
      });
    } else {
      html += actionBlock('shelter:' + spotId, 'shelter', '건물에서 자기', {
        spotId, after: spot.walk,
        help: `걸어가서(${spot.walk}분) 바로 자요. 기력 +${E.sleepBuilding.rate}/시간 · 깊은 잠. 일어나면 버스로 돌아와요.`
      });
    }
    return html;
  }

  // ---------- 버스 옆 야영 (침낭·경계) ----------
  function buildCamp() {
    const loc = LS.State.location(state);
    if (!loc) return null;
    const s = LS.Tasks.campSafety(state);
    let html = '<div class="pn-title">버스 옆 야영</div><div class="pn-sub">침낭·경계</div>' + guideCard('rest');
    html += `<div class="pn-safety ${s.safe ? 'ok' : 'bad'}">${s.safe ? '안전' : '위험'} · ${esc(s.why)}${s.safe ? '' : ' — 침낭으로 자면 습격받을 수 있어요'}</div>`;
    html += runningTasks((t) => t.type === 'camp' || t.type === 'watch');
    html += actionBlock('camp', 'camp', '침낭 깔고 자기', { after: 0 });
    html += actionBlock('watch', 'watch', '경계 서기', { after: 0 });
    const shelters = LS.World.visibleSpots(state, loc).filter((sp) => sp.type === 'shelter');
    html += shelters.length
      ? `<div class="pn-info dim">잠자리 건물: ${shelters.map((sp) => esc(sp.label)).join(', ')} — 시간이 있으면 건물이 더 잘 쉬어요 (+${LS.CONFIG.energy.sleepBuilding.rate}/시간).</div>`
      : '<div class="pn-info dim">이곳에는 잠자리 건물이 없어요.</div>';
    return html;
  }

  // 처음 여는 패널 위쪽에 한 번만 보여주는 짧은 안내 (알겠어요를 누르면 사라진다)
  function guideCard(id) {
    const g = LS.Guide.card(id);
    return g ? `<div class="pn-guide"><div class="pn-guide-head"><b>${g.title}</b><button class="mini" data-act="guide-ok" data-guide="${id}">알겠어요</button></div>` +
      `<ul>${g.items.map((t) => `<li>${t}</li>`).join('')}</ul></div>` : '';
  }

  // ---------- 주변 정찰 / 장애물 ----------
  function buildArea() {
    const loc = LS.State.location(state);
    const place = LS.State.place(state);
    if (!loc || !place) return null;
    let html = `<div class="pn-title">${esc(loc.name)}</div>`;
    if (loc.roadside && state.roadside.blocked) {
      html += '<div class="pn-info">버려진 차와 잔해가 길을 막고 있다. 치우면 남은 구간을 이어갈 수 있다.</div>';
      html += runningTasks((t) => t.type === 'remove_obstacle');
      html += actionBlock('obstacle', 'remove_obstacle', '장애물 조사·제거');
      return html;
    }
    html += `<div class="pn-info">${place.scouted ? '정찰 완료: 건물별 보급 가능성을 확인했다.' : '아직 정찰하지 않았다. 건물별 보급 정보가 대략적이다.'}</div>`;
    html += guideCard('work');
    html += '<div class="pn-info dim">경보 함정을 설치하면 이곳에서 침낭으로 자도 안전해요. 근처 무리 확인은 3단계에서 연결돼요.</div>';
    html += runningTasks((t) => t.locId === state.locationId && t.type === 'scout_area');
    if (!place.scouted) html += actionBlock('area', 'scout_area', '주변 정찰 (1시간)');
    return html;
  }

  // ---------- 경로·출발 ----------
  function buildRoute(toId) {
    const target = LS.LOCATIONS[toId];
    if (!target) return null;
    let html = `<div class="pn-title">${esc(target.name)}</div><div class="pn-sub">${esc(LS.REGIONS[target.region].name)}</div>`;
    if (toId === state.locationId) {
      return html + '<div class="pn-info">지금 있는 곳이다.</div>';
    }
    if (state.travel) return html + '<div class="pn-info">이동 중이다.</div>';
    const opt = LS.Travel.options(state).find((o) => o.to === toId);
    const place = state.places[toId];
    html += `<div class="pn-info">${place && place.visited ? '가 본 곳' : '아직 가 보지 않은 곳'}${place && place.scouted ? ' · 정찰함' : ''}</div>`;
    const fc = LS.FIRST_COMPANION[toId];
    if (fc && !state.flags['companionSeen_' + toId]) {
      html += state.flags.firstCompanion
        ? `<div class="pn-info dim">단서: ${esc(fc.hint)} · 이미 떠났을 것 같다</div>`
        : `<div class="pn-info"><b>단서: ${esc(fc.hint)}</b> · 누군가 있을지도 모른다. 한 곳에 들르면 다른 쪽 사람은 떠난다.</div>`;
    }
    if (!opt) return html + '<div class="pn-info dim">여기서 바로 이어진 길이 없다.</div>';
    html += guideCard('travel');
    const ds = LS.Travel.drivers(state);
    if (!driverSel || !ds.find((m) => m.id === driverSel)) {
      const expert = ds.find((m) => LS.CHARACTERS[m.id].expert === 'driver');
      driverSel = (expert || ds[0] || {}).id || null;
    }
    const p = LS.Travel.plan(state, toId, driverSel);
    const fuel = state.resources.fuel;
    const rows = [];
    rows.push(`이동 시간: 약 ${hoursLabel(p.minutes)}`);
    rows.push(`연료: ${p.fuelNeed}단위 필요 / 보유 ${fuel.toFixed(1)}단위${fuel < p.fuelNeed ? ' · <b class="warn-text">부족 — 도중에 멈춘다</b>' : ''}`);
    if (state.locationId === 'roadside') rows.push(opt.forward ? '멈췄던 구간을 이어간다' : '온 길로 되돌아간다');
    else rows.push(p.known ? '확인한 길 · 도로 사건 20%' : '미확인 큰길 · 도로 사건 40%');
    if (p.driver && p.driverEnergyAfter != null && p.driverEnergyAfter <= LS.CONFIG.driver.minEnergy) {
      rows.push(`<b class="warn-text">운전자 기력이 도중에 30에 닿는다 (교대나 정차 필요)</b>`);
    }
    html += `<div class="pn-rows">${rows.map((r) => `<div>${r}</div>`).join('')}</div>`;
    const canD = state.crew.filter((m) => R().canDrive(state, m) && !m.task);
    const noD = state.crew.filter((m) => !canD.includes(m)).map((m) => `${R().name(m.id)} (${m.task ? '작업 중' : R().driveBlockReason(state, m)})`);
    html += '<div class="act"><div class="act-head"><b>운전자</b><span>기력 30 초과 · 정신력 안정/동요</span></div>' +
      (canD.length ? '<div class="chips">' + canD.map((m) =>
        `<button class="chip-btn ${driverSel === m.id ? 'on' : ''}" data-act="driver" data-id="${m.id}"><span class="chip-name"><span class="chk">${driverSel === m.id ? '✓' : ''}</span>${esc(R().name(m.id))}</span>` +
        `<small>기력 ${Math.round(m.energy)}${LS.CHARACTERS[m.id].expert === 'driver' ? ' · 전문 기사' : ''}</small></button>`).join('') + '</div>'
        : '<div class="chip-none">지금 운전할 수 있는 사람이 없어요.</div>') +
      (noD.length ? `<div class="chip-out">제외: ${esc(noD.join(', '))}</div>` : '');
    const reason = LS.Travel.departBlockReason(state, toId, driverSel);
    const pass = LS.Travel.passengerRest(state, driverSel, p.minutes);
    if (pass.length) {
      const E = LS.CONFIG.energy;
      html += `<div class="act-info"><b>동승자 휴식</b> · 침상 ${LS.State.beds(state)}개: 기력 +${E.bedMoving.rate}/시간 (${E.bedMoving.cap}까지) · 좌석: +${E.seatRest.rate}/시간 (${E.seatRest.cap}까지)</div><div class="pn-rows">` +
        pass.map((x) => `<div>${esc(R().name(x.m.id))} · ${x.bed ? '침상' : '좌석'} · 기력 ${x.now} → 도착 때 약 ${x.after}${x.capped ? ` (${x.cap} 이상이라 그대로)` : ''}</div>`).join('') + '</div>';
    }
    if (reason) html += `<div class="act-reason">${esc(reason)}</div>`;
    html += `<button class="act-go" data-act="depart" data-to="${toId}" ${reason ? 'disabled' : ''}>출발</button></div>`;
    if (state.locationId !== 'roadside') {
      const info = state.routes[opt.key];
      if (!info.known && !info.traveled) html += actionBlock('route:' + opt.key, 'scout_route', '경로 정찰 (2시간)', { routeKey: opt.key });
    }
    return html;
  }

  // ---------- 버스 안 휴식 ----------
  function buildBus() {
    const E = LS.CONFIG.energy;
    let html = '<div class="pn-title">버스 안에서</div>' + guideCard('rest');
    html += `<div class="pn-info">맡은 일이 없는 동료는 <b>저절로 좌석에서 쉬어요</b> (기력 +${E.seatRest.rate}/시간, ${E.seatRest.cap}까지).</div>`;
    html += runningTasks((t) => t.type === 'sleep_bed' || t.type === 'talk');
    html += actionBlock('bed', 'sleep_bed', '환자용 침상에 눕히기');
    html += actionBlock('talk', 'talk', '회복 대화 (1시간)');
    html += '<div class="pn-info dim">나머지는 정차 외부의 <b>버스 옆 야영</b>(침낭)이나 잠자리 건물에서 잘 수 있어요.</div>';
    return html;
  }

  // ---------- 식량·배급 ----------
  function buildMeal() {
    const r = state.resources;
    const R2 = LS.CONFIG.meal.rations;
    let html = '<div class="pn-title">식량·배급</div>';
    html += `<div class="pn-rows"><div>보존식 ${R().round1(r.food)}인분 (상하지 않음)</div><div>신선식품 ${R().round1(LS.Meals.freshTotal(state))}인분</div><div>합계 ${R().round1(LS.State.foodTotal(state))} / ${r.foodCap}인분</div></div>`;
    if (r.fresh.length) {
      html += '<div class="pn-rows">' + r.fresh.slice().sort((a, b) => a.freshness - b.freshness).map((b) => {
        const pc = LS.Meals.poisonChance(b.freshness);
        return `<div>신선 ${R().round1(b.amount)}인분 · 신선도 ${Math.round(b.freshness)}${pc ? ` · 식중독 ${Math.round(pc * 100)}%` : ''}</div>`;
      }).join('') + '</div>';
      html += '<button class="mini" data-act="discard">신선도 25 미만 버리기</button>';
    }
    html += '<div class="act"><div class="act-head"><b>배급 방식</b><span>08시·20시</span></div><div class="chips">' +
      Object.keys(R2).map((k) => `<button class="chip-btn ${state.mealPolicy === k ? 'on' : ''}" data-act="policy" data-p="${k}">${R2[k].label}<small>1인 ${R2[k].amount}인분${R2[k].mental ? ' · 정신력 ' + R2[k].mental : ''}</small></button>`).join('') +
      '</div>';
    const next = LS.Clock.nextMealAfter(state.minute);
    const pol = state.mealPolicy || 'normal';
    html += `<div class="act-info">다음 식사 ${LS.Clock.fullLabel(next)} · ${R2[pol].label}이면 ${R().round1(LS.Meals.need(state, pol))}인분 필요. 낮은 신선도부터 먹는다.</div></div>`;
    return html;
  }

  const builders = { crew: buildCrew, spot: buildSpot, area: buildArea, route: buildRoute, bus: buildBus, meal: buildMeal, camp: buildCamp };

  function render() {
    const box = $('panel');
    if (!current || state.dialogOpen) { close(); return; }
    const html = builders[current.kind] ? builders[current.kind](current.arg) : null;
    if (html == null) { close(); return; }
    box.innerHTML = '<button class="det-close" data-act="close">✕</button>' + html;
    box.classList.remove('hidden');
    $('stage').classList.add('panel-open');   // 지도는 패널에 가리지 않게 왼쪽으로 줄어든다
  }

  function toggle(key, id, max) {
    const list = sel[key] || (sel[key] = []);
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else { list.push(id); while (list.length > max) list.shift(); }
  }

  function bind() {
    $('panel').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const act = b.dataset.act;
      if (act === 'close') { close(); LS.UI.renderCrew(); return; }
      if (act === 'guide-ok') { state.guides[b.dataset.guide] = true; render(); return; }
      if (act === 'toggle') { toggle(b.dataset.key, b.dataset.id, Number(b.dataset.max)); render(); return; }
      if (act === 'hours') { hours[b.dataset.key] = parseFloat(b.dataset.h); render(); return; }
      if (act === 'driver') { driverSel = b.dataset.id; render(); return; }
      if (act === 'start') {
        const type = b.dataset.type;
        const key = b.dataset.key;
        const opts = { spotId: b.dataset.spot, routeKey: b.dataset.route };
        if (LS.Tasks.DEF[type].timed || type === 'shelter') opts.hours = hours[key] || defHours(type);
        const res = LS.Tasks.start(state, type, sel[key] || [], opts);
        if (res.error) LS.UI.toast(res.error);
        else if (state.guides.time && state.hints.assigned < 2) {
          state.hints.assigned++;
          LS.UI.toast('작업을 배정했어요. [다음 상황까지]를 누르면 가장 먼저 끝나는 작업까지 진행해요.');
        }
        delete sel[key];
        LS.UI.renderAll();
        LS.Guide.check();   // 처음 배정했으면 시간 안내
        return;
      }
      if (act === 'abort') { LS.Time.handle(LS.Tasks.abort(state, b.dataset.task)); LS.UI.renderAll(); return; }
      if (act === 'depart') {
        const res = LS.Travel.depart(state, b.dataset.to, driverSel);
        if (res.error) { LS.UI.toast(res.error); return; }
        close();
        LS.UI.renderAll();
        LS.Guide.check();
        return;
      }
      if (act === 'policy') {
        state.mealPolicy = b.dataset.p;
        LS.State.addLog(state, `배급 방식 변경: ${LS.CONFIG.meal.rations[b.dataset.p].label}`, false, 'meal');
        LS.UI.renderAll();
        return;
      }
      if (act === 'discard') { LS.Meals.discardSpoiled(state, 25); LS.UI.renderAll(); }
    });
  }

  return { init, open, close, render, selectedCrew, isOpen: () => !!current };
})();
