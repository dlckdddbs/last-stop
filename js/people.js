// 사람 (16~18장, 22장): 생존자 만남·상의·면담·검사·합류·임시 동행·합류 조건, 초반 고정 사건 '어디까지만 태워주세요'
// 결과는 사실과 단서로만 보여 주고, 최종 판단은 플레이어가 한다 (17장).
window.LS = window.LS || {};

LS.People = (function () {
  const R = () => LS.Rules;
  const P = () => LS.PEOPLE_RULES;
  const josa = (w, p) => LS.Rules.josa(w, p);
  const nm = (id) => LS.Rules.name(id);

  function enc(id) { return LS.ENCOUNTERS[id]; }
  function rec(state, id) {
    return state.people[id] || (state.people[id] = { status: 'unmet', clues: [], interviewed: false, inspected: false, at: null });
  }
  function whoNames(e) { return e.who.map(nm).join('·'); }
  function seatsFree(state) { return state.bus.seats - state.crew.length; }
  function voice(state, pref) {
    if (pref && R().member(state, pref)) return pref;
    const o = state.crew.find((m) => m.id !== 'yoon_jaeha' && !m.temp);
    return o ? o.id : 'yoon_jaeha';
  }

  // 지금 이 장소에서, 아직 태울지 정하지 않은 사람들
  function present(state) {
    return Object.keys(LS.ENCOUNTERS).filter((id) => {
      const r = state.people[id];
      return r && r.status === 'met' && r.at === state.locationId && !state.travel;
    });
  }

  function kindText(e) {
    if (e.kind === 'join') return '동료로 공항까지';
    return `임시 동행 · ${e.destText}까지`;
  }

  // ---------- 만남 ----------
  function meet(state, id, out) {
    const r = rec(state, id);
    r.status = 'met';
    r.at = state.locationId;
    r.metAt = state.minute;
    LS.State.addLog(state, `${josa(whoNames(enc(id)), '을를')} 만났다`, false, 'event', enc(id).purpose);
    out.push({ dialog: introEvent(state, id) });
  }

  function introEvent(state, id) {
    const e = enc(id);
    const free = seatsFree(state);
    const need = e.who.length;
    const op = e.opinion ? { speaker: voice(state, e.opinion.speaker), text: e.opinion.text } : null;
    return {
      title: e.title, screen: 'outside',
      lines: e.intro,
      observations: [
        `목적: ${e.purpose}`,
        `합류 조건: ${e.condition}`,
        `좌석 ${state.crew.length}/${state.bus.seats}${free < need ? ' · 만석이라 태울 수 없다' : ` · ${need}자리 필요`}`
      ].concat(e.observed),
      opinions: op ? [op] : [],
      choices: decisionChoices(state, id, true)
    };
  }

  // 태운다 / 먼저 이야기해 본다 / 물자만 / 거절
  function decisionChoices(state, id, withTalk) {
    const e = enc(id);
    const free = seatsFree(state);
    const need = e.who.length;
    const food = LS.State.foodTotal(state);
    const list = [{
      label: e.kind === 'join' ? '태운다 (동료로 함께 간다)' : `태운다 (${e.destText}까지)`,
      desc: free < need ? `좌석이 모자라다 (${need}자리 필요)` : `좌석 ${need}개 · 식량을 함께 쓴다`,
      disabled: free < need,
      run: (s) => accept(s, id),
      result: { lines: [{ speaker: e.who[0], text: e.acceptLine }] }
    }];
    // 22장 ③ 만석의 가족: 학교 같은 안전한 곳까지만 이송
    if (e.altTemp) {
      list.push({
        label: `${e.altTemp.destText}까지만 태운다`,
        desc: free < need ? `좌석이 모자라다 (${need}자리 필요)` : `임시 동행 · 도착하면 맡기고 ${LS.FACTIONS[e.altTemp.faction].name} 평판 +${e.altTemp.rep}`,
        disabled: free < need,
        run: (s) => accept(s, id, true),
        result: { lines: [{ speaker: e.who[0], text: e.altTemp.acceptLine }] }
      });
    }
    // 만석이면: 기존 동료를 내리게 해서 자리를 만들 수 있다 (하차 방식에 따라 관계가 바뀐다)
    if (free < need && withTalk) {
      list.push({
        label: '자리를 만든다 (동료를 내리게 한다)',
        desc: '사람 패널에서 누구를 내리게 할지 고른다 · 하차 방식에 따라 신뢰·평판이 바뀐다',
        run: () => setTimeout(() => LS.Panel.open('person', id), 0),
        result: { lines: [{ speaker: 'narration', text: '버스 안을 둘러본다. 누군가는 내려야 한다.' }] }
      });
      if (need > 1) list.push({ label: '좌석을 복구한다', desc: '좌석 복구 설비(부품 3·4시간)는 6단계에서 열려요', disabled: true });
    }
    // 리더 약속 (20장): 자리가 없을 때 데리러 오겠다고 약속한다. 기본 5일
    if (free < need && e.kind === 'join') {
      const D = LS.REQUEST_RULES.promiseDays;
      list.push({
        label: `데리러 오겠다고 약속한다 (${D}일 안)`,
        desc: `기한 안에 돌아오면 신뢰 +2·평판 +3 · ${D + LS.REQUEST_RULES.promiseLateDays}일이 지나면 약속 위반 (신뢰 -4·평판 -3)`,
        run: (s) => LS.Requests.promise(s, id),
        result: { lines: [{ speaker: e.who[0], text: '…기다릴게요. 꼭 와야 해요.' }] }
      });
    }
    if (withTalk) {
      list.push({
        label: '먼저 이야기해 본다',
        desc: '면담(1시간)·검사(1시간)를 맡길 수 있다. 그동안 기다려 준다',
        run: () => setTimeout(() => LS.Panel.open('person', id), 0),
        result: { lines: [{ speaker: 'narration', text: '잠깐 기다려 달라고 했다.' }] }
      });
    }
    list.push({
      label: '물자만 나눠 주고 보낸다',
      desc: food < P().supportFood ? '나눠 줄 식량이 없다' : `식량 ${P().supportFood}인분`,
      disabled: food < P().supportFood,
      run: (s) => support(s, id),
      result: { lines: [{ speaker: 'narration', text: '식량 꾸러미를 건넸다. 고개를 숙이고 돌아선다.' }] }
    });
    list.push({
      label: '거절한다',
      run: (s) => refuse(s, id),
      result: { lines: [{ speaker: 'narration', text: '고개를 저었다. 버스 문이 닫힌다.' }] }
    });
    return list;
  }

  // alt: 만석의 가족처럼 정해진 안전한 곳까지만 태운다 (e.altTemp)
  function accept(state, id, alt) {
    const e = enc(id);
    const r = rec(state, id);
    const temp = alt ? e.altTemp : (e.kind !== 'join' ? { dest: e.dest, destText: e.destText } : null);
    e.who.forEach((cid) => {
      if (!LS.State.addMember(state, cid, temp ? `임시 동행 · ${temp.destText}까지` : LS.CHARACTERS[cid].role)) return;
      const m = R().member(state, cid);
      if (temp) m.temp = { enc: id, dest: temp.dest, from: state.locationId, thief: e.kind === 'thief', rep: alt ? { faction: e.altTemp.faction, amount: e.altTemp.rep } : null };
    });
    r.status = temp ? 'riding' : 'joined';
    if (e.request && !alt) LS.Requests.accept(state, e.request, {});   // 이송 부탁 (권순자)
  }

  function support(state, id) {
    const r = rec(state, id);
    LS.Meals.take(state, P().supportFood);
    r.status = 'supported';
    LS.State.addLog(state, `${whoNames(enc(id))}에게 물자를 나눠 줬다`, false, 'event', `식량 -${P().supportFood}인분`);
  }

  function refuse(state, id) {
    rec(state, id).status = 'refused';
    LS.State.addLog(state, `${josa(whoNames(enc(id)), '을를')} 태우지 않았다`, false, 'event', '');
  }

  // 사람 패널의 결정 버튼
  function decide(state, id, what) {
    const r = rec(state, id);
    if (r.status !== 'met') return;
    if (what === 'accept' || what === 'acceptAlt') {
      if (seatsFree(state) < enc(id).who.length) { LS.UI.toast('좌석이 모자라요.'); return; }
      const alt = what === 'acceptAlt' && !!enc(id).altTemp;
      accept(state, id, alt);
      LS.UI.toast(`${whoNames(enc(id))}: "${alt ? enc(id).altTemp.acceptLine : enc(id).acceptLine}"`);
    }
    if (what === 'support') support(state, id);
    if (what === 'refuse') refuse(state, id);
  }

  // ---------- 면담·검사 (17장) ----------
  function talkBlock(state, id) {
    const zk = LS.Zombie.nextKnown(state);
    if (zk && zk.at - state.minute <= LS.CONFIG.zombie.alarmMin) return '무리가 2시간 안에 온다. 긴 확인보다 대응이 먼저다';
    return '';
  }

  // 작업이 끝나면 부른다: 결과(사실·단서)를 기록하고 요약을 돌려준다
  function reveal(state, id, kind, ms) {
    const e = enc(id);
    const r = rec(state, id);
    let lines;
    if (kind === 'interview') {
      r.interviewed = true;
      lines = e.interview.slice();
    } else {
      r.inspected = true;
      lines = e.inspect.results.slice();
      if (e.inspect.wound) lines.push(ms.some((m) => m.id === 'yoon_jaeha') ? e.inspect.wound.hero : e.inspect.wound.other);
      if (e.inspect.grumble) lines.push(e.inspect.grumble);
    }
    lines.forEach((t) => { if (!r.clues.includes(t)) r.clues.push(t); });
    return lines.join(' · ');
  }

  // ---------- 도착·정차 ----------
  // 도착하거나 도로 위에 멈출 때: 임시 동행 목적지, 하차 요구, 이 장소에서 만나는 사람
  function onStop(state, out) {
    const loc = state.locationId;
    const real = loc && loc !== 'roadside';
    // 임시 동행: 목적지(또는 '다음 마을')에 닿으면 내린다
    const groups = {};
    state.crew.filter((m) => m.temp).forEach((m) => { (groups[m.temp.enc] = groups[m.temp.enc] || []).push(m); });
    Object.keys(groups).forEach((eid) => {
      const ms = groups[eid];
      const t = ms[0].temp;
      const arrived = real && (t.dest === loc || (t.dest === 'next' && loc !== t.from));
      if (arrived) out.push({ dialog: farewellEvent(state, eid, ms) });
    });
    // 합류 조건을 두 번 어긴 동료는 다음 장소에서 내린다
    if (real) {
      state.crew.filter((m) => m.leaveAtNext).forEach((m) => out.push({ dialog: leaveEvent(state, m) }));
    }
    // 이 장소에서 만나는 사람
    Object.keys(LS.ENCOUNTERS).forEach((id) => {
      const e = enc(id);
      if (e.where !== loc || rec(state, id).status !== 'unmet') return;
      meet(state, id, out);
    });
  }

  // 떠날 때: 정하지 않은 사람은 두고 간다 (거절과 같다. 평판 변화 없음)
  function onDepart(state) {
    present(state).forEach((id) => {
      rec(state, id).status = 'passed';
      LS.State.addLog(state, `${josa(whoNames(enc(id)), '을를')} 두고 떠났다`, false, 'event', '태울지 정하지 않았다');
    });
  }

  function farewellEvent(state, eid, ms) {
    const e = enc(eid);
    const thieves = ms.some((m) => m.temp.thief);
    const alt = ms[0].temp.rep && e.altTemp;
    const lines = thieves
      ? [{ speaker: ms[0].id, text: '여기서 내리겠소. 신세 졌소.' }, { speaker: 'narration', text: '두 사람은 식량 상자를 한 번 돌아보고 내렸다.' }]
      : (alt ? e.altTemp.farewell : e.farewell) || [{ speaker: ms[0].id, text: '여기서 내릴게요. 고마웠어요.' }];
    const rp = ms[0].temp.rep;
    return {
      title: `${whoNames(e)}: 목적지`, screen: 'outside', lines,
      observations: thieves ? [] : ['목적지까지 안전하게 데려다줬다 (도운 사람으로 기록)'].concat(rp ? [`${LS.FACTIONS[rp.faction].name} 평판 +${rp.amount}`] : []),
      choices: [{
        label: '작별한다',
        run: (s) => {
          const ids = ms.map((m) => m.id);
          ms.forEach((m) => LS.State.killMember(s, m.id, 'left'));
          rec(s, eid).status = 'arrived';
          LS.State.addLog(s, `${josa(whoNames(e), '이가')} 내렸다`, false, 'event', `임시 동행 · ${LS.State.location(s).name}`);
          if (!thieves) ids.forEach((x) => LS.Factions.addRecord(s, 'helped', x, 'delivered'));
          if (rp) LS.Factions.changeRep(s, rp.faction, rp.amount, `${josa(whoNames(e), '을를')} ${LS.State.location(s).name}까지 데려다줬다`);
          if (e.request) LS.Time.handle(LS.Requests.onDelivered(s, e.request));   // 이송 부탁 완료
        }
      }]
    };
  }

  // ---------- 합류 조건 (17장): 첫 위반 경고, 두 번째 관계 하락·다음 장소 하차 요구 ----------
  function violation(state, id, why) {
    const m = R().member(state, id);
    if (!m) return [];
    const c = LS.CHARACTERS[id];
    m.violations = (m.violations || 0) + 1;
    m.keptSince = state.minute;   // 5일 준수는 다시 센다
    const second = m.violations >= 2;
    if (second) m.leaveAtNext = true;
    // 참조 A: 1회 위반 당사자 정신력 -3 · 2회 위반 리더 신뢰 -4, 소속 평판 -2, 당사자 -5
    R().addMental(m, second ? -5 : -3);
    const notes = [];
    if (second) {
      notes.push(LS.Factions.changeTrust(state, -4, `${nm(id)}의 합류 조건을 두 번 어겼다`));
      if (c.faction) notes.push(LS.Factions.changeRep(state, c.faction, -2, `${nm(id)}의 합류 조건을 두 번 어겼다`));
    }
    LS.State.addLog(state, `${nm(id)}: 합류 조건을 어겼다`, true, 'event', `${c.joinCondition} · ${why} · ${second ? '다음 장소에서 내리겠다고 한다' : '첫 경고'}${notes.filter(Boolean).length ? ' · ' + notes.filter(Boolean).join(' · ') : ''}`);
    return [{
      dialog: {
        title: `${nm(id)}의 조건`, screen: state.travel ? 'travel' : 'outside',
        lines: [{ speaker: id, text: second ? c.leaveLine : c.warnLine }],
        observations: [`합류 조건: ${c.joinCondition}`, why, second
          ? `두 번째: 다음에 서는 장소에서 내린다 · 리더 신뢰 -4${c.faction ? ` · ${LS.FACTIONS[c.faction].name} 평판 -2` : ''} · ${nm(id)} 정신력 -5`
          : `첫 경고: 한 번 더 어기면 내리겠다고 한다 · ${nm(id)} 정신력 -3`],
        choices: [{ label: second ? '알았다' : '조심하겠다' }]
      }
    }];
  }

  function leaveEvent(state, m) {
    return {
      title: `${nm(m.id)}의 하차`, screen: 'outside',
      lines: [{ speaker: m.id, text: '약속한 대로 여기서 내리겠소.' }, { speaker: 'narration', text: `${josa(nm(m.id), '은는')} 짐을 챙겨 버스에서 내렸다.` }],
      observations: ['합류 조건을 두 번 어겼다', '붙잡는 설득은 6단계(리더 신뢰)에서 연결'],
      choices: [{
        label: '보내 준다',
        run: (s) => {
          LS.State.killMember(s, m.id, 'left');
          LS.State.addLog(s, `${josa(nm(m.id), '이가')} 떠났다`, true, 'event', '합류 조건을 두 번 어겼다');
        }
      }]
    };
  }

  // 한정수: 하루 운전 8시간까지 (날은 자정에 바뀐다). Travel이 운전한 만큼 부른다
  function onDrive(state, driver, dt) {
    if (LS.CHARACTERS[driver.id].condition !== 'drive8') return [];
    const idx = LS.Clock.rolloverIndex(state.minute);
    if (!driver.driveLog || driver.driveLog.idx !== idx) driver.driveLog = { idx, min: 0, broke: false };
    const before = driver.driveLog.min;
    driver.driveLog.min += dt;
    if (!driver.driveLog.broke && before < P().driveLimitMin && driver.driveLog.min >= P().driveLimitMin) {
      driver.driveLog.broke = true;
      return violation(state, driver.id, '오늘 운전이 8시간을 넘었다');
    }
    return [];
  }

  function drivenToday(state, m) {
    const idx = LS.Clock.rolloverIndex(state.minute);
    return m.driveLog && m.driveLog.idx === idx ? m.driveLog.min : 0;
  }

  // ---------- 매 진행 구간 ----------
  function advance(state, prev, next) {
    const out = [];
    meetBrothers(state, out);
    thiefCheck(state, out);
    return out;
  }

  // 22장 ①: 2~3일째 낮, 버스가 서 있으면 도로변의 두 사람이 다가온다
  function meetBrothers(state, out) {
    const r = rec(state, 'brothers');
    if (r.status !== 'unmet') return;
    const d = LS.Clock.day(state.minute);
    if (d > 3) { r.status = 'missed'; return; }
    const h = LS.Clock.hour(state.minute);
    if (d < 2 || state.travel || !state.stop || state.dialogOpen) return;
    if (h < P().meetHours[0] || h >= P().meetHours[1]) return;
    if (LS.Zombie.siegeActive(state)) return;
    meet(state, 'brothers', out);
  }

  function taskOf(state, m) { return m.task ? LS.Tasks.find(state, m.task) : null; }

  // 버스 안 사정: 버스에 남은 사람, 깨어 있는 사람, 경계 서는 사람
  function situation(state) {
    const others = state.crew.filter((m) => !(m.temp && m.temp.thief));
    const inBus = others.filter((m) => { const t = taskOf(state, m); return !(t && LS.Tasks.DEF[t.type].outside); });
    const watching = inBus.filter((m) => { const t = taskOf(state, m); return t && t.type === 'watch'; });
    const awake = inBus.filter((m) => { const t = taskOf(state, m); return !(t && (LS.Tasks.DEF[t.type].isSleep || t.type === 'watch')); });
    return { inBus, watching, awake, night: LS.Clock.isNight(state.minute) };
  }

  // Sim이 매 진행 구간마다 작업보다 먼저 부른다: 구간 동안의 사정으로 판단한다 (10분 외부 확인 동안 버스가 빈 것도 놓치지 않게)
  let snap = null;
  function beginStep(state) { snap = situation(state); }

  // 도둑: 버스가 비거나, 밤에 모두 잠들면 식량을 들고 달아난다. 깨어 경계 서는 사람이 1명이라도 있으면 들킨다 (22장)
  function thiefCheck(state, out) {
    if (state.travel) return;
    const thieves = state.crew.filter((m) => m.temp && m.temp.thief && !m.temp.caught);
    if (!thieves.length) { snap = null; return; }
    const cur = situation(state);
    const sit = snap || cur;
    snap = null;
    const inBus = sit.inBus;
    const watching = sit.watching.length ? sit.watching : cur.watching;
    const chance = sit.inBus.length === 0 || (sit.night && sit.awake.length === 0);
    if (!chance) return;
    const eid = thieves[0].temp.enc;
    const take = Math.floor(LS.State.foodTotal(state) / 2);
    if (watching.length) {
      thieves.forEach((m) => { m.temp.caught = true; });
      LS.State.addLog(state, '식량을 들고 나가려던 두 사람을 붙잡았다', true, 'event', `${josa(names(watching), '이가')} 경계를 서고 있었다`);
      out.push({ dialog: caughtEvent(state, eid, thieves, watching) });
      return;
    }
    LS.Meals.take(state, take);
    thieves.forEach((m) => LS.State.killMember(state, m.id, 'left'));
    rec(state, eid).status = 'stole';
    LS.State.addLog(state, '두 사람이 식량을 들고 사라졌다', true, 'event', `식량 -${take}인분 · ${inBus.length ? '모두 잠든 사이' : '버스가 빈 사이'}`);
    out.push({
      dialog: {
        title: '사라진 두 사람', screen: 'bus',
        lines: [
          { speaker: 'narration', text: inBus.length ? '눈을 떠 보니 두 사람이 없다. 식량 상자가 가볍다.' : '돌아와 보니 버스 문이 열려 있다. 두 사람과 식량 일부가 사라졌다.' },
          { speaker: voice(state), text: '…처음부터 이럴 생각이었던 거예요.' }
        ],
        observations: [`식량 -${take}인분 (남은 식량 ${R().round1(LS.State.foodTotal(state))}인분)`, '경계를 세웠다면 붙잡을 수 있었다 (1명이면 된다)', '태우기 전에 면담·검사로 단서를 찾을 수 있다'],
        choices: [{ label: '다음부터는 조심한다' }]
      }
    });
  }

  function names(ms) { return ms.map((m) => nm(m.id)).join('·'); }

  function caughtEvent(state, eid, thieves, watching) {
    const food = LS.State.foodTotal(state);
    return {
      title: '붙잡힌 두 사람', screen: 'bus',
      lines: [
        { speaker: 'narration', text: `어둠 속에서 식량 상자를 들고 나가려던 두 사람을 ${josa(names(watching), '이가')} 붙잡았다.` },
        { speaker: 'go_mansik', text: '…배가 고파서 그랬소. 한 번만 봐 주쇼.' }
      ],
      observations: ['식량은 아직 버스 안에 있다', '용서하면 목적지까지 태운다 (다시 훔치지 않는다)', '무소속이라 어떻게 해도 평판은 바뀌지 않는다'],
      choices: [
        {
          label: '식량을 돌려받고 용서한다',
          desc: '목적지(다음 마을)까지 계속 태운다',
          run: (s) => LS.State.addLog(s, '두 사람을 용서했다', false, 'event', '다음 마을까지 태운다'),
          result: { lines: [{ speaker: 'go_mansu', text: '…고맙습니다.' }] }
        },
        {
          label: '식량을 돌려받고 내리게 한다',
          run: (s) => {
            thieves.forEach((m) => LS.State.killMember(s, m.id, 'left'));
            rec(s, eid).status = 'caught';
            LS.State.addLog(s, '두 사람을 내리게 했다', false, 'event', '식량은 돌려받았다');
          },
          result: { lines: [{ speaker: 'narration', text: '두 사람은 어둠 속으로 걸어갔다.' }] }
        },
        {
          label: `식량 ${P().supportFood}인분을 쥐여 주고 보낸다`,
          desc: food < P().supportFood ? '나눠 줄 식량이 없다' : '',
          disabled: food < P().supportFood,
          run: (s) => {
            LS.Meals.take(s, P().supportFood);
            thieves.forEach((m) => LS.State.killMember(s, m.id, 'left'));
            rec(s, eid).status = 'caught';
            LS.State.addLog(s, '두 사람에게 식량을 쥐여 주고 보냈다', false, 'event', `식량 -${P().supportFood}인분`);
          },
          result: { lines: [{ speaker: 'go_mansik', text: '…이 은혜는 안 잊겠소.' }] }
        }
      ]
    };
  }

  return {
    present, meet, decide, decisionChoices, reveal, talkBlock, onStop, onDepart, advance, beginStep,
    violation, onDrive, drivenToday, kindText, seatsFree, rec
  };
})();
