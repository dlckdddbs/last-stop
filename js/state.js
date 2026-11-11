// 게임 상태. 저장·불러오기(8단계)도 이 객체를 기준으로 한다.
window.LS = window.LS || {};

LS.State = (function () {
  function member(id) {
    const b = LS.CONFIG.member;
    return {
      id, hp: b.hp, energy: b.energy, mental: b.mental, deficit: b.deficit,
      status: '정상',
      task: null,                 // 진행 중인 작업 id
      poisonUntil: 0,             // 식중독이 끝나는 시각(분)
      sleepStreak: 0,             // 누워서 이어 잔 시간(분)
      lastMentalSleep: -99999,    // 수면 정신력 보너스를 받은 시각
      lastHpSleep: -99999,        // 수면 HP 보너스를 받은 시각
      lastTalk: -99999,           // 회복 대화에 참여한 시각
      infectedAt: null,           // 물린 시각(분). 감염 시계 (12장)
      isolated: false             // 66시간 결정에서 격리 좌석을 골랐는가
    };
  }

  // 설비 칸: 처음부터 환자용 침상 1개가 한 칸을 차지한다. power: 엔진이 켜져 있어야 쓰는 설비인가
  function startFacilities(s) {
    const f = new Array(s.facilitySlots).fill(null);
    for (let i = 0; i < s.bedSlots; i++) f[i] = { id: 'beds', name: s.beds === 1 ? '환자용 침상' : `침상 ${s.beds}개`, beds: s.beds, power: false };
    return f;
  }

  // 새 동료 합류 (좌석이 있어야 한다)
  function addMember(state, id, roleLabel) {
    if (state.crew.some((m) => m.id === id)) return false;
    if (state.crew.length >= state.bus.seats) { addLog(state, `${LS.Rules.josa(LS.CHARACTERS[id].name, '을를')} 태울 좌석이 없다`, true, 'event'); return false; }
    const m = member(id);
    m.joinedAt = state.minute;         // 합류 시각 (합류 조건 5일 준수·부탁 제안에 쓴다)
    m.keptSince = state.minute;        // 합류 조건을 지키기 시작한 시각 (위반하면 다시 센다)
    state.crew.push(m);
    // 유상철: 교환품이 식량 보관 칸을 쓴다 (17장 합류 조건)
    const cap = LS.CHARACTERS[id].foodCapUse || 0;
    if (cap) state.resources.foodCap -= cap;
    addLog(state, `${LS.CHARACTERS[id].name} 합류`, true, 'event', (roleLabel || LS.CHARACTERS[id].role) + (cap ? ` · 식량 보관 한도 -${cap}` : ''));
    return true;
  }

  // 버스에 있는 침상 수
  function beds(state) { return state.bus.facilities.reduce((n, f) => n + (f && f.beds ? f.beds : 0), 0); }

  function create() {
    const s = LS.CONFIG.start;
    const state = {
      minute: s.hour * 60,             // 1일째 00시부터 경과한 분 (06시에 시작)
      screen: 'outside',               // bus | outside | map | travel
      locationId: s.locationId,        // 장소 id, 도로 위에 멈추면 'roadside'
      crew: s.crew.map(member),        // 배열 순서 = 좌석 순서
      dead: [],                        // 사망한 동료 기록
      resources: {
        food: s.food,                  // 보존식 (인분)
        fresh: [],                     // 신선식품 묶음 [{ amount, freshness }]
        foodCap: s.foodCap,
        fuel: s.fuel, fuelCap: s.fuelCap,
        meds: s.meds, parts: s.parts,
        suppressant: 0, antidote: 0
      },
      bus: {
        durability: s.durability, maxDurability: s.maxDurability,
        seats: s.seats, engineOn: false,
        facilities: startFacilities(s)
      },
      trust: s.trust,
      reputation: { medical: 0, merchant: 0, residents: 0, military: 0 },
      mealPolicy: null,                // 첫 정규 식사에서 정한다: normal | half | skip
      tasks: [],                       // 진행 중인 작업
      travel: null,                    // 이동 중이면 경로·진척
      roadside: null,                  // 도로 위에 멈춘 위치
      places: {},                      // 장소별 보급·정찰 상태 (world.js가 생성)
      routes: {},                      // 경로별 확인 여부
      flags: {},                       // 사건 진행 표시 (예: airportKnown)
      people: {},                      // 만난 사람별 기록: 만남·면담·검사 결과·결정 (people.js)
      // 정차: 30분 이상 멈추면 좀비 등장 판정 (14장). 이동 중이면 null
      stop: { since: s.hour * 60, nextRoll: s.hour * 60 + LS.CONFIG.zombie.stopMin },
      // 좀비: 다가오는 무리, 포위, 밤 보정 기록 등 (zombie.js)
      zombie: {
        horde: null, siege: null, pursuit: null,
        // 마지막 밤 등장 '날'. 1~3일째 밤은 사건이 없으므로(03장), 3일째에 등장한 것으로 쳐서
        // 4일째 밤이 2일차(기본 확률)가 되게 한다 (임시: 4일째 밤에 바로 확정 무리가 오지 않게)
        lastNightIdx: LS.Clock.rolloverIndex(2 * 1440 + 12 * 60),
        hidOnce: false,                // 30분 결정에서 숨어 넘겼다 → 다음 30분 결정은 확정 발각
        leaveCost: 0,                  // 밤 30분 전 떠나기 내구도 대가 (출발할 때 적용)
        breakout: false,               // 포위 돌파를 골랐다 (지도에서 출발하면 적용)
        history: []                    // 개발 확인용 (화면에는 안 보임)
      },
      fired: {},                       // 이미 일어난 예정 사건
      log: [],
      logFilter: 'all',                // all | important
      guides: {},                      // 이미 본 안내창
      hints: { assigned: 0 },          // 처음 몇 번만 보여줄 안내
      running: false,
      speedIndex: 0,
      dialogOpen: false,
      gameOver: false
    };
    LS.World.generate(state);
    LS.Factions.setup(state);          // 평판 이유·엔딩 기록·대피소·바리케이드 (5단계)
    LS.Requests.setup(state);          // 부탁·약속·작은 순간 (5단계 3차)
    return state;
  }

  function mentalStage(v) {
    for (const st of LS.CONFIG.mentalStages) if (v >= st.min) return st.label;
    return '흔들림';
  }

  // kind: event 사건 | task 작업 | travel 이동 | meal 식사 | body 몸 상태 | time 시간 | system 안내
  // detail: 아래 작은 글씨로 보여줄 세부 내용
  function addLog(state, text, important, kind, detail) {
    const entry = { minute: state.minute, text, important: !!important, kind: kind || 'system', detail: detail || '' };
    state.log.push(entry);
    if (state.log.length > 400) state.log.shift();
    return entry;   // 사건 기록은 나중에 선택·결과를 세부 줄에 덧붙인다
  }

  function location(state) { return LS.World.location(state); }

  function place(state, id) { return state.places[id || state.locationId]; }

  function foodTotal(state) {
    const r = state.resources;
    return r.food + r.fresh.reduce((a, b) => a + b.amount, 0);
  }

  // how: 'dead' 숨짐 | 'turned' 감염 전환 | 'left' 하차 (하차는 사망 충격 없음)
  function killMember(state, id, how) {
    how = how || 'dead';
    const idx = state.crew.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const m = state.crew[idx];
    // 진행 중인 작업에서 빼낸다
    state.tasks.forEach((t) => { t.members = t.members.filter((x) => x !== id); });
    state.tasks = state.tasks.filter((t) => t.members.length);
    state.crew.splice(idx, 1);
    if (LS.CHARACTERS[id].foodCapUse) state.resources.foodCap += LS.CHARACTERS[id].foodCapUse;   // 교환품 칸 반환
    state.dead.push({ id, minute: state.minute, how });
    const nm = LS.CHARACTERS[id].name;
    if (how === 'dead') addLog(state, `${LS.Rules.josa(nm, '이가')} 숨졌다.`, true, 'body');
    if (how !== 'left') state.crew.forEach((o) => { o.mental = Math.max(0, o.mental + LS.CONFIG.shock.death); });
    if (id === 'yoon_jaeha' && how !== 'left') state.protagonistDead = true;
    return m;
  }

  return { create, mentalStage, addLog, location, place, foodTotal, killMember, beds, member, addMember };
})();
