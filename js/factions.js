// 외부 집단 평판·리더 신뢰·대피소·인계·하차·통행료 바리케이드 (04장, 18~19장, 23장 ⑥, 참조 A). 5단계 2차.
// 수치 계산 결과는 로그와 대사로 이유를 함께 보여 준다 (19장).
window.LS = window.LS || {};

LS.Factions = (function () {
  const R = () => LS.Rules;
  const FR = () => LS.FACTION_RULES;
  const josa = (w, p) => LS.Rules.josa(w, p);
  const nm = (id) => LS.Rules.name(id);
  const RES_NAMES = { food: ['식량', '인분'], parts: ['부품', '개'], meds: ['약', '회분'], fuel: ['연료', '단위'] };

  // ---------- 상태 준비 (State.create가 부른다) ----------
  function setup(state) {
    state.repWhy = {};
    Object.keys(LS.FACTIONS).forEach((k) => { state.repWhy[k] = []; });
    // 엔딩 판정용 기록 (24장): 도운 사람·내려놓은 선택·소문·배신
    state.record = { helped: [], letGo: [], rumors: [], betrayals: [] };
    state.refuges = {};
    state.barricades = {};
    Object.keys(LS.BARRICADES).forEach((id) => {
      state.barricades[id] = { owner: R().pick(LS.BARRICADES[id].owners), resolved: null, clues: [], from: null, met: false, discount: 1, talkTried: false, offer: null };
    });
  }

  // ---------- 평판 ----------
  function rep(state, key) { return state.reputation[key] || 0; }
  function stance(v) { return LS.STANCES.find((s) => v >= s.min) || LS.STANCES[LS.STANCES.length - 1]; }
  function stanceOf(state, key) { return stance(rep(state, key)); }
  function signed(d) { return (d > 0 ? '+' : '') + d; }

  // 평판을 바꾸고 로그에 이유를 남긴다. 돌려주는 글은 결과 대사·알림에 붙인다
  function changeRep(state, key, delta, why) {
    if (!key || !delta || !LS.FACTIONS[key]) return '';
    const before = rep(state, key);
    const after = R().clamp(before + delta, -10, 10);
    if (after === before) return '';
    state.reputation[key] = after;
    const list = state.repWhy[key] || (state.repWhy[key] = []);
    list.unshift({ minute: state.minute, delta: after - before, why });
    if (list.length > 5) list.pop();
    const s0 = stance(before);
    const s1 = stance(after);
    const text = `${LS.FACTIONS[key].name} 평판 ${signed(after - before)}${s0 !== s1 ? ` (${s1.label})` : ''}`;
    LS.State.addLog(state, text, s0 !== s1 || Math.abs(delta) >= 3, 'event', why);
    return text;
  }

  function trustStage(v) { return LS.TRUST_STAGES.find((s) => v >= s.min) || LS.TRUST_STAGES[LS.TRUST_STAGES.length - 1]; }

  function changeTrust(state, delta, why) {
    if (!delta) return '';
    const before = state.trust;
    state.trust = R().clamp(before + delta, 0, 100);
    if (state.trust === before) return '';
    const text = `리더 신뢰 ${signed(state.trust - before)}`;
    LS.State.addLog(state, `${text} (${state.trust})`, Math.abs(delta) >= 4, 'event', why);
    return text;
  }

  // 교환 대가: 평판 1점당 5% 할인/할증 (19장, 관리 시설에만)
  function price(state, key, amount) {
    if (!key) return amount;
    return Math.max(1, Math.ceil(amount * (1 - 0.05 * rep(state, key)) - 1e-9));
  }

  // ---------- 기록 (24장 엔딩 축) ----------
  function addRecord(state, kind, id, how) { state.record[kind].push({ id, how, where: state.locationId, minute: state.minute }); }
  function helpedCount(state) { return state.record.helped.length; }

  // ---------- 물자 계산 ----------
  function costText(cost) { return Object.keys(cost).map((k) => `${RES_NAMES[k][0]} ${cost[k]}${RES_NAMES[k][1]}`).join(' · '); }
  function have(state, k) { return k === 'food' ? LS.State.foodTotal(state) : state.resources[k] || 0; }
  function canPay(state, cost) { return Object.keys(cost).every((k) => have(state, k) + 1e-9 >= cost[k]); }
  function pay(state, cost) {
    Object.keys(cost).forEach((k) => {
      if (k === 'food') LS.Meals.take(state, cost[k]);
      else state.resources[k] = R().round1(state.resources[k] - cost[k]);
    });
  }
  function receive(state, give, fresh) {
    const got = [];
    Object.keys(give).forEach((k) => {
      let stored = give[k];
      if (k === 'food') stored = LS.Meals.addFood(state, give[k], fresh || 0);
      else if (k === 'fuel') { stored = Math.min(give[k], state.resources.fuelCap - state.resources.fuel); state.resources.fuel = R().round1(state.resources.fuel + stored); }
      else state.resources[k] += give[k];
      got.push(`${RES_NAMES[k][0]} +${R().round1(stored)}${RES_NAMES[k][1]}${stored < give[k] ? ' (보관 한도)' : ''}`);
    });
    return got.join(' · ');
  }

  // ---------- 대피소 ----------
  function refugeAt(id) { return LS.REFUGES[id] || null; }
  function rstate(state, id) { return state.refuges[id] || (state.refuges[id] = { met: false, paidUntil: 0, helpDay: -1, newsDay: -1, freeLodge: 0 }); }
  function today(state) { return LS.Clock.rolloverIndex(state.minute); }

  // 평판에 따른 출입 (19장): 적대 출입·교환 거절, 경계 만석 거절
  function entry(state, id) {
    const rf = refugeAt(id);
    const st = stanceOf(state, rf.faction);
    if (st.key === 'hostile') return { open: false, lodge: false, trade: false, handover: false, stance: st, why: '적대: 문을 열어 주지 않는다' };
    if (st.key === 'wary') return { open: true, lodge: false, trade: true, handover: false, stance: st, why: '경계: 자리가 없다며 숙박·인계를 거절한다' };
    return { open: true, lodge: true, trade: true, handover: true, stance: st, why: '' };
  }

  function lodgeCost(state, id) {
    const rf = refugeAt(id);
    const r = rstate(state, id);
    if (state.minute < r.paidUntil) return { food: 0, note: '이미 대가를 냈다' };
    if (r.freeLodge > 0 || (state.flags['freeLodge_' + rf.faction] || 0) > 0) return { food: 0, note: '무료 숙박 1회' };
    return { food: price(state, rf.faction, rf.lodgeFood), note: '' };
  }

  // 숙박을 시작할 때 (Tasks.start가 부른다): 대가를 내고, 그동안 버스도 담장 안에 세운다
  function startLodge(state, hours) {
    const id = state.locationId;
    const c = lodgeCost(state, id);
    const r = rstate(state, id);
    if (c.food > 0) pay(state, { food: c.food });
    else if (c.note === '무료 숙박 1회') { if (r.freeLodge > 0) r.freeLodge--; else state.flags['freeLodge_' + refugeAt(id).faction]--; }
    r.paidUntil = Math.max(r.paidUntil, state.minute + hours * 60);
    return c.food > 0 ? `식량 -${c.food}인분` : c.note;
  }

  function lodgeBlock(state) {
    const id = state.locationId;
    if (!refugeAt(id)) return '대피소가 아니다';
    const e = entry(state, id);
    if (!e.lodge) return e.why;
    const c = lodgeCost(state, id);
    if (c.food > 0 && LS.State.foodTotal(state) + 1e-9 < c.food) return `숙박 대가 식량 ${c.food}인분이 모자라다`;
    return '';
  }

  // 대피소에 묵는 동안에는 이 정차에 무리가 오지 않는다 [해석: 담장 안에 버스를 세운다]
  function safeStop(state) {
    if (state.travel || !refugeAt(state.locationId)) return false;
    return state.tasks.some((t) => t.type === 'lodge' && t.locId === state.locationId);
  }

  function trade(state, refugeId, tradeId) {
    const rf = refugeAt(refugeId);
    const tr = rf && rf.trades.find((t) => t.id === tradeId);
    if (!tr) return { error: '없는 교환이다' };
    const e = entry(state, refugeId);
    if (!e.trade) return { error: e.why };
    const cost = tradeCost(state, refugeId, tr);
    if (!canPay(state, cost)) return { error: `${costText(cost)}이 필요하다` };
    pay(state, cost);
    const got = receive(state, tr.give, tr.fresh);
    LS.State.addLog(state, `${rf.name}: 교환`, false, 'event', `${costText(cost)} → ${got}`);
    return { text: `${costText(cost)} → ${got}` };
  }

  function tradeCost(state, refugeId, tr) {
    const rf = refugeAt(refugeId);
    const cost = {};
    Object.keys(tr.want).forEach((k) => { cost[k] = price(state, rf.faction, tr.want[k]); });
    return cost;
  }

  // 작은 도움: 기부나 일손 돕기로 평판 +1 (참조 A). 대피소마다 하루 한 번 [임시]
  function helpBlock(state, id) { return rstate(state, id).helpDay === today(state) ? '오늘은 이미 도왔다' : ''; }

  function donate(state, id) {
    const rf = refugeAt(id);
    const b = helpBlock(state, id);
    if (b) return { error: b };
    if (!canPay(state, rf.donate)) return { error: `${costText(rf.donate)}이 필요하다` };
    pay(state, rf.donate);
    rstate(state, id).helpDay = today(state);
    const t = changeRep(state, rf.faction, 1, `${rf.name}에 ${costText(rf.donate)}을 나눴다`);
    return { text: `${costText(rf.donate)}을 나눴다 · ${t}` };
  }

  // 소식 듣기: 호의 이상 무료, 보통은 식량 조금 (19장). 이 지역의 길 상태와 다가오는 무리를 알려 준다
  function newsCost(state, id) { return stanceOf(state, refugeAt(id).faction).min >= 2 ? 0 : FR().newsFood; }
  function news(state, id) {
    const rf = refugeAt(id);
    const r = rstate(state, id);
    if (r.newsDay === today(state)) return { error: '오늘 소식은 이미 들었다' };
    const cost = newsCost(state, id);
    if (cost && LS.State.foodTotal(state) < cost) return { error: `식량 ${cost}인분이 필요하다` };
    if (cost) pay(state, { food: cost });
    r.newsDay = today(state);
    // 이곳과 이웃 장소에 닿는 길 (두 구간 안) [임시]
    const near = new Set([id].concat(LS.World.routesFrom(id, state).map((r) => r.to)));
    let n = 0;
    LS.ROUTES.forEach((rt) => {
      if (!LS.World.routeVisible(state, rt) || !(near.has(rt.a) || near.has(rt.b))) return;
      const info = state.routes[LS.World.routeKey(rt.a, rt.b)];
      if (!info.known && !info.traveled) { info.known = true; n++; }
    });
    const h = state.zombie.horde;
    let zline = '근처에 다가오는 무리 소식은 없다';
    if (h && h.coming) { h.known = true; zline = `이쪽으로 오는 무리가 있다 (약 ${R().hoursLabel(Math.max(0, h.arriveAt - state.minute))})`; }
    const text = `근처 길 ${n}곳 확인 (도로 사건 20%) · ${zline}`;
    LS.State.addLog(state, `${rf.name}: 무전 소식`, false, 'event', `${cost ? `식량 -${cost}인분 · ` : ''}${text}`);
    return { text };
  }

  // ---------- 인계·하차 (18장) ----------
  // 가족은 함께 움직인다 (합류 조건: 가족을 분리하지 않음)
  function unitOf(state, id) {
    const fam = LS.CHARACTERS[id].family;
    return fam ? state.crew.filter((m) => LS.CHARACTERS[m.id].family === fam) : state.crew.filter((m) => m.id === id);
  }

  function kindsOf(state, m) {
    const c = LS.CHARACTERS[m.id];
    const k = [];
    if (c.child) k.push('child');
    if (c.family) k.push('family');
    if (c.elder) k.push('elder');
    if (m.hp < FR().sickHp) k.push('sick');
    return k;
  }

  // 본인이 대피소에 남기를 원하는가
  function consents(state, refugeId, unit) {
    const rf = refugeAt(refugeId);
    return !!rf && unit.some((m) => kindsOf(state, m).some((k) => rf.handover.includes(k)));
  }

  // 하차 방식과 대가 (참조 A): 안전 자발 인계 / 안전 비자발 잔류 / 위험한 강제 하차
  function dropKind(state, id) {
    const unit = unitOf(state, id);
    const here = state.locationId;
    const rf = refugeAt(here);
    const m = R().member(state, id);
    if (m && m.temp && m.temp.thief && m.temp.caught) return { kind: 'thief', unit };
    if (rf && entry(state, here).handover) return { kind: consents(state, here, unit) ? 'handover' : 'stay', unit };
    return { kind: 'force', unit };
  }

  function dropText(kind) {
    return {
      handover: '안전한 인계: 본인도 원한다 · 리더 신뢰 변화 없음 · 소속 평판 +1 · 도운 사람으로 기록',
      stay: '대피소에 남겨 둠 (본인은 원하지 않는다): 리더 신뢰 -8 · 소속 평판 -2 · 일행 일부 정신력 -3 · 내려놓은 선택으로 기록',
      force: '위험한 강제 하차: 리더 신뢰 -20 · 소속 평판 -5 · 14일째 소문(모든 집단 -1) · 가까운 사람 정신력 -8 · 배신 기록',
      thief: '붙잡힌 도둑을 내리게 한다: 대가 없음'
    }[kind];
  }

  function factionsOf(unit) { return Array.from(new Set(unit.map((m) => LS.CHARACTERS[m.id].faction).filter(Boolean))); }

  // 실제로 내리게 한다. 돌려주는 글은 결과 대사에 쓴다
  function dropOff(state, id) {
    const d = dropKind(state, id);
    const unit = d.unit;
    const who = unit.map((m) => nm(m.id)).join('·');
    const loc = LS.State.location(state);
    const where = loc ? loc.name : '도로 위';
    const notes = [];
    const ids = unit.map((m) => m.id);
    if (d.kind === 'handover') {
      factionsOf(unit).forEach((f) => notes.push(changeRep(state, f, 1, `${josa(who, '을를')} ${where}에 안전하게 맡겼다`)));
      ids.forEach((x) => addRecord(state, 'helped', x, 'handover'));
    } else if (d.kind === 'stay') {
      notes.push(changeTrust(state, -8, `${josa(who, '을를')} 원치 않는데 ${where}에 남겨 두었다`));
      factionsOf(unit).forEach((f) => notes.push(changeRep(state, f, -2, `${josa(who, '을를')} 원치 않는데 남겨 두었다`)));
      state.crew.filter((m) => !ids.includes(m.id)).slice(0, 2).forEach((m) => R().addMental(m, -3));
      ids.forEach((x) => addRecord(state, 'letGo', x, 'stay'));
    } else if (d.kind === 'force') {
      notes.push(changeTrust(state, -20, `${josa(who, '을를')} ${where}에 강제로 내리게 했다`));
      factionsOf(unit).forEach((f) => notes.push(changeRep(state, f, -5, `${josa(who, '을를')} 위험한 곳에 내리게 했다`)));
      // 가까운 사람: 같은 집단 소속이거나 박서윤 (주인공 곁의 동료) [해석]
      const fs = factionsOf(unit);
      state.crew.filter((m) => !ids.includes(m.id) && m.id !== 'yoon_jaeha' && (fs.includes(LS.CHARACTERS[m.id].faction) || m.id === 'park_seoyun')).forEach((m) => R().addMental(m, -8));
      ids.forEach((x) => { addRecord(state, 'letGo', x, 'force'); addRecord(state, 'betrayals', x, 'force'); state.record.rumors.push({ id: x, how: 'force', minute: state.minute, spread: false }); });
    }
    ids.forEach((x) => {
      const m = R().member(state, x);
      if (m && m.temp) { const r = LS.People.rec(state, m.temp.enc); r.status = d.kind === 'force' ? 'dropped' : 'arrived'; }
      LS.State.killMember(state, x, 'left');
    });
    const title = { handover: `${who}: ${where}에 맡김`, stay: `${who}: ${where}에 남겨 둠`, force: `${who}: 강제 하차`, thief: `${josa(who, '을를')} 내리게 했다` }[d.kind];
    LS.State.addLog(state, title, d.kind !== 'thief', 'event', d.kind === 'handover' ? '본인도 원했다 · 도운 사람으로 기록' : notes.filter(Boolean).join(' · ') || dropText(d.kind));
    return { kind: d.kind, who, notes: notes.filter(Boolean) };
  }

  // 동료 패널의 [내리게 하기] → 확인 대화
  // reopen: 끝나고 다시 열 패널 { kind, arg } (만석일 때 사람 패널로 돌아가기)
  function dropEvent(state, id, reopen) {
    const back = () => { if (reopen) setTimeout(() => LS.Panel.open(reopen.kind, reopen.arg), 0); };
    const d = dropKind(state, id);
    const who = d.unit.map((m) => nm(m.id)).join('·');
    const rf = refugeAt(state.locationId);
    const lines = d.kind === 'handover'
      ? [{ speaker: id, text: rf && rf.handover.includes('child') && d.unit.some((m) => LS.CHARACTERS[m.id].child) ? '여기라면 아이가 덜 무서워할 거예요. 남을게요.' : '여기 남는 게 낫겠어요. 신세 많이 졌어요.' }]
      : d.kind === 'thief' ? [{ speaker: 'narration', text: '붙잡힌 두 사람을 내리게 할 수 있다.' }]
        : [{ speaker: id, text: d.kind === 'stay' ? '…여기 두고 가겠다는 거예요? 저는 공항까지 가고 싶었어요.' : '여기서요? 밖은 위험해요. 정말 내리라는 거예요?' }];
    return {
      title: `${who} 내리게 하기`, screen: state.screen,
      lines,
      observations: [dropText(d.kind)].concat(d.unit.length > 1 ? ['가족은 함께 내린다 (합류 조건: 가족을 떼어 놓지 않는다)'] : [])
        .concat(d.kind === 'force' && LS.REFUGES ? ['대피소(초등학교·자급 마을)에서라면 안전하게 맡길 수 있다'] : []),
      choices: [
        {
          label: d.kind === 'handover' ? '대피소에 맡긴다' : d.kind === 'stay' ? '그래도 남겨 둔다' : '내리게 한다',
          run: back,
          resolve: (s) => {
            const r = dropOff(s, id);
            return { lines: [{ speaker: 'narration', text: `${josa(r.who, '이가')} 버스에서 내렸다.${r.notes.length ? ' (' + r.notes.join(', ') + ')' : ''}` }] };
          }
        },
        { label: '그만둔다', run: back, result: { lines: [{ speaker: 'narration', text: '없던 일로 했다.' }] } }
      ]
    };
  }

  // ---------- 통행료 바리케이드 (23장 ⑥) ----------
  function barAt(state, id) { return state.barricades[id || state.locationId] || null; }
  function ownerOf(b) { return LS.BARRICADE_OWNERS[b.owner]; }

  function tollOf(state, b) {
    const o = ownerOf(b);
    const cost = {};
    Object.keys(o.toll).forEach((k) => { cost[k] = Math.max(1, Math.ceil((o.faction ? price(state, o.faction, o.toll[k]) : o.toll[k]) * b.discount - 1e-9)); });
    return cost;
  }

  // 집단 바리케이드는 적대면 통행 불가 (19장): 통행료·협상이 막힌다
  function hostileOwner(state, b) { const o = ownerOf(b); return !!(o.faction && stanceOf(state, o.faction).key === 'hostile'); }

  // 출발 막기: 바리케이드를 풀지 않았으면 온 길로만 돌아갈 수 있다
  function blockReason(state, toId) {
    const b = barAt(state);
    if (!b || b.resolved || toId === b.from) return '';
    return '바리케이드가 길을 막고 있다. 통행료·협상·돌파·우회 중 하나를 골라야 지나갈 수 있다 (온 길로 돌아가는 건 된다)';
  }

  // 우회를 골랐으면 바리케이드를 지나는 구간에 시간이 더 든다
  function extraMinutes(state, toId) {
    const b = barAt(state);
    return b && b.resolved === 'detour' && toId !== b.from ? FR().detourMin : 0;
  }

  function resolve(state, b, how, text) {
    b.resolved = how;
    LS.State.addLog(state, `${LS.BARRICADES[state.locationId].name}: ${text}`, true, 'event', ownerOf(b).label && b.clues.length ? `정체: ${ownerOf(b).label}` : '');
  }

  function barricadeChoices(state) {
    const b = barAt(state);
    if (!b || b.resolved) return [];
    const o = ownerOf(b);
    const toll = tollOf(state, b);
    const hostile = hostileOwner(state, b);
    const list = [];
    list.push({
      label: `통행료를 낸다 (${costText(toll)})`,
      desc: hostile ? '적대 집단이라 받지 않는다' : !canPay(state, toll) ? '물자가 모자라다' : b.discount < 1 ? '협상으로 절반' : '',
      disabled: hostile || !canPay(state, toll),
      resolve: (s) => {
        const bb = barAt(s);
        const t = tollOf(s, bb);
        pay(s, t);
        resolve(s, bb, 'paid', `통행료를 냈다 (${costText(t)})`);
        return { lines: [{ speaker: 'narration', text: '바리케이드가 한쪽으로 밀렸다. 지나가도 좋다는 손짓.' }] };
      }
    });
    // 협상 (23장 ⑥): 하나의 선택지로 두고, 상대에 따라 답이 다르다 (누구인지 미리 드러내지 않게)
    // 지킴이: 치료·정비 일손 2시간 · 상인: 호의 이상이면 절반 · 강도: 30분 말로 깎기, 실패 가능
    if (!b.offer && !b.talkTried && b.discount === 1) {
      list.push({
        label: '협상한다',
        desc: hostile ? '적대 집단이라 상대해 주지 않는다' : '상대에 따라 조건이 다르다',
        disabled: hostile,
        resolve: (s) => negotiate(s)
      });
    } else if (b.offer === 'help' || b.offer === 'parley') {
      list.push({
        label: b.offer === 'help' ? '일손을 보낸다 (2시간)' : '말로 깎아 볼 사람을 보낸다 (30분)',
        desc: '바리케이드 패널에서 1명을 고른다',
        run: () => setTimeout(() => LS.Panel.open('spot', 'rx_bar'), 0),
        result: { lines: [{ speaker: 'narration', text: '누구를 보낼지 정해야 한다.' }] }
      });
    }
    const dmg = FR().breakDurability;
    const canBreak = state.bus.durability > dmg && LS.Travel.drivers(state).length > 0;
    list.push({
      label: '밀고 지나간다 (돌파)',
      desc: !canBreak ? (state.bus.durability <= dmg ? '버스가 버티지 못한다' : '운전할 사람이 없다') : `내구도 -${dmg} · 소음에 근처 무리가 다가온다 · 거점·상인이 세운 것이면 그 집단 평판 ${FR().breakRep} · 강도라면 누군가 다칠 수 있다`,
      disabled: !canBreak,
      resolve: (s) => breakThrough(s)
    });
    list.push({
      label: `골목으로 돌아간다 (우회, 다음 구간 +${R().hoursLabel(FR().detourMin)})`,
      resolve: (s) => {
        resolve(s, barAt(s), 'detour', '우회하기로 했다');
        return { lines: [{ speaker: 'narration', text: '바리케이드를 피해 골목길로 돌아가기로 했다. 시간과 연료가 더 든다.' }] };
      }
    });
    return list;
  }

  function breakThrough(state) {
    const b = barAt(state);
    const o = ownerOf(b);
    const notes = [];
    state.bus.durability = Math.max(0, state.bus.durability - FR().breakDurability);
    notes.push(`내구도 -${FR().breakDurability}`);
    if (o.faction) notes.push(changeRep(state, o.faction, FR().breakRep, '통행료 바리케이드를 밀고 지나갔다'));
    else {
      // 강도: 탑승자 부상 1회
      const pool = state.crew.filter((m) => !LS.CHARACTERS[m.id].child);
      const v = R().pick(pool.length ? pool : state.crew);
      if (v) { R().hurt(state, v, LS.CONFIG.zombie.injuryHp, LS.CONFIG.shock.minorInjury); notes.push(`${josa(nm(v.id), '이가')} 날아든 쇠파이프에 다쳤다 (HP ${LS.CONFIG.zombie.injuryHp})`); }
    }
    const z = LS.Zombie.forceHorde(state, FR().breakHordeMin, '바리케이드를 부수는 소리');
    if (z) notes.push(z);
    resolve(state, b, 'break', '바리케이드를 밀고 지나갔다');
    return { lines: [{ speaker: 'narration', text: '버스가 철조망과 차를 밀어붙인다. 금속이 찢어지는 소리가 교차로에 울린다.' }].concat(notes.filter(Boolean).map((t) => ({ speaker: 'narration', text: t }))) };
  }

  function negotiate(state) {
    const b = barAt(state);
    if (b.owner === 'keeper') {
      b.offer = 'help';
      return { lines: [
        { speaker: 'barricade', text: '먹을 거 대신 손이 필요하오. 다친 사람이 있고 발전기도 멈췄소. 두어 시간 도와주면 지나가게 해 주지.' },
        { speaker: 'narration', text: '1명이 2시간 일손을 빌려주면 지나갈 수 있다. 바리케이드를 눌러 사람을 보낸다.' }
      ] };
    }
    if (b.owner === 'merchant') {
      b.talkTried = true;
      if (stanceOf(state, 'merchant').min >= 2) {
        b.discount = 0.5;
        return { lines: [{ speaker: 'barricade', text: '우리 무리랑 잘 지내는 분들이군요. 반만 받죠.' }, { speaker: 'narration', text: '칠판의 숫자를 고쳐 적는다. 통행료가 절반이 됐다.' }] };
      }
      return { lines: [{ speaker: 'barricade', text: '규칙은 규칙입니다. 우리 무리와 거래를 트시면 그때 깎아 드리죠.' }, { speaker: 'narration', text: '상인 무리 평판이 호의(+2) 이상이면 깎아 준다고 한다.' }] };
    }
    b.offer = 'parley';
    return { lines: [
      { speaker: 'barricade', text: '흥정은 없다고 했지. …뭐, 할 말 있으면 한 사람만 와 봐.' },
      { speaker: 'narration', text: '누군가 30분 동안 말로 깎아 볼 수 있다. 실패할 수도 있다.' }
    ] };
  }

  // 정찰(2인 1시간)로 단서 1~2개, 배달 경험자는 1개 더 (23장)
  function onScouted(state, ms) {
    const b = barAt(state);
    if (!b || b.resolved) return '';
    const o = ownerOf(b);
    const left = o.clues.filter((c) => !b.clues.includes(c));
    let n = R().randInt(1, 2) + (ms.some((m) => LS.CHARACTERS[m.id].expert === 'local') ? 1 : 0);
    const got = [];
    while (n-- > 0 && left.length) got.push(left.splice(R().randInt(0, left.length - 1), 1)[0]);
    got.forEach((c) => b.clues.push(c));
    return got.length ? `바리케이드 단서: ${got.join(' / ')}` : '';
  }

  // 일손 돕기(지킴이 협상·대피소 작은 도움)와 강도 협상이 끝났을 때 (Tasks.complete가 부른다)
  function onHelpDone(state, task, ms) {
    const loc = task.locId;
    if (task.purpose === 'barricade') {
      const b = barAt(state, loc);
      if (b && !b.resolved) {
        resolve(state, b, 'help', `${josa(ms.map((m) => nm(m.id)).join('·'), '이가')} 일손을 빌려줬다`);
        const t = changeRep(state, 'residents', 1, '바리케이드 지킴이들의 다친 사람과 발전기를 손봐 줬다');
        return `바리케이드를 지나가도 된다 · ${t}`;
      }
      return '';
    }
    if (task.purpose === 'parley') {
      const b = barAt(state, loc);
      if (!b || b.resolved) return '';
      b.talkTried = true;
      b.offer = null;
      if (R().chance(FR().robberTalkChance)) { b.discount = 0.5; return '말이 통했다. 통행료를 절반으로 깎았다'; }
      return '말이 안 통한다. 요구는 그대로다';
    }
    if (task.purpose === 'refuge') {
      const rf = refugeAt(loc);
      rstate(state, loc).helpDay = today(state);
      return changeRep(state, rf.faction, 1, `${rf.name}에서 일손을 도왔다`) || '고맙다는 인사를 들었다';
    }
    return '';
  }

  // ---------- 도착 ----------
  function onArrive(state, out) {
    const id = state.locationId;
    const rf = refugeAt(id);
    if (rf) {
      const r = rstate(state, id);
      if (!r.met) { r.met = true; out.push({ dialog: welcomeEvent(state, id) }); }
    }
    const b = barAt(state);
    if (b) {
      b.from = state.arrivedFrom || null;
      if (!b.resolved && !b.met) { b.met = true; out.push({ dialog: barricadeEvent(state) }); }
      else if (!b.resolved) out.push({ toast: '바리케이드가 아직 길을 막고 있다.' });
    }
  }

  function welcomeEvent(state, id) {
    const rf = refugeAt(id);
    const e = entry(state, id);
    const f = LS.FACTIONS[rf.faction];
    const lines = [{ speaker: 'narration', text: rf.desc }];
    if (!e.open) lines.push({ speaker: rf.host, text: '당신들 버스 이야기는 무전으로 들었어요. 들어올 수 없어요.' });
    else lines.push(...rf.welcome);
    if (e.open && !e.lodge) lines.push({ speaker: rf.host, text: '미안하지만 지금은 자리가 없어요. 물건 바꾸는 것만 돼요.' });
    return {
      title: rf.name, screen: 'outside', lines,
      observations: [
        `${f.name} (${f.leader}) · 평판 ${signed(rep(state, rf.faction))} · ${e.stance.label}`,
        e.open ? `할 수 있는 것: ${['교환', e.lodge ? '숙박' : null, e.handover ? '사람 맡기기' : null, '소식 듣기', '일손 돕기'].filter(Boolean).join(' · ')}` : e.why,
        '정차 외부의 대피소 건물을 눌러 이용한다'
      ],
      choices: [{ label: '알았다' }]
    };
  }

  function barricadeEvent(state) {
    const b = barAt(state);
    const o = ownerOf(b);
    return {
      title: '통행료 바리케이드', screen: 'outside',
      lines: [
        { speaker: 'narration', text: '교차로 한가운데 차와 철조망으로 바리케이드가 쳐져 있다. 사람 셋이 버스를 막아선다.' },
        { speaker: 'barricade', text: o.say }
      ],
      observations: [
        `요구: ${costText(tollOf(state, b))}`,
        '누구인지는 아직 모른다 · 주변 정찰(2인 1시간)로 단서를 찾을 수 있다 (김나래가 있으면 하나 더)',
        '바리케이드를 넘지 않고 온 길로 돌아가는 건 막지 않는다'
      ],
      choices: barricadeChoices(state).concat([{ label: '일단 지켜본다', desc: '정차 외부의 바리케이드를 눌러 나중에 정한다', result: { lines: [{ speaker: 'narration', text: '버스를 조금 물려 세웠다. 저쪽도 이쪽을 지켜본다.' }] } }])
    };
  }

  return {
    setup, rep, stance, stanceOf, changeRep, changeTrust, trustStage, price, signed,
    helpedCount, addRecord, costText, canPay,
    refugeAt, rstate, entry, lodgeCost, startLodge, lodgeBlock, safeStop, trade, tradeCost, helpBlock, donate, newsCost, news,
    unitOf, dropKind, dropText, dropOff, dropEvent, consents,
    barAt, ownerOf, tollOf, blockReason, extraMinutes, barricadeChoices, onScouted, onHelpDone, onArrive, hostileOwner
  };
})();
