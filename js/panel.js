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
  const clearSleep = {};     // 건물 id → 좀비를 처리한 뒤 그대로 잘지
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
  function excludeReason(type, m, key) {
    if (m.task) return '작업 중';
    const d = LS.Tasks.DEF[type];
    const fights = key && key.indexOf('clear:') === 0;   // 잠자리 건물 안의 좀비 처리는 싸울 수 있어야 한다
    if (m.temp && (!d.isSleep || fights)) return '임시 동행';
    if (LS.CHARACTERS[m.id].child && (!d.isSleep || fights)) return '아이';
    const inf = R().infectionStage(state, m);
    if (inf === '악화' && !d.isSleep) return '감염 악화';
    if (fights && !R().canHeavy(state, m)) return m.energy <= LS.CONFIG.energy.heavyMin ? '기력 30 이하' : '싸울 수 없음';
    if (fights && !R().canOutside(state, m)) return R().isPoisoned(state, m) ? '식중독' : inf ? '감염' : 'HP 낮음';
    if (d.heavy && !R().canHeavy(state, m)) return m.energy <= LS.CONFIG.energy.heavyMin ? '기력 30 이하' : 'HP 낮음';
    if (d.outside && !d.noWork && !R().canOutside(state, m)) return R().isPoisoned(state, m) ? '식중독' : inf === '발열' ? '감염 발열' : 'HP 낮음';
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

  function defaultSel(type, max, key) {
    const ok = state.crew.filter((m) => !excludeReason(type, m, key));
    const tired = (m) => m.energy < LS.CONFIG.energy.seatRest.cap;   // 좌석 휴식(80까지)으로 모자란 사람
    if (type === 'sleep_bed') {
      // 환자용 침상: 식중독·HP 낮은 사람부터, 없으면 가장 지친 사람
      const sick = ok.filter((m) => R().isPoisoned(state, m) || m.hp < 70).sort((a, b) => a.hp - b.hp);
      return (sick.length ? sick : ok.filter(tired).sort((a, b) => a.energy - b.energy)).slice(0, max).map((m) => m.id);
    }
    if (type === 'lodge') return ok.map((m) => m.id);   // 대피소 숙박: 기본은 모두
    if (type === 'watch') return ok.slice().sort((a, b) => b.energy - a.energy).slice(0, 2).map((m) => m.id);
    if (key && key.indexOf('clear:') === 0) return ok.slice().sort((a, b) => b.energy - a.energy).map((m) => m.id);   // 처리는 갈 수 있는 사람 모두

    if (LS.Tasks.DEF[type].isSleep) return ok.filter(tired).slice(0, max).map((m) => m.id);
    return ok.slice(0, max).map((m) => m.id);
  }

  function chips(key, type, max) {
    const picked = sel[key] || [];
    const ok = [];
    const out = [];
    state.crew.forEach((m) => {
      const why = excludeReason(type, m, key);
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
    const list = (sel[key] || []).filter((id) => { const m = R().member(state, id); return m && !excludeReason(type, m, key); });
    sel[key] = list.length ? list.slice(0, Math.max(1, max)) : defaultSel(type, max, key);
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
    const pickHours = d.timed || (type === 'shelter' && (!opts.clear || opts.sleepAfter));
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
    if (type === 'shelter' && opts.needCheck) sub = p.checker ? `<div class="act-sub">확인·바리케이드: ${esc(R().name(p.checker.id))} <small>(고른 사람 중 기력이 가장 많은 사람${(sel[key] || []).length === 1 ? ' · 혼자 가면 안에 좀비가 있을 때 돌아온다' : ''})</small></div>` : '';
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
      `${opts.spotId ? ` data-spot="${opts.spotId}"` : ''}${opts.routeKey ? ` data-route="${opts.routeKey}"` : ''}${opts.clear ? ' data-clear="1"' : ''}${opts.person ? ` data-person="${opts.person}"` : ''}${opts.purpose ? ` data-purpose="${opts.purpose}"` : ''} ${p.reason ? 'disabled' : ''}>시작</button></div>`;
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
    const inf = m.infectionHidden ? null : R().infectionStage(state, m);   // 숨긴 물림은 발열 전까지 안 보인다
    const status = inf ? `감염 · ${inf} (전환까지 ${hoursLabel(Math.max(0, LS.CONFIG.infection.turnH * 60 - (state.minute - m.infectedAt)))})${m.isolated ? ' · 격리 좌석' : ''}`
      : R().isPoisoned(state, m) ? `식중독 (${hoursLabel(m.poisonUntil - state.minute)} 남음)` : m.status;
    return `<div class="det-head"><img src="${LS.ASSETS.portraits[id]}" alt=""><div><div class="det-name">${esc(c.name)}</div><div class="det-role">${esc(c.role)}</div></div></div>` +
      stat('HP', m.hp, 100, 'hp') + stat('기력', m.energy, 100, 'energy') +
      `<div class="stat"><div class="stat-row"><span>정신력</span><span class="mental-tag ${cls}">${stage}</span></div></div>` +
      `<div class="stat"><div class="stat-row"><span>식사 결핍</span><span class="v">${m.deficit} / 6</span></div></div>` +
      `<div class="stat"><div class="stat-row"><span>상태</span><span class="v">${esc(status)}</span></div></div>` +
      `<div class="stat"><div class="stat-row"><span>현재 행동</span><span class="v">${esc(LS.Tasks.labelFor(state, m))}</span></div></div>` +
      `<div class="stat"><div class="stat-row"><span>운전</span><span class="v">${R().canDrive(state, m) ? '가능' : (c.canDrive ? '지금은 불가 (' + R().driveBlockReason(state, m) + ')' : '불가')}</span></div></div>` +
      (c.faction ? `<div class="stat"><div class="stat-row"><span>소속</span><span class="v">${esc(LS.FACTIONS[c.faction].name)}</span></div></div>` : '') +
      (m.task ? `<button class="mini" data-act="abort" data-task="${m.task}">이 작업 중단</button>` : '') +
      `<ul class="det-traits">${c.traits.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` +
      (id !== 'yoon_jaeha' && !state.travel && !state.dialogOpen
        ? `<button class="mini drop-btn" data-act="drop" data-id="${id}">내리게 하기</button><div class="pn-info dim">${esc(LS.Factions.dropText(LS.Factions.dropKind(state, id).kind))}</div>` : '');
  }

  // ---------- 대피소 (04장·19장): 숙박·교환·작은 도움·소식·사람 맡기기 ----------
  function buildRefuge(meta) {
    const F = LS.Factions;
    const id = state.locationId;
    const rf = F.refugeAt(id);
    if (!rf) return null;
    const e = F.entry(state, id);
    const f = LS.FACTIONS[rf.faction];
    let html = `<div class="pn-title">${esc(rf.name)}</div><div class="pn-sub">${esc(f.name)} · 대표 ${esc(f.leader)} · ${esc(meta.label)}</div>`;
    html += `<div class="pn-safety ${e.open ? 'ok' : 'bad'}">평판 ${F.signed(F.rep(state, rf.faction))} · ${e.stance.label}${e.why ? ' — ' + esc(e.why) : ''}</div>`;
    html += `<div class="pn-info">${esc(rf.desc)}</div>`;
    if (!e.open) return html + '<div class="pn-info dim">부탁을 들어주거나 사과(부품 2개 또는 식량 10인분)로 평판을 되돌릴 수 있어요 (다음 업데이트).</div>';
    html += runningTasks((t) => t.locId === id && (t.type === 'lodge' || t.type === 'helpout'));
    // 숙박
    const lc = F.lodgeCost(state, id);
    if (e.lodge) {
      html += actionBlock('lodge', 'lodge', '대피소에서 묵기', { after: 0, help: `${LS.Tasks.DEF.lodge.help} 대가: ${lc.food > 0 ? `식량 ${lc.food}인분` : lc.note}` });
    } else html += `<div class="act"><div class="act-head"><b>대피소에서 묵기</b></div><div class="act-reason">${esc(e.why)}</div></div>`;
    // 교환
    html += '<div class="act"><div class="act-head"><b>교환</b><span>평판 1점당 5% 할인/할증</span></div>' + rf.trades.map((tr) => {
      const cost = F.tradeCost(state, id, tr);
      const ok = F.canPay(state, cost);
      return `<div class="trade-row"><span>${esc(F.costText(cost))} → <b>${esc(F.costText(tr.give))}</b><small>${esc(tr.text)}</small></span>` +
        `<button class="mini" data-act="trade" data-id="${tr.id}" ${ok ? '' : 'disabled'}>${ok ? '바꾸기' : '모자람'}</button></div>`;
    }).join('') + '</div>';
    // 작은 도움 (참조 A: 평판 +1)
    const hb = F.helpBlock(state, id);
    html += `<div class="act"><div class="act-head"><b>작은 도움</b><span>평판 +1 · 하루 한 번</span></div>` +
      `<div class="trade-row"><span>${esc(F.costText(rf.donate))}을 나눈다</span><button class="mini" data-act="donate" ${hb || !F.canPay(state, rf.donate) ? 'disabled' : ''}>나누기</button></div>` +
      (hb ? `<div class="act-reason">${esc(hb)}</div>` : '') + '</div>';
    if (!hb) html += actionBlock('help:' + id, 'helpout', '일손 돕기 (2시간)', { purpose: 'refuge' });
    // 소식
    const nc = F.newsCost(state, id);
    const heard = F.rstate(state, id).newsDay === LS.Clock.rolloverIndex(state.minute);
    html += `<div class="act"><div class="act-head"><b>무전 소식 듣기</b><span>${nc ? `식량 ${nc}인분` : '호의 이상: 무료'}</span></div>` +
      '<div class="act-help">이 지역의 길 상태(도로 사건 40% → 20%)와 다가오는 무리를 알려 줘요. 하루 한 번.</div>' +
      `<button class="act-go" data-act="news" ${heard ? 'disabled' : ''}>${heard ? '오늘은 들었다' : '듣기'}</button></div>`;
    // 사람 맡기기 (안전 인계)
    html += '<div class="act"><div class="act-head"><b>사람 맡기기</b><span>본인이 원하면 안전한 인계</span></div>';
    if (!e.handover) html += `<div class="act-reason">${esc(e.why)}</div>`;
    else {
      const seen = new Set();
      const units = [];
      state.crew.forEach((m) => {
        if (m.id === 'yoon_jaeha' || seen.has(m.id)) return;
        const u = F.unitOf(state, m.id);
        u.forEach((x) => seen.add(x.id));
        units.push(u);
      });
      html += '<div class="act-help">아이·가족·노인·다친 사람(HP 40 미만)은 여기 남기를 원해요. 원하지 않는 사람을 남기면 신뢰를 잃어요.</div>';
      html += units.map((u) => {
        const ok = F.consents(state, id, u);
        return `<div class="trade-row"><span>${esc(u.map((m) => R().name(m.id)).join('·'))}<small>${ok ? '남기를 원한다' : '공항까지 가고 싶어 한다'}</small></span>` +
          `<button class="mini" data-act="drop" data-id="${u[0].id}">${ok ? '맡기기' : '남겨 두기'}</button></div>`;
      }).join('');
    }
    return html + '</div>';
  }

  // ---------- 통행료 바리케이드 (23장 ⑥) ----------
  function buildBarricade(meta) {
    const F = LS.Factions;
    const b = F.barAt(state);
    if (!b) return null;
    let html = `<div class="pn-title">${esc(meta.label)}</div><div class="pn-sub">통행료 바리케이드</div>`;
    const clues = b.clues.length
      ? '<div class="act-sub">정찰로 알게 된 단서</div><ul class="person-list clues">' + b.clues.map((c) => `<li>${esc(c)}</li>`).join('') + '</ul>'
      : '';
    if (b.resolved) {
      const t = { paid: '통행료를 내고 지나갈 수 있다', help: '일손을 빌려주고 지나갈 수 있다', talk: '협상해서 지나갈 수 있다', break: '밀고 지나갔다', detour: `우회한다 · 이곳을 지나는 다음 구간은 +${hoursLabel(LS.FACTION_RULES.detourMin)}` }[b.resolved];
      return html + `<div class="pn-info">${esc(t)}</div>` + clues;
    }
    const from = b.from ? LS.LOCATIONS[b.from].name : null;
    html += `<div class="pn-info">요구: <b>${esc(F.costText(F.tollOf(state, b)))}</b>${b.discount < 1 ? ' (협상으로 절반)' : ''}${from ? ` · 온 길(${esc(from)})로 돌아가는 건 막지 않는다` : ''}</div>`;
    html += clues || '<div class="pn-info dim">누가 세운 바리케이드인지 아직 몰라요. [주변 정찰](2인 1시간)로 단서 1~2개, 김나래가 있으면 하나 더 찾아요.</div>';
    html += runningTasks((t) => t.locId === state.locationId && (t.type === 'helpout' || t.type === 'parley'));
    if (b.offer === 'help') html += actionBlock('barhelp', 'helpout', '일손을 빌려 주기 (2시간)', { purpose: 'barricade', help: '다친 사람을 돌보고 발전기를 손봐 줘요. 끝나면 지나갈 수 있어요.' });
    if (b.offer === 'parley') html += actionBlock('parley', 'parley', '말로 깎아 보기 (30분)', { purpose: 'parley' });
    const ch = F.barricadeChoices(state);
    html += '<div class="siege-acts">' + ch.map((c, i) => (c.run && !c.resolve ? '' :
      `<button class="act-go" data-act="barchoice" data-i="${i}" ${c.disabled ? 'disabled' : ''}>${esc(c.label)}<small>${esc(c.desc || '')}</small></button>`)).join('') + '</div>';
    return html;
  }

  // ---------- 부탁 목록 (20장): 기한·할 일·보상·연락 ----------
  function buildRequests() {
    const Q = LS.Requests;
    const RR = LS.REQUEST_RULES;
    const list = state.requests.list;
    const act = list.filter((r) => r.status === 'active');
    const nN = act.filter((r) => r.kind === 'normal').length;
    const nU = act.filter((r) => r.kind === 'urgent').length;
    let html = `<div class="pn-title">부탁 목록</div><div class="pn-sub">일반 ${nN}/${RR.maxNormal} · 급한 용무 ${nU}/${RR.maxUrgent}</div>`;
    const contact = Q.canContact(state);
    html += `<div class="pn-info dim">${contact ? '여기 대피소 무전으로 연락할 수 있어요: 기한 연장(1번, 기한이 1/3 넘게 남았을 때) · 포기 알림.' : '기한 연장·포기 알림은 대피소 무전으로 할 수 있어요 (버스의 통신 공간은 6단계).'}</div>`;
    if (!act.length) html += '<div class="pn-info">맡은 부탁이 없어요. 동료나 대피소 사람이 부탁을 꺼내면 여기에 쌓여요.</div>';
    const pname = (r) => LS.ENCOUNTERS[r.enc].who.map((x) => R().name(x)).join('·');
    act.forEach((r) => {
      const t = Q.tpl(r.tid) || {};
      const title = r.kind === 'promise' ? `리더 약속: ${pname(r)}` : t.title;
      const from = r.kind === 'promise' ? '' : r.from ? R().name(r.from) : (r.faction ? LS.FACTIONS[r.faction].name : '');
      const lf = Q.left(state, r);
      const here = (r.target || []).includes(state.locationId);
      html += `<div class="act req ${r.kind}"><div class="act-head"><b>${esc(title)}</b><span>${r.kind === 'urgent' ? '급한 용무' : r.kind === 'promise' ? '약속' : '부탁'}${from ? ' · ' + esc(from) : ''}</span></div>` +
        `<div class="pn-rows"><div>할 일: ${esc(Q.whereText(r))}${here ? ' · <b>바로 여기</b>' : ''}</div>` +
        `<div>기한: ${lf == null ? '없음' : lf > 0 ? `${hoursLabel(lf)} 남음 (${LS.Clock.fullLabel(r.deadline)})` : '지남'}${r.extended ? ' · 연장함' : ''}</div>` +
        (r.kind === 'promise' ? '<div>기한 안: 리더 신뢰 +2 · 평판 +3 / 기한 뒤 2일이 지나면 약속 위반</div>' : `<div>보상: ${esc(Q.rewardText(r))}</div>`) + '</div>';
      if (t.work && here) html += actionBlock('req:' + r.id, 'errand', `${t.work.label} (${hoursLabel(t.work.minutes)})`, { purpose: r.id });
      if (t.pay && here) {
        const pb = Q.payBlock(state, r.id);
        html += `<button class="act-go" data-act="reqpay" data-id="${esc(r.id)}" ${pb ? 'disabled' : ''}>${esc(LS.Factions.costText(t.pay))} 내고 끝내기</button>` + (pb ? `<div class="act-reason">${esc(pb)}</div>` : '');
      }
      if (contact && r.kind !== 'promise') {
        const eb = Q.extendBlock(state, r.id);
        html += '<div class="hours">' + (r.kind === 'normal' && r.deadline != null ? `<button class="mini" data-act="reqext" data-id="${esc(r.id)}" ${eb ? 'disabled' : ''} title="${esc(eb)}">기한 연장 연락${eb ? ` (${esc(eb)})` : ''}</button>` : '') +
          `<button class="mini" data-act="reqgive" data-id="${esc(r.id)}">포기한다고 알리기 (평판 -1)</button></div>`;
      }
      html += runningTasks((x) => x.type === 'errand' && x.purpose === r.id) + '</div>';
    });
    const past = list.filter((r) => r.status !== 'active').slice(-5).reverse();
    if (past.length) {
      const ST = { done: '완료', failed: '실패', gaveup: '포기', broken: '약속 위반' };
      html += '<div class="act-sub">끝난 부탁</div><ul class="person-list">' + past.map((r) =>
        `<li>${esc(r.kind === 'promise' ? `약속: ${pname(r)}` : Q.tpl(r.tid).title)} · ${ST[r.status] || r.status}</li>`).join('') + '</ul>';
    }
    return html;
  }

  // ---------- 연줄·기록 (18~19장): 리더 신뢰·집단 평판·최근 원인·엔딩 기록 ----------
  function buildTies() {
    const F = LS.Factions;
    let html = '<div class="pn-title">연줄 · 기록</div><div class="pn-sub">리더 신뢰와 외부 집단 평판</div>';
    html += `<div class="act"><div class="act-head"><b>리더 신뢰 ${state.trust} / 100</b><span>일행 공통</span></div><div class="act-help">${esc(F.trustStage(state.trust).text)}</div></div>`;
    Object.keys(LS.FACTIONS).forEach((k) => {
      const f = LS.FACTIONS[k];
      const v = F.rep(state, k);
      const st = F.stanceOf(state, k);
      const why = (state.repWhy[k] || []).slice(0, 3);
      html += `<div class="act tie ${st.key}"><div class="act-head"><b>${esc(f.name)}</b><span>${F.signed(v)} · ${st.label}</span></div>` +
        `<div class="tie-bar"><div style="left:${(v + 10) * 5}%"></div></div>` +
        `<div class="act-help">대표 ${esc(f.leader)} · ${esc(f.role)} · ${esc(st.effect)}</div>` +
        (why.length ? '<ul class="person-list">' + why.map((w) => `<li>${F.signed(w.delta)} · ${esc(w.why)} <small>(${LS.Clock.fullLabel(w.minute)})</small></li>`).join('') + '</ul>' : '') + '</div>';
    });
    const rec = state.record;
    html += '<div class="act"><div class="act-head"><b>여정 기록</b><span>엔딩 판정에 쓰여요</span></div><div class="pn-rows">' +
      `<div>도운 사람 ${rec.helped.length}명 (안전하게 데려다줌·맡김)</div>` +
      `<div>내려놓은 선택 ${rec.letGo.length}번 (강제 하차·원치 않는 잔류)</div>` +
      (rec.rumors.length ? `<div>퍼질 소문 ${rec.rumors.filter((r) => !r.spread).length}건 (14일째 안부 방송에서 모든 집단 평판 -1)</div>` : '') +
      '</div></div>';
    return html;
  }

  // ---------- 건물 ----------
  function buildSpot(spotId) {
    const loc = LS.State.location(state);
    const place = LS.State.place(state);
    if (!loc || !place) return null;
    const meta = loc.spots.find((s) => s.id === spotId);
    const spot = place.spots[spotId];
    if (!meta || !spot || spot.absent) return null;
    if (spot.type === 'refuge') return buildRefuge(meta);
    if (spot.type === 'barricade') return buildBarricade(meta);
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
    // 잠자리 건물: 처음엔 확인·바리케이드 설치 후 자기, 바리케이드를 친 뒤에는 누구든 나중에 따로 가서 자기
    html += guideCard('rest');
    html += `<div class="pn-info">${esc(LS.World.buildingHint(spot))}</div>`;
    const b = spot.building;
    if (b.abandoned) return html + '<div class="pn-info dim">포기한 건물이에요.</div>';
    const securing = state.tasks.some((t) => t.type === 'shelter' && t.spotId === spotId && (t.phase === 'check' || t.phase === 'hold' || t.phase === 'clear' || (t.clear && t.phase === 'walk')));
    if (securing) return html + '<div class="pn-info dim">먼저 간 사람이 안을 정리하고 바리케이드를 다 치면, 남은 사람도 나중에 따로 와서 잘 수 있어요.</div>';
    const E = LS.CONFIG.energy;
    const total = LS.CONFIG.shelter.checkTotalMin;
    if (b.checked && b.threat) {
      // 안에 좀비가 있다: 사람을 보내 처리한다. 인원이 많을수록 안전하다
      const key = 'clear:' + spotId;
      const n = Math.max(1, (sel[key] || []).length);
      const sleepAfter = !!clearSleep[spotId];
      html += actionBlock(key, 'shelter', '안의 좀비 처리하러 가기', {
        spotId, clear: true, sleepAfter, after: spot.walk + LS.CONFIG.zombie.fight.minutes,
        help: `걸어가서(${spot.walk}분) 안의 좀비를 처리하고, 정리하며 바리케이드를 쳐요 (${LS.CONFIG.zombie.fight.minutes}분). 많이 갈수록 안전해요: 1명은 위험이 높고, 2명은 어느 정도, 3명부터는 웬만해선 안 다쳐요.`,
        sub: `<div class="act-sub">위험: ${esc(LS.Zombie.clearRiskText(n))}</div>` +
          '<div class="hours">처리한 뒤: ' +
          `<button class="mini ${sleepAfter ? '' : 'on'}" data-act="clearsleep" data-spot="${spotId}" data-v="0">버스로 돌아온다</button>` +
          `<button class="mini ${sleepAfter ? 'on' : ''}" data-act="clearsleep" data-spot="${spotId}" data-v="1">그대로 잔다</button></div>`
      });
      return html;
    }
    if (!b.checked) {
      html += actionBlock('shelter:' + spotId, 'shelter', '확인하고 자기', {
        spotId, needCheck: true, after: total,
        help: `잘 사람들이 걸어가서, 한 명이 안을 확인하고 입구·창문에 바리케이드를 쳐요 (가는 길 포함 ${total}분). 끝나면 바로 자요. 기력 +${E.sleepBuilding.rate}/시간 · 깊은 잠. 일어나면 버스로 돌아와요(${spot.walk}분).`
      });
    } else {
      const there = state.tasks.filter((t) => t.type === 'shelter' && t.spotId === spotId);
      html += actionBlock('shelter:' + spotId, 'shelter', there.length ? '나중에 따로 가서 자기' : '건물에서 자기', {
        spotId, after: spot.walk,
        help: `바리케이드를 쳐 둔 곳이라 확인 없이 걸어가서(${spot.walk}분) 바로 자요. 기력 +${E.sleepBuilding.rate}/시간 · 깊은 잠. 일어나면 버스로 돌아와요.${there.length ? ' 먼저 간 사람들과 따로 일어나 따로 돌아와요.' : ''}`
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
    // 한정수 합류 조건: 하루 운전 8시간
    if (p.driver && LS.CHARACTERS[p.driver.id].condition === 'drive8') {
      const done = LS.People.drivenToday(state, p.driver);
      const limit = LS.PEOPLE_RULES.driveLimitMin;
      rows.push(done + p.minutes > limit
        ? `<b class="warn-text">${esc(R().name(p.driver.id))} 합류 조건: 하루 운전 8시간 — 오늘 ${hoursLabel(done)} 운전, 이번에 넘긴다</b>`
        : `${esc(R().name(p.driver.id))} 합류 조건: 하루 운전 8시간 (오늘 ${hoursLabel(done)} 운전)`);
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

  // ---------- 버스 정비 ----------
  function buildRepair() {
    const b = state.bus;
    const RP = LS.CONFIG.repair;
    let html = '<div class="pn-title">버스 정비</div><div class="pn-sub">기본 수리</div>';
    html += `<div class="pn-rows"><div>내구도 ${b.durability} / ${b.maxDurability}${b.durability <= 0 ? ' · <b class="warn-text">멈춤: 정비해야 움직일 수 있다</b>' : ''}</div><div>부품 ${state.resources.parts}개 (수리 1번에 ${RP.parts}개)</div></div>`;
    html += '<div class="pn-info dim">포위되면 내구도가 시간마다 깎여요. 0이 되면 무리가 안으로 들어오고 버스가 멈춰요.</div>';
    html += runningTasks((t) => t.type === 'repair');
    html += actionBlock('repair', 'repair', `기본 수리 (내구도 +${RP.amount})`);
    return html;
  }

  // ---------- 포위 대응 ----------
  function buildSiege() {
    const s = state.zombie.siege;
    if (!s) return null;
    const S = LS.Zombie.sizeOf(s.size);
    let html = `<div class="pn-title">포위</div><div class="pn-sub">${esc(S.label)} ${s.count}마리</div>`;
    html += `<div class="pn-safety bad">남은 ${hoursLabel(Math.max(0, s.endsAt - state.minute))} · 내구도 -${S.dmg}/시간 (지금 ${state.bus.durability})</div>`;
    html += '<div class="pn-info">버스 안 사람은 내구도가 0이 되기 전에는 물리지 않아요. 포위 중에는 밖에 나갈 수 없어요.</div>';
    html += '<div class="siege-acts">' + LS.Zombie.siegeChoices(state).map((c, i) =>
      `<button class="act-go" data-act="siege" data-i="${i}" ${c.disabled ? 'disabled' : ''}>${esc(c.label)}<small>${esc(c.desc || '')}</small></button>`).join('') + '</div>';
    return html;
  }

  // ---------- 만난 사람 (17장): 관찰·상의·면담·검사 결과를 보고 태울지 정한다 ----------
  function buildPerson(id) {
    const e = LS.ENCOUNTERS[id];
    const r = state.people[id];
    if (!e || !r || r.status !== 'met' || r.at !== state.locationId) return null;
    const free = LS.People.seatsFree(state);
    const need = e.who.length;
    let html = `<div class="pn-title">${esc(e.who.map((c) => R().name(c)).join('·'))}</div><div class="pn-sub">${esc(LS.People.kindText(e))}</div>`;
    html += '<div class="person-faces">' + e.who.map((c) => `<img src="${LS.ASSETS.portraits[c]}" alt="">`).join('') + '</div>';
    html += guideCard('people');
    html += `<div class="pn-rows"><div>목적: ${esc(e.purpose)}</div><div>합류 조건: ${esc(e.condition)}</div><div>좌석 ${state.crew.length}/${state.bus.seats}${free < need ? ' · <b class="warn-text">만석</b>' : ` · ${need}자리 필요`}</div></div>`;
    html += '<div class="act-sub">보이는 것</div><ul class="person-list">' + e.observed.map((t) => `<li>${esc(t)}</li>`).join('') + '</ul>';
    html += '<div class="act-sub">면담·검사로 알게 된 것</div>' + (r.clues.length
      ? '<ul class="person-list clues">' + r.clues.map((t) => `<li>${esc(t)}</li>`).join('') + '</ul>'
      : '<div class="pn-info dim">아직 없어요. 판단은 직접 해야 해요.</div>');
    const food = LS.State.foodTotal(state);
    const S = LS.PEOPLE_RULES.supportFood;
    // 결정 버튼은 정보 바로 아래에 (면담·검사 블록 아래로 내려가 스크롤하지 않게)
    html += '<div class="person-decide">' +
      `<button class="act-go" data-act="person" data-do="accept" data-id="${id}" ${free < need ? 'disabled' : ''}>태운다<small>${e.kind === 'join' ? '동료로 공항까지' : esc(e.destText) + '까지'}</small></button>` +
      (e.altTemp ? `<button data-act="person" data-do="acceptAlt" data-id="${id}" ${free < need ? 'disabled' : ''}>${esc(e.altTemp.destText)}까지만<small>도착하면 맡김 · 평판 +${e.altTemp.rep}</small></button>` : '') +
      `<button data-act="person" data-do="support" data-id="${id}" ${food < S ? 'disabled' : ''}>물자만<small>식량 ${S}인분</small></button>` +
      `<button data-act="person" data-do="refuse" data-id="${id}">거절<small>평판 변화 없음</small></button></div>`;
    // 22장 ③ 만석: 기존 동료를 내리게 해서 자리를 만든다 (하차 방식에 따라 신뢰·평판이 바뀐다)
    if (free < need) {
      const cands = state.crew.filter((m) => m.id !== 'yoon_jaeha');
      html += `<div class="act"><div class="act-head"><b>자리 만들기</b><span>${need - free}자리 더 필요</span></div>` +
        `<div class="act-help">${esc(LS.Factions.dropText(LS.Factions.refugeAt(state.locationId) ? 'stay' : 'force'))}</div>` +
        cands.map((m) => `<div class="trade-row"><span>${esc(R().name(m.id))}<small>${esc(LS.CHARACTERS[m.id].role)}</small></span><button class="mini" data-act="drop" data-id="${m.id}" data-back="${id}">내리게 하기</button></div>`).join('') +
        `<div class="pn-info dim">좌석 복구(6→8석) 설비는 6단계에서 열려요.</div></div>`;
    }
    html += runningTasks((t) => t.person === id);
    if (!r.interviewed) html += actionBlock('iv:' + id, 'interview', '면담 (1시간)', { person: id });
    if (!r.inspected) html += actionBlock('in:' + id, 'inspect', '검사 (1시간)', { person: id });
    html += '<div class="pn-info dim">정하지 않고 떠나면 두고 가요.</div>';
    return html;
  }

  const builders = { crew: buildCrew, spot: buildSpot, area: buildArea, route: buildRoute, bus: buildBus, meal: buildMeal, camp: buildCamp, repair: buildRepair, siege: buildSiege, person: buildPerson, ties: buildTies, requests: buildRequests };

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
      if (act === 'siege') {
        const c = LS.Zombie.siegeChoices(state)[Number(b.dataset.i)];
        if (!c || c.disabled) return;
        if (c.run) c.run(state);
        if (state.screen !== 'outside') close();
        LS.UI.renderAll();
        return;
      }
      if (act === 'toggle') { toggle(b.dataset.key, b.dataset.id, Number(b.dataset.max)); render(); return; }
      if (act === 'hours') { hours[b.dataset.key] = parseFloat(b.dataset.h); render(); return; }
      if (act === 'clearsleep') { clearSleep[b.dataset.spot] = b.dataset.v === '1'; render(); return; }
      if (act === 'person') {
        LS.People.decide(state, b.dataset.id, b.dataset.do);
        if (b.dataset.do !== 'accept' || state.people[b.dataset.id].status !== 'met') close();
        LS.UI.renderAll();
        return;
      }
      if (act === 'driver') { driverSel = b.dataset.id; render(); return; }
      // 5단계 2차: 하차·대피소·바리케이드
      if (act === 'drop') {
        const back = b.dataset.back ? { kind: 'person', arg: b.dataset.back } : (current && current.kind === 'spot' ? { kind: 'spot', arg: current.arg } : null);
        LS.Time.handle([{ dialog: LS.Factions.dropEvent(state, b.dataset.id, back) }]);
        return;
      }
      if (act === 'trade' || act === 'donate' || act === 'news') {
        const id = state.locationId;
        const res = act === 'trade' ? LS.Factions.trade(state, id, b.dataset.id) : act === 'donate' ? LS.Factions.donate(state, id) : LS.Factions.news(state, id);
        LS.UI.toast(res.error || res.text);
        LS.UI.renderAll();
        return;
      }
      if (act === 'reqpay' || act === 'reqext' || act === 'reqgive') {
        const Q = LS.Requests;
        const res = act === 'reqpay' ? Q.pay(state, b.dataset.id) : act === 'reqext' ? Q.extend(state, b.dataset.id) : Q.giveUp(state, b.dataset.id);
        LS.UI.toast(res.error || res.text);
        LS.UI.renderAll();
        return;
      }
      if (act === 'barchoice') {
        const c = LS.Factions.barricadeChoices(state)[Number(b.dataset.i)];
        if (!c || c.disabled) return;
        // 고른 결과를 바로 적용하고, 결과 대사를 대화창으로 보여 준다
        const r = (c.resolve ? c.resolve(state) : c.result) || {};
        if (c.run) c.run(state);
        LS.Time.handle([{ dialog: { title: '통행료 바리케이드', screen: 'outside', logDetail: `선택: ${c.label}`,
          lines: r.lines && r.lines.length ? r.lines : [{ speaker: 'narration', text: c.label }], choices: [{ label: '알았다' }] } }]);
        return;
      }
      if (act === 'start') {
        const type = b.dataset.type;
        const key = b.dataset.key;
        const opts = { spotId: b.dataset.spot, routeKey: b.dataset.route };
        if (LS.Tasks.DEF[type].timed || type === 'shelter') opts.hours = hours[key] || defHours(type);
        if (b.dataset.clear) { opts.clear = true; opts.sleepAfter = !!clearSleep[b.dataset.spot]; }
        if (b.dataset.person) opts.person = b.dataset.person;
        if (b.dataset.purpose) opts.purpose = b.dataset.purpose;
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
        (res.toasts || []).forEach((t) => LS.UI.toast(t, { sticky: true }));
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
