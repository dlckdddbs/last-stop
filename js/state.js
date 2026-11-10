// 게임 상태. 저장·불러오기(8단계)도 이 객체를 기준으로 한다.
window.LS = window.LS || {};

LS.State = (function () {
  function member(id) {
    const b = LS.CONFIG.member;
    return { id, hp: b.hp, energy: b.energy, mental: b.mental, deficit: b.deficit, status: '정상', task: null };
  }

  function create() {
    const s = LS.CONFIG.start;
    return {
      minute: 0,                       // 1일째 00시부터 경과한 분
      screen: 'outside',               // bus | outside | map | travel
      locationId: s.locationId,
      crew: s.crew.map(member),        // 배열 순서 = 좌석 순서 (0번이 운전석)
      resources: {
        food: s.food, foodCap: s.foodCap, fresh: [],
        fuel: s.fuel, fuelCap: s.fuelCap,
        meds: s.meds, parts: s.parts,
        suppressant: 0, antidote: 0
      },
      bus: {
        durability: s.durability, maxDurability: s.maxDurability,
        seats: s.seats, engineOn: false,
        facilities: new Array(s.facilitySlots).fill(null)
      },
      trust: s.trust,
      reputation: { medical: 0, merchant: 0, residents: 0, military: 0 },
      flags: {},                       // 사건 진행 표시 (예: airportKnown)
      fired: {},                       // 이미 일어난 예정 사건
      log: [],
      running: false,
      speedIndex: 0,
      dialogOpen: false,
      selectedCrew: null,
      gameOver: false
    };
  }

  function mentalStage(v) {
    for (const st of LS.CONFIG.mentalStages) if (v >= st.min) return st.label;
    return '흔들림';
  }

  function addLog(state, text, important) {
    state.log.push({ minute: state.minute, text, important: !!important });
    if (state.log.length > 300) state.log.shift();
  }

  function location(state) { return LS.LOCATIONS[state.locationId]; }

  return { create, mentalStage, addLog, location };
})();
