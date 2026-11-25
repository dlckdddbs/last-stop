// 시연용 지름길 (2026-11-25, 기말 목표 "일반 진행과 시연용 지름길을 구분"). 시작 화면에만 있다.
// 지름길로 시작한 여정은 state.flags.demo에 표시되고, 기록과 결말 화면에도 "시연용 지름길"이라고 나온다.
window.LS = window.LS || {};

LS.Demo = (function () {
  const D = 1440;

  function at(day, hour) { return (day - 1) * D + hour * 60; }

  // 공통: 그 시각·장소까지 온 것처럼 상태를 맞춘다 (지나간 방송은 들은 것으로)
  function base(s, minute, loc, key) {
    s.minute = minute;
    s.locationId = loc;
    s.screen = 'outside';
    s.mealPolicy = 'normal';
    Object.assign(s.guides, { time: true, people: true, rest: true, work: true, travel: true });
    LS.SCHEDULE.forEach((e) => { if (e.at <= minute) s.fired[e.event] = true; });
    s.flags.airportKnown = true;
    if (minute >= 9 * D) s.flags.bridgeClosed = true;
    s.flags.firstCompanion = 'lee_sua';
    s.flags.companionSeen_outskirts_gas = true;
    s.flags.companionSeen_bus_garage = true;
    s.flags.demo = key;
    s.stop = { since: minute, nextRoll: minute + LS.CONFIG.zombie.stopMin };
    s.zombie.lastNightIdx = LS.Clock.rolloverIndex(minute) - 1;
    LS.People.rec(s, 'brothers').status = 'missed';
  }

  // where에서 태운 것으로 기록하며 합류시킨다
  function join(s, id, where, daysAgo) {
    const keep = s.locationId;
    const keepMin = s.minute;
    s.locationId = where;
    s.minute = keepMin - daysAgo * D;
    LS.State.addMember(s, id);
    s.minute = keepMin;
    s.locationId = keep;
    const m = LS.Rules.member(s, id);
    if (m) { m.joinedAt = keepMin - D; m.keptSince = keepMin - D; }
    const enc = Object.keys(LS.ENCOUNTERS).find((k) => LS.ENCOUNTERS[k].who.includes(id));
    if (enc) LS.People.rec(s, enc).status = 'joined';
  }

  function visit(s, ids) { ids.forEach((id) => { if (s.places[id]) s.places[id].visited = true; }); }
  function known(s, pairs) { pairs.forEach(([a, b]) => { const k = LS.World.routeKey(a, b); if (s.routes[k]) s.routes[k].traveled = true; }); }
  function setRes(s, r) {
    s.resources.food = r.food; s.resources.fresh = [];
    s.resources.fuel = r.fuel; s.resources.meds = r.meds; s.resources.parts = r.parts;
  }
  // 이미 지나온 여정의 기록 (맡기거나 데려다준 사람, 끝낸 부탁)
  function helped(s, id, where, how) { s.record.helped.push({ id, how, where, minute: s.minute - 3 * D }); }
  function doneRequest(s, tid) {
    const r = LS.Requests.accept(s, tid, {});
    r.status = 'done';
    r.doneAt = s.minute - 2 * D;
    s.requests.moments.done.first_request = true;   // 지나온 여정에서 이미 본 장면
    s.requests.offered[tid] = true;
  }

  const PATH_TO_DOWNTOWN = ['start_firestation', 'outskirts_gas', 'outskirts_houses', 'outskirts_junkyard', 'residential_gate', 'res_conv', 'res_school', 'res_apart', 'res_village', 'res_pharm', 'downtown_gate', 'dt_stop', 'dt_market'];

  const SCENARIOS = {
    downtown: {
      label: '도심에서 시작',
      sub: '12일째 09:00 · 도심 교환 거점 · 동료 5명 · 좌석 1자리 · 태울 사람이 기다린다',
      note: '시연용 지름길: 도심 교환 거점(12일째)에서 시작해요. 유상철을 태울지 정한 뒤 공항까지 가 보세요.',
      build(s) {
        base(s, at(12, 9), 'dt_market', 'downtown');
        visit(s, PATH_TO_DOWNTOWN);
        known(s, [['start_firestation', 'outskirts_gas'], ['outskirts_gas', 'outskirts_houses'], ['outskirts_houses', 'outskirts_junkyard'], ['outskirts_junkyard', 'residential_gate'], ['residential_gate', 'res_conv'], ['res_conv', 'res_school'], ['res_village', 'downtown_gate'], ['downtown_gate', 'dt_stop'], ['dt_stop', 'dt_market']]);
        join(s, 'lee_sua', 'outskirts_gas', 11);
        join(s, 'kim_narae', 'res_conv', 6);
        join(s, 'seo_dongjin', 'res_pharm', 3);
        s.record.boarded.push({ id: 'kwon_sunja', where: 'outskirts_houses', minute: s.minute - 10 * D });
        s.record.boarded.push({ id: 'jung_minkyung', where: 'res_apart', minute: s.minute - 5 * D }, { id: 'jung_hayul', where: 'res_apart', minute: s.minute - 5 * D });
        helped(s, 'kwon_sunja', 'res_village', 'delivered');
        helped(s, 'jung_minkyung', 'res_school', 'delivered');
        helped(s, 'jung_hayul', 'res_school', 'delivered');
        ['kwon_sunja', 'jung_family'].forEach((e) => { LS.People.rec(s, e).status = 'arrived'; });
        ['oh_taeseok', 'lee_junghoon', 'sua_patient'].forEach((e) => { LS.People.rec(s, e).status = 'passed'; });
        doneRequest(s, 'kwon_ride');
        doneRequest(s, 'narae_brother');
        LS.Requests.accept(s, 'song_list', {});
        ['sua_patient', 'seo_material', 'oh_debt'].forEach((t) => { s.requests.offered[t] = true; });
        s.reputation.residents = 4; s.reputation.merchant = 2; s.reputation.medical = 1;
        s.trust = 86;
        setRes(s, { food: 26, fuel: 3.6, meds: 3, parts: 4 });
        s.refuges.dt_market = { met: true, paidUntil: 0, helpDay: -1, newsDay: -1, freeLodge: 0 };
        s.refuges.res_school = { met: true, paidUntil: 0, helpDay: -1, newsDay: -1, freeLodge: 0 };
        s.refuges.res_village = { met: true, paidUntil: 0, helpDay: -1, newsDay: -1, freeLodge: 0 };
      },
      arrive: null
    },
    checkpoint: {
      label: '공항 검문소 앞에서 시작',
      sub: '20일째 10:00 · 검문만 지나면 대피 접수대 · 결말까지 빠르게',
      note: '시연용 지름길: 공항 검문소(20일째)에서 시작해요. 검문을 지나 접수대로 가면 결말이 나와요.',
      build(s) {
        base(s, at(20, 10), 'ap_market', 'checkpoint');
        visit(s, PATH_TO_DOWNTOWN.concat(['dt_mall', 'airport_road', 'ap_market']));
        join(s, 'lee_sua', 'outskirts_gas', 19);
        join(s, 'han_jungsu', 'bus_garage', 18);
        join(s, 'kim_narae', 'res_conv', 14);
        join(s, 'yoo_sangcheol', 'dt_market', 6);
        s.record.boarded.push({ id: 'oh_taeseok', where: 'outskirts_junkyard', minute: s.minute - 17 * D });
        s.record.letGo.push({ id: 'oh_taeseok', how: 'force', where: 'res_cross', minute: s.minute - 9 * D });
        LS.People.rec(s, 'oh_taeseok').status = 'dropped';
        doneRequest(s, 'narae_brother');
        doneRequest(s, 'yoo_visit');
        LS.Requests.accept(s, 'song_list', {});
        s.reputation.merchant = -3; s.reputation.residents = 2;
        s.trust = 72;
        setRes(s, { food: 22, fuel: 3.0, meds: 2, parts: 2 });
        s.arrivedFrom = 'ap_market';
      },
      arrive: 'ap_checkpoint'
    },
    lastday: {
      label: '마감 직전에서 시작 (실패 시연)',
      sub: '30일째 18:00 · 화물 터미널 · 연료 1·식량 4 · 검문에 낼 물자가 모자라다',
      note: '시연용 지름길: 마감 6시간 전이에요. 검문에 낼 물자가 모자라서, 접수 마감을 넘기는 결말을 볼 수 있어요.',
      build(s) {
        base(s, at(30, 18), 'ap_cargo', 'lastday');
        visit(s, PATH_TO_DOWNTOWN.concat(['dt_mall', 'airport_road', 'ap_cargo']));
        join(s, 'kim_narae', 'res_conv', 25);
        s.requests.offered.narae_brother = true;
        s.trust = 55;
        setRes(s, { food: 4, fuel: 1.0, meds: 0, parts: 0 });
        Object.values(s.places.ap_cargo.spots).forEach((sp) => { if (sp.remaining) Object.keys(sp.remaining).forEach((k) => { sp.remaining[k] = 0; }); sp.farmedOnce = true; });
      },
      arrive: null
    }
  };

  function titleButtons() {
    return '<div class="title-section">시연용 지름길 · 일반 진행과 따로, 기록과 결말에 "시연"으로 표시돼요</div>' +
      Object.keys(SCENARIOS).map((k) => `<button class="title-btn demo" data-t="demo:${k}">${SCENARIOS[k].label}<small>${SCENARIOS[k].sub}</small></button>`).join('');
  }

  function build(key) {
    const sc = SCENARIOS[key];
    if (!sc) return null;
    LS.Save.clear();
    const s = LS.State.create();
    sc.build(s);
    LS.State.addLog(s, `시연용 지름길: ${sc.label}`, true, 'system', '일반 진행이 아니라 시연을 위해 이 시점부터 시작했다');
    return { state: s, note: sc.note, arrive: sc.arrive };
  }

  return { titleButtons, build, SCENARIOS };
})();
