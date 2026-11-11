// 부탁·급한 용무·리더 약속·작은 순간·14일째 안부 방송 (17장, 20~21장, 23장 ⑤, 참조 A). 5단계 3차.
window.LS = window.LS || {};

LS.Requests = (function () {
  const R = () => LS.Rules;
  const RR = () => LS.REQUEST_RULES;
  const F = () => LS.Factions;
  const josa = (w, p) => LS.Rules.josa(w, p);
  const nm = (id) => LS.Rules.name(id);
  const DAY = 1440;
  let seq = 1;

  function setup(state) {
    state.requests = { list: [], offered: {}, moments: { done: {}, lastDay: -1, pending: [] }, rescueSeen: {} };
  }

  function tpl(tid) { return LS.REQUESTS[tid] || null; }
  function factionOf(r) { return r.faction || (r.from && LS.CHARACTERS[r.from] && LS.CHARACTERS[r.from].faction) || null; }
  function active(state, kind) { return state.requests.list.filter((r) => r.status === 'active' && (!kind || r.kind === kind)); }
  function get(state, id) { return state.requests.list.find((r) => r.id === id) || null; }
  function room(state, kind) {
    if (kind === 'urgent') return active(state, 'urgent').length < RR().maxUrgent;
    return active(state, 'normal').length < RR().maxNormal;
  }
  function locName(id) { return id === 'airport' ? '공항' : (LS.LOCATIONS[id] ? LS.LOCATIONS[id].name : id); }
  function left(state, r) { return r.deadline == null ? null : r.deadline - state.minute; }
  function hl(min) { return R().hoursLabel(Math.max(0, min)); }

  // 어디서 무엇을 하는지 한 줄
  function whereText(r) {
    const t = tpl(r.tid) || {};
    if (r.kind === 'promise') return `${locName(r.at)}로 돌아가 데려온다`;
    if (t.where) return t.where;
    if (t.deliver) return `${locName(t.deliver)}까지 태워 간다`;
    if (t.airport) return '공항 접수대에 전한다';
    const targets = r.target || t.target || [];
    const what = t.work ? `${t.work.label} (2명 · ${hl(t.work.minutes)})` : t.pay ? `${F().costText(t.pay)} 내기` : '';
    return `${targets.map(locName).join(' 또는 ')}에서 ${what}`;
  }

  function rewardText(r) {
    const t = tpl(r.tid) || {};
    return (r.rewardText || t.rewardText || '') + (r.factor < 1 ? ' (연장해서 물자 보상 70%)' : '');
  }

  // ---------- 제안·수락 ----------
  function offerEvent(state, tid, ctx) {
    ctx = ctx || {};
    const t = tpl(tid);
    const can = room(state, t.kind);
    const r0 = { tid, kind: t.kind, target: ctx.target || t.target, from: t.from };
    const obs = [
      t.kind === 'urgent' ? `기한: ${hl(t.hours * 60)} 안 (연락으로 미룰 수 없다)` : `기한: ${t.days ? t.days + '일' : '없음 (공항까지)'}`,
      `할 일: ${whereText(r0)}`,
      `보상: ${ctx.rewardText || t.rewardText}`,
      `받은 부탁: 일반 ${active(state, 'normal').length}/${RR().maxNormal} · 급한 용무 ${active(state, 'urgent').length}/${RR().maxUrgent}`,
      t.kind === 'urgent' ? '실패: 포기 연락 평판 -1 · 늦음 -2 · 연락 없이 무시 -4' : '거절해도 평판은 그대로 · 기한을 넘기면 평판이 깎인다'
    ].concat(ctx.extraObs || []);
    return {
      title: `${t.kind === 'urgent' ? '급한 용무' : '부탁'} · ${t.title}`, screen: state.travel ? 'travel' : 'outside',
      lines: ctx.lines || t.ask,
      observations: obs,
      choices: [
        {
          label: '맡는다',
          desc: can ? '' : (t.kind === 'urgent' ? '이미 급한 용무를 하나 맡았다' : `부탁이 ${RR().maxNormal}개라 더 받을 수 없다`),
          disabled: !can,
          run: (s) => accept(s, tid, ctx),
          result: { lines: [{ speaker: 'narration', text: `부탁을 맡았다: ${t.title}. 버스 내부의 [부탁 목록]에서 확인할 수 있다.` }] }
        },
        {
          label: '거절한다',
          run: (s) => { s.requests.offered[ctx.key || tid] = true; LS.State.addLog(s, `부탁 거절: ${t.title}`, false, 'event', '평판 변화 없음'); },
          result: { lines: [{ speaker: 'narration', text: '고개를 저었다. 상대는 아쉬운 얼굴로 물러섰다.' }] }
        }
      ]
    };
  }

  function accept(state, tid, ctx) {
    ctx = ctx || {};
    const t = tpl(tid);
    state.requests.offered[ctx.key || tid] = true;
    const base = t.kind === 'urgent' ? t.hours * 60 : (t.days ? t.days * DAY : null);
    const r = {
      id: ctx.key || tid + '#' + (seq++), tid, kind: t.kind, status: 'active', from: t.from || null,
      faction: ctx.faction || null, target: ctx.target || t.target || null, rewardText: ctx.rewardText || null,
      who: ctx.who || null, acceptedAt: state.minute, base, deadline: base == null ? null : state.minute + base,
      extended: false, factor: 1, tried: false
    };
    state.requests.list.push(r);
    LS.State.addLog(state, `부탁을 맡았다: ${t.title}`, true, 'event', `${whereText(r)}${r.deadline != null ? ` · 기한 ${LS.Clock.fullLabel(r.deadline)}` : ''}`);
    return r;
  }

  // ---------- 진행: 일·물자·이송 ----------
  function errandBlock(state, id) {
    const r = get(state, id);
    if (!r || r.status !== 'active') return '맡은 부탁이 아니다';
    const t = tpl(r.tid);
    if (!t || !t.work) return '여기서 할 일이 아니다';
    if (!(r.target || []).includes(state.locationId)) return `${(r.target || []).map(locName).join(' 또는 ')}에서 해야 한다`;
    if (state.tasks.some((x) => x.type === 'errand' && x.purpose === id)) return '이미 하고 있다';
    return '';
  }
  function workMinutes(id, state) { const r = get(state, id); const t = r && tpl(r.tid); return t && t.work ? t.work.minutes : 120; }
  function workLabel(state, id) { const r = get(state, id); const t = r && tpl(r.tid); return t && t.work ? t.work.label : '부탁 일'; }

  function onErrandStart(state, id) { const r = get(state, id); if (r) r.tried = true; }

  function onErrandDone(state, task, ms) {
    const r = get(state, task.purpose);
    if (!r || r.status !== 'active') return { summary: '부탁은 이미 끝났다', out: [] };
    return complete(state, r, ms);
  }

  function payBlock(state, id) {
    const r = get(state, id);
    if (!r || r.status !== 'active') return '맡은 부탁이 아니다';
    const t = tpl(r.tid);
    if (!t.pay) return '';
    if (!(r.target || []).includes(state.locationId)) return `${(r.target || []).map(locName).join(' 또는 ')}에서 낼 수 있다`;
    if (!F().canPay(state, t.pay)) return `${F().costText(t.pay)}이 모자라다`;
    return '';
  }

  function pay(state, id) {
    const b = payBlock(state, id);
    if (b) return { error: b };
    const r = get(state, id);
    const t = tpl(r.tid);
    Object.keys(t.pay).forEach((k) => { if (k === 'food') LS.Meals.take(state, t.pay[k]); else state.resources[k] = R().round1(state.resources[k] - t.pay[k]); });
    const res = complete(state, r, []);
    LS.Time.handle(res.out);
    return { text: res.summary };
  }

  // 임시 동행(권순자)을 목적지에 내려 줬을 때 (People의 작별에서 부른다)
  function onDelivered(state, tid) {
    const r = state.requests.list.find((x) => x.tid === tid && x.status === 'active');
    if (!r) return [];
    return complete(state, r, []).out;
  }

  // 부탁 완료 (참조 A: 일반 +2~+3 · 급한 용무 +4~+5 · 참여자 정신력 +2)
  function complete(state, r, ms) {
    const t = tpl(r.tid);
    const f = factionOf(r);
    r.status = 'done';
    r.doneAt = state.minute;
    const notes = [];
    if (t.reward.rep && f) notes.push(F().changeRep(state, f, t.reward.rep, `부탁을 들어줬다: ${t.title}`));
    if (t.reward.give) {
      const give = {};
      Object.keys(t.reward.give).forEach((k) => { const v = t.reward.give[k]; give[k] = Math.max(1, Math.round(v * r.factor)); });
      Object.keys(give).forEach((k) => {
        if (k === 'food') LS.Meals.addFood(state, give[k], 0.3);
        else if (k === 'fuel') state.resources.fuel = R().round1(Math.min(state.resources.fuelCap, state.resources.fuel + give[k]));
        else state.resources[k] = (state.resources[k] || 0) + give[k];
        notes.push(`${(LS.LOOT_NAMES[k] || { name: k }).name} +${give[k]}`);
      });
    }
    if (t.reward.info === 'region') {
      const reg = LS.LOCATIONS[state.locationId] ? LS.LOCATIONS[state.locationId].region : 'residential';
      let n = 0;
      LS.ROUTES.forEach((rt) => {
        if (!LS.World.routeVisible(state, rt) || LS.World.routeRegion(rt.a, rt.b) !== reg) return;
        const info = state.routes[LS.World.routeKey(rt.a, rt.b)];
        if (!info.known && !info.traveled) { info.known = true; n++; }
      });
      notes.push(`${LS.REGIONS[reg].name} 길 ${n}곳 확인`);
    }
    if (t.reward.freeLodge) {
      state.flags['freeLodge_' + t.reward.freeLodge] = (state.flags['freeLodge_' + t.reward.freeLodge] || 0) + 1;
      notes.push(`${LS.FACTIONS[t.reward.freeLodge].name} 대피소 숙박 1회 무료`);
    }
    ms.forEach((m) => R().addMental(m, RR().doneMental));
    if (ms.length) notes.push(`${ms.map((m) => nm(m.id)).join('·')} 정신력 +${RR().doneMental}`);
    if (r.kind === 'urgent' && r.who) F().addRecord(state, 'helped', r.who, 'rescue');
    // 첫 부탁 성공 (작은 순간)
    if (!state.requests.moments.done.first_request) state.requests.moments.pending.push({ id: 'first_request', ms: ms.map((m) => m.id) });
    const summary = `부탁 완료: ${t.title} · ${notes.filter(Boolean).join(' · ')}`;
    LS.State.addLog(state, `부탁 완료: ${t.title}`, true, 'event', notes.filter(Boolean).join(' · '));
    const lines = (r.doneLines || t.done || [{ speaker: 'narration', text: '부탁을 마쳤다.' }]);
    return {
      summary,
      out: [{ dialog: { title: `부탁 완료 · ${t.title}`, screen: state.travel ? 'travel' : 'outside', lines, observations: notes.filter(Boolean), choices: [{ label: '좋다' }] } }]
    };
  }

  // ---------- 연락: 연장·포기 (20장) ----------
  // 지금은 대피소 무전으로만 연락할 수 있다 (통신 공간은 6단계)
  function canContact(state) { return !state.travel && !!(LS.REFUGES[state.locationId] && F().entry(state, state.locationId).open); }

  function extendBlock(state, id) {
    const r = get(state, id);
    if (!r || r.status !== 'active') return '맡은 부탁이 아니다';
    if (r.kind !== 'normal') return '급한 용무는 미룰 수 없다';
    if (r.deadline == null) return '기한이 없다';
    if (r.extended) return '이미 한 번 미뤘다';
    if (left(state, r) < r.base / 3) return '기한이 1/3도 안 남아 미룰 수 없다';
    if (!canContact(state)) return '대피소 무전으로 연락해야 한다';
    return '';
  }

  function extend(state, id) {
    const b = extendBlock(state, id);
    if (b) return { error: b };
    const r = get(state, id);
    r.deadline += Math.round(r.base * RR().extendFactor);
    r.extended = true;
    r.factor = RR().extendReward;
    LS.State.addLog(state, `부탁 기한을 미뤘다: ${tpl(r.tid).title}`, false, 'event', `새 기한 ${LS.Clock.fullLabel(r.deadline)} · 물자 보상 70%`);
    return { text: `기한을 ${LS.Clock.fullLabel(r.deadline)}까지 미뤘다 (물자 보상 70%)` };
  }

  function giveUp(state, id) {
    const r = get(state, id);
    if (!r || r.status !== 'active') return { error: '맡은 부탁이 아니다' };
    if (r.kind === 'promise') return { error: '약속은 포기 연락이 없다' };
    if (!canContact(state)) return { error: '대피소 무전으로 연락해야 한다' };
    r.status = 'gaveup';
    const t = tpl(r.tid);
    const n = F().changeRep(state, factionOf(r), RR().giveUpRep, `부탁을 포기한다고 미리 알렸다: ${t.title}`);
    LS.State.addLog(state, `부탁 포기: ${t.title}`, true, 'event', n || '');
    return { text: `포기한다고 알렸다${n ? ' · ' + n : ''}` };
  }

  // ---------- 리더 약속 (20장, 23장 ⑤) ----------
  function promise(state, encId) {
    const e = LS.ENCOUNTERS[encId];
    const rec = LS.People.rec(state, encId);
    rec.status = 'promised';
    const r = {
      id: 'promise:' + encId, tid: 'promise', kind: 'promise', status: 'active', enc: encId, at: state.locationId,
      faction: LS.CHARACTERS[e.who[0]].faction || null, acceptedAt: state.minute,
      base: RR().promiseDays * DAY, deadline: state.minute + RR().promiseDays * DAY, extended: false, factor: 1
    };
    state.requests.list.push(r);
    LS.State.addLog(state, `리더 약속: ${josa(e.who.map(nm).join('·'), '을를')} 데리러 오겠다`, true, 'event', `${locName(r.at)} · ${RR().promiseDays}일 안 (${LS.Clock.fullLabel(r.deadline)})`);
    return r;
  }

  function reunionEvent(state, r) {
    const e = LS.ENCOUNTERS[r.enc];
    const late = state.minute > r.deadline;
    const names = e.who.map(nm).join('·');
    const free = LS.People.seatsFree(state);
    const need = e.who.length;
    return {
      title: '약속한 사람과 재회', screen: 'outside',
      lines: late
        ? [{ speaker: e.who[0], text: '…늦었네요. 못 오는 줄 알았어요. 그래도 와 줬으니까요.' }]
        : [{ speaker: e.who[0], text: '정말 왔네요. 약속 지켜 줄 줄 알았어요.' }],
      observations: [
        late ? `기한을 ${hl(state.minute - r.deadline)} 넘겼다 · 설명하고 태우면 평판 변화 없음` : '기한 안: 태우면 리더 신뢰 +2 · 소속 평판 +3 · 본인 정신력 +5',
        `좌석 ${state.crew.length}/${state.bus.seats} · ${need}자리 필요`
      ],
      choices: [
        {
          label: '태운다',
          desc: free < need ? '좌석이 모자라다 (자리를 만든 뒤 다시 와도 된다)' : '',
          disabled: free < need,
          resolve: (s) => {
            const rec = LS.People.rec(s, r.enc);
            rec.status = 'met';
            rec.at = s.locationId;
            LS.People.decide(s, r.enc, 'accept');
            r.status = 'done';
            const notes = [];
            if (!late) {
              notes.push(F().changeTrust(s, 2, `약속대로 ${josa(names, '을를')} 데리러 왔다`));
              if (r.faction) notes.push(F().changeRep(s, r.faction, 3, `${josa(names, '와과')}의 약속을 지켰다`));
              e.who.forEach((id) => { const m = R().member(s, id); if (m) R().addMental(m, 5); });
            }
            LS.State.addLog(s, `약속 ${late ? '늦게 ' : ''}지킴: ${names}`, true, 'event', notes.filter(Boolean).join(' · ') || '늦었지만 설명하고 태웠다');
            return { lines: [{ speaker: 'narration', text: `${josa(names, '이가')} 버스에 올랐다.${notes.filter(Boolean).length ? ' (' + notes.filter(Boolean).join(', ') + ')' : ''}` }] };
          }
        },
        { label: '아직 자리가 없다. 다시 오겠다', desc: late ? '기한 뒤 2일이 지나면 약속을 어긴 것이 된다' : `기한 ${LS.Clock.fullLabel(r.deadline)}`, result: { lines: [{ speaker: e.who[0], text: '…기다릴게요.' }] } }
      ]
    };
  }

  function breakPromise(state, r) {
    const e = LS.ENCOUNTERS[r.enc];
    const names = e.who.map(nm).join('·');
    r.status = 'broken';
    LS.People.rec(state, r.enc).status = 'gone';
    const notes = [F().changeTrust(state, -4, `${josa(names, '와과')}의 약속을 어겼다`)];
    if (r.faction) notes.push(F().changeRep(state, r.faction, -3, `${josa(names, '을를')} 데리러 가지 않았다`));
    e.who.forEach((id) => F().addRecord(state, 'letGo', id, 'promise'));
    LS.State.addLog(state, `약속을 어겼다: ${names}`, true, 'event', notes.filter(Boolean).join(' · ') + ' · 내려놓은 선택으로 기록');
    return { toast: `약속을 어겼다: ${josa(names, '은는')} 더 기다리지 않았다 (${notes.filter(Boolean).join(', ')})`, important: true, stop: true };
  }

  // ---------- 도착 ----------
  function onArrive(state, out) {
    const loc = state.locationId;
    // 리더 약속: 그 장소에 돌아왔다
    active(state, 'promise').filter((r) => r.at === loc).forEach((r) => out.push({ dialog: reunionEvent(state, r) }));
    // 급한 용무: 목표에 왔으면 '노력했다'로 친다
    active(state).forEach((r) => { if ((r.target || []).includes(loc)) r.tried = true; });
    // 이곳에서 할 수 있는 부탁 알림
    const here = active(state).filter((r) => (r.target || []).includes(loc));
    if (here.length) out.push({ toast: `부탁: 여기서 할 일이 있다 (${here.map((r) => tpl(r.tid).title).join(', ')}) · 정차 외부의 [부탁] 버튼` });
    // 대피소에서 받는 부탁 (송지호 아이 명단)
    Object.keys(LS.REQUESTS).forEach((tid) => {
      const t = tpl(tid);
      if (t.offer !== 'refuge' || t.at !== loc || state.requests.offered[tid] || !room(state, t.kind)) return;   // 자리가 없으면 다음에 묻는다
      if (!F().entry(state, loc).open) return;
      out.push({ dialog: offerEvent(state, tid) });
      state.requests.offered[tid] = true;   // 거절하든 맡든 한 번만 묻는다
    });
    // 합류한 동료의 부탁: 합류하고 나서 처음 서는 곳에서 하나씩
    const m = state.crew.find((x) => {
      const tid = Object.keys(LS.REQUESTS).find((k) => LS.REQUESTS[k].from === x.id && LS.REQUESTS[k].offer === 'join');
      return tid && !state.requests.offered[tid] && room(state, 'normal') && x.joinedAt != null && state.minute - x.joinedAt >= 60;
    });
    if (m) {
      const tid = Object.keys(LS.REQUESTS).find((k) => LS.REQUESTS[k].from === m.id && LS.REQUESTS[k].offer === 'join');
      state.requests.offered[tid] = true;
      out.push({ dialog: offerEvent(state, tid) });
    }
    // 급한 용무: 대피소에 처음 왔을 때 무전으로 [임시]
    const rf = LS.REFUGES[loc];
    if (rf && !state.requests.rescueSeen[loc] && LS.Clock.day(state.minute) >= RR().rescueFromDay && F().entry(state, loc).open) {
      state.requests.rescueSeen[loc] = true;
      if (R().chance(RR().rescueChance)) { const ev = rescueOffer(state, loc); if (ev) out.push({ dialog: ev }); }
    }
  }

  function rescueOffer(state, loc) {
    const rf = LS.REFUGES[loc];
    const opts = LS.World.routesFrom(loc, state).filter((r) => !LS.LOCATIONS[r.to].exit && !LS.REFUGES[r.to]);
    if (!opts.length) return null;
    const pick = R().pick(opts);
    const t = tpl('rescue');
    const tgt = pick.to;
    const hrs = pick.hours;
    const spare = t.hours - hrs - t.work.minutes / 60;
    return offerEvent(state, 'rescue', {
      key: 'rescue@' + loc, target: [tgt], faction: rf.faction, who: 'rescued_' + loc,
      lines: [
        { speaker: 'radio', text: `${rf.name} 무전입니다. ${locName(tgt)}에 주민 한 명이 고립돼 있어요. 무리가 그쪽으로 가고 있습니다.` },
        { speaker: rf.host, text: `${t.hours}시간 안에 꺼내지 못하면 늦어요. 우리 쪽은 손이 모자라요. 부탁할게요.` }
      ],
      extraObs: [`지금 경로: 여기서 ${locName(tgt)}까지 약 ${hrs}시간 운전 + 구조 1시간 · 여유 약 ${Math.max(0, Math.round(spare))}시간`]
    });
  }

  // ---------- 매 진행 구간: 기한·약속·작은 순간 ----------
  function advance(state, prev, next) {
    const out = [];
    state.requests.list.forEach((r) => {
      if (r.status !== 'active' || r.deadline == null) return;
      if (r.kind === 'promise') {
        if (next >= r.deadline + RR().promiseLateDays * DAY) out.push(breakPromise(state, r));
        return;
      }
      if (next < r.deadline) return;
      const t = tpl(r.tid);
      let rep;
      let why;
      if (r.kind === 'urgent') { rep = r.tried ? RR().lateRep : RR().ignoreRep; why = r.tried ? '노력했지만 늦었다' : '연락 없이 가지 않았다'; }
      else { rep = r.extended ? RR().extendLateRep : RR().lateRep; why = r.extended ? '미룬 기한까지 어겼다' : '기한을 넘겼다'; }
      r.status = 'failed';
      const n = F().changeRep(state, factionOf(r), rep, `부탁 실패: ${t.title} (${why})`);
      LS.State.addLog(state, `부탁 실패: ${t.title}`, true, 'event', `${why}${n ? ' · ' + n : ''}`);
      if (r.kind === 'urgent') {
        // 20장: 늦었을 때 대상의 죽음과 상대 반응을 짧게 보여 준다
        const rf = Object.keys(LS.REFUGES).find((k) => LS.REFUGES[k].faction === r.faction);
        out.push({ dialog: {
          title: `급한 용무 실패 · ${t.title}`, screen: state.screen === 'travel' ? 'travel' : 'outside',
          lines: [
            { speaker: 'radio', text: `…${(r.target || []).map(locName).join('')}의 주민과 연락이 끊겼습니다. 끝내 구하지 못했습니다.` },
            { speaker: rf ? LS.REFUGES[rf].host : 'radio', text: r.tried ? '애써 준 건 알아요. …그래도 너무 늦었어요.' : '오겠다고 했잖아요. 우린 기다렸어요.' }
          ],
          observations: [`${why}${n ? ' · ' + n : ''}`],
          choices: [{ label: '…' }]
        } });
      } else out.push({ stop: true, important: true, toast: `부탁 실패: ${t.title} · ${why}${n ? ' · ' + n : ''}` });
    });
    if (!state.travel && !state.dialogOpen) moments(state, out);
    return out;
  }

  // ---------- 작은 순간 (21장): 같은 장면 한 판 1회, 하루 최대 1개 ----------
  function noDeathsSince(state, min) { return !state.dead.some((d) => d.how !== 'left' && d.minute >= min); }
  function safeNight(state) {
    if (!LS.Clock.isNight(state.minute) || state.zombie.siege) return false;
    const h = state.zombie.horde;
    if (h && h.known && h.coming) return false;
    const place = LS.State.place(state);
    return !!(F().safeStop(state) || (place && place.scouted) || LS.Tasks.watchers(state) >= 2);
  }

  function moments(state, out) {
    const M = state.requests.moments;
    const day = LS.Clock.rolloverIndex(state.minute);
    // 합류 조건 5일 준수: 소속 평판 +2 (참조 A), 장면이 있으면 작은 순간
    state.crew.forEach((m) => {
      const c = LS.CHARACTERS[m.id];
      if (!c.condition || m.keptDone || m.keptSince == null || m.temp) return;
      if (state.minute - m.keptSince < RR().keptDays * DAY) return;
      m.keptDone = true;
      const n = c.faction ? F().changeRep(state, c.faction, 2, `${nm(m.id)}의 합류 조건을 5일 지켰다`) : '';
      LS.State.addLog(state, `${nm(m.id)}: 합류 조건을 5일 지켰다`, false, 'event', `${c.joinCondition}${n ? ' · ' + n : ''}`);
      const mid = Object.keys(LS.MOMENTS).find((k) => LS.MOMENTS[k].kept && (LS.MOMENTS[k].keptBy || LS.MOMENTS[k].who) === m.id);
      if (mid && !M.done[mid] && !M.pending.some((p) => p.id === mid)) M.pending.push({ id: mid });
    });
    if (M.lastDay === day) return;
    let pick = null;
    const h = LS.Clock.hour(state.minute);
    // 기다리는 장면 (5일 준수·첫 부탁 성공): 장면의 주인공이 아직 버스에 있어야 한다
    for (let i = 0; i < M.pending.length && !pick; i++) {
      const p = M.pending[i];
      const def = LS.MOMENTS[p.id];
      if (M.done[p.id] || (def.who && !R().member(state, def.who))) { M.pending.splice(i--, 1); continue; }
      if (def.hours && !(h >= def.hours[0] && h < def.hours[1])) continue;   // 정해진 시간대에만 (새벽 점검)
      M.pending.splice(i, 1);
      pick = p;
    }
    if (!pick && !M.done.firehouse && safeNight(state)) {
      const y = R().member(state, 'yoon_jaeha');
      const p = R().member(state, 'park_seoyun');
      if (y && p && [y, p].every((m) => m.mental >= 50 && m.mental <= 70)) pick = { id: 'firehouse' };
    }
    if (!pick && !M.done.radio_song && h >= 18 && h < 22 && LS.Clock.day(state.minute) >= 4 && noDeathsSince(state, state.minute - 3 * DAY)) pick = { id: 'radio_song' };
    if (!pick) return;
    M.done[pick.id] = true;
    M.lastDay = day;
    const def = LS.MOMENTS[pick.id];
    const eff = applyMoment(state, pick);
    LS.State.addLog(state, `작은 순간: ${def.title}`, true, 'event', eff);
    out.push({ dialog: { title: `작은 순간 · ${def.title}`, screen: state.screen === 'travel' ? 'bus' : state.screen, lines: def.lines, observations: [eff], choices: [{ label: '…' }] } });
  }

  function applyMoment(state, p) {
    const def = LS.MOMENTS[p.id];
    if (p.id === 'yoo_gift') { state.resources.parts += 1; return '부품 +1'; }
    if (p.id === 'han_check') { const b = state.bus; b.durability = Math.min(b.maxDurability, b.durability + 5); return `내구도 +5 (${b.durability})`; }
    if (p.id === 'narae_alley') {
      let n = 0;
      if (state.locationId && state.locationId !== 'roadside') LS.World.routesFrom(state.locationId, state).forEach((r) => { const i = state.routes[r.key]; if (!i.known && !i.traveled) { i.known = true; n++; } });
      return n ? `여기서 나가는 길 ${n}곳 확인 (도로 사건 20%)` : '이미 아는 길뿐이라 다음에 써먹기로 했다';
    }
    if (p.id === 'hayul_drawing' || p.id === 'radio_song') { const v = p.id === 'hayul_drawing' ? 2 : 1; state.crew.forEach((m) => R().addMental(m, v)); return `전원 정신력 +${v}`; }
    if (p.id === 'firehouse') { ['yoon_jaeha', 'park_seoyun'].forEach((id) => { const m = R().member(state, id); if (m) R().addMental(m, 3); }); return '윤재하·박서윤 정신력 +3'; }
    if (p.id === 'first_request') {
      const ms = (p.ms || []).map((id) => R().member(state, id)).filter(Boolean);
      const who = ms.length ? ms : state.crew.slice(0, 2);
      who.forEach((m) => R().addMental(m, 2));
      return `${who.map((m) => nm(m.id)).join('·')} 정신력 +2`;
    }
    return def.effect;
  }

  // ---------- 14일째 대피소 안부 방송 (21장, 19장 소문) ----------
  function radioD14(state) {
    const lines = [{ speaker: 'narration', text: '14일째 아침. 라디오에서 대피소 연합의 안부 방송이 흘러나온다.' }];
    const obs = [];
    const left = state.record.helped.filter((h) => h.how === 'handover' || h.how === 'delivered');
    if (left.length) {
      const groups = {};
      left.forEach((h) => { (groups[h.where] = groups[h.where] || []).push(nm(h.id)); });
      Object.keys(groups).slice(0, 2).forEach((w) => lines.push({ speaker: 'radio', text: `${locName(w)}에서 전합니다. ${groups[w].join('·')} 씨는 잘 지내고 있습니다. 데려다준 버스에 고맙다고 합니다.` }));
    } else lines.push({ speaker: 'radio', text: '각 대피소는 오늘도 버티고 있습니다. 맡길 사람이 있으면 연합 대피소로 데려오십시오.' });
    const rumors = state.record.rumors.filter((r) => !r.spread);
    if (rumors.length) {
      lines.push({ speaker: 'radio', text: '…그리고 사람을 위험한 곳에 강제로 내리게 한 버스가 있다는 소문이 돕니다. 각 거점은 조심하십시오.' });
      obs.push(`소문: ${rumors.map((r) => nm(r.id)).join('·')} 강제 하차 → 모든 집단 평판 -1`);
    }
    lines.push({ speaker: 'radio', text: '의료 네트워크 공고입니다. 도심 쪽 진료소가 약과 물자 교환을 받습니다. 해독제 소식은 21일째 방송에서 전하겠습니다.' });
    const act = active(state).filter((r) => r.kind !== 'promise');
    if (act.length) obs.push(`맡은 부탁 ${act.length}개 · 버스 내부의 [부탁 목록]에서 확인`);
    obs.push('공항 접수 마감은 그대로 30일째 24시');
    return {
      title: '대피소 안부 방송', screen: 'bus', lines, observations: obs,
      choices: [{
        label: '라디오를 끈다',
        run: (s) => {
          const rs = s.record.rumors.filter((r) => !r.spread);
          if (!rs.length) return;
          rs.forEach((r) => { r.spread = true; });
          // [해석] 소문 수와 관계없이 방송 한 번에 모든 집단 -1
          Object.keys(LS.FACTIONS).forEach((k) => F().changeRep(s, k, -1, '14일째 방송: 강제 하차 소문'));
        }
      }]
    };
  }

  return {
    setup, tpl, active, get, room, offerEvent, accept, errandBlock, workMinutes, workLabel, onErrandStart, onErrandDone,
    payBlock, pay, onDelivered, complete, canContact, extendBlock, extend, giveUp, promise, onArrive, advance,
    radioD14, whereText, rewardText, left, locName
  };
})();
