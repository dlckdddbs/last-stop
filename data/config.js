// 게임 전체 수치 설정. 밸런스 조정은 이 파일에서 한다.
// 기준 문서: 통합 게임 기획서 v3.3
window.LS = window.LS || {};

LS.CONFIG = {
  // 시간 (02장)
  totalHours: 720,          // 1일째 00시 ~ 30일째 24시
  stepMinutes: 30,          // 화면 표시와 진행 단위
  dayStartHour: 6,          // 06:00부터 낮
  nightStartHour: 20,       // 20:00부터 밤 (기획서: 밤 20~06시)
  nightRolloverHour: 0,     // 밤 보정의 '하루'가 바뀌는 시각: 자정 (2026-11-10 결정)
  mealHours: [8, 20],       // 정규 식사 시각 (10장)

  // 시간 진행 속도 (배속은 시제품에서 조정)
  speeds: [
    { label: '1배', msPerStep: 700 },
    { label: '2배', msPerStep: 350 },
    { label: '4배', msPerStep: 150 }
  ],
  nextEventMsPerStep: 40,   // '다음 상황까지' 진행 속도

  // 시작 상태 (03장)
  start: {
    food: 15,               // 보존식 (인분)
    foodCap: 40,
    fuel: 3,                // 단위 (1단위 = 운전 10시간)
    fuelCap: 6,
    meds: 4,
    parts: 6,
    durability: 70,
    maxDurability: 100,
    seats: 6,               // 운전석 포함 안전 좌석
    maxSeats: 8,            // 좌석 복구 시
    facilitySlots: 4,
    trust: 90,
    crew: ['yoon_jaeha', 'park_seoyun'],
    locationId: 'start_firestation',
    hour: 6,                // 1일째 06시(낮)에 시작한다 (2026-11-10 결정: 좀비는 밤에 잘 못 봐서 낮에 움직이는 게 기본)
    beds: 1,                // 처음부터 환자용 침상 1개 (2026-11-10 결정: 버스가 좁아 6개는 무리)
    bedSlots: 1             // 침상이 차지하는 설비 칸 (임시값)
  },

  // 개인 상태 기본값 (08~11장)
  member: { hp: 100, energy: 90, mental: 80, deficit: 0 },   // 시작 기력 90 (2026-11-10 결정)

  // 기력 (08장): 시간당 변화
  energy: {
    drive: -5, driveExpert: -4,   // 일반 운전 / 전문 기사
    heavy: -7,                    // 파밍·고강도 정비·장애물 제거
    scout: -5,                    // 정찰 (내부 확인 포함)
    light: -3,                    // 간병·가벼운 작업·경계·면담·검사
    seatRest: { rate: 1, cap: 80 },        // 좌석 휴식: 맡은 일이 없으면 자동 (2026-11-10 결정: 최대 80)
    bedMoving: { rate: 2, cap: 100 },      // 이동 중 버스 침상 (2026-11-10 결정: 최대 100)
    sleepBed: { rate: 3, cap: 100 },       // 정차 중 버스 침상에서 수면 (임시값)
    sleepBuilding: { rate: 5, cap: 100 },  // 내부를 확인한 건물에서 수면 (2026-11-10 결정)
    sleepBag: { rate: 3, cap: 100 },       // 버스 옆 침낭 수면 (2026-11-10 결정)
    slowBelow: 60, slowFactor: 1.2,   // 60 미만이면 같은 작업에 시간 20% 증가
    heavyMin: 30                      // 30 이하면 운전·정찰·파밍·정비·장애물 제거 불가
  },

  // 실수 판정 (07장)
  mistake: {
    base: 0.10, shaken: 0.15, broken: 0.30, dangerous: 0.10, max: 0.80,
    severity: { minor: 0.70, injury: 0.25, major: 0.05 }
  },
  shock: { minorInjury: -3, majorInjury: -8, majorWitness: -3, death: -15 },
  work: { meaningfulBonus: 2, meaningfulDailyMax: 4 },

  // 연료·운전 (15장, 03장)
  fuel: { drivePerHour: 0.1, idlePerHour: 0.02 },
  driver: { minEnergy: 30, minMental: 30, expertTimeFactor: 0.9 },
  lowHpWorkLimit: 15,             // 임시값(기획서 미정): HP 1~15는 치료·휴식만

  // 도로 (05장, 02장)
  road: {
    unknownChance: 0.40, knownChance: 0.20,
    investigateMin: 60, removeMin: 120, removeMinFirefighter: 90,
    detourHours: [2, 4]
  },
  roadsideCarChance: 0.5,         // 임시값: 도로 위에 멈췄을 때 근처에 차량이 있을 확률

  // 보급 상태 (06장)
  supply: {
    weights: { looted: 0.20, partial: 0.55, intact: 0.25 },
    looted: [0, 0.2], intact: [1.25, 1.5]
  },
  hiddenThreatChance: 0.15,       // 미확인 건물의 숨은 위협 (08장)
  // 잠자리 건물 (2026-11-10 결정, 수치는 임시값): 장소마다 있을 확률, 버스에서 걸어가는 시간,
  // 가는 길+안 확인+바리케이드 설치 합계 (2026-11-11: 확인에 시간이 걸리는 건 혹시 모를 좀비에 대비해 바리케이드를 쳐서)
  shelter: { chance: 0.6, walkMin: [15, 20], checkTotalMin: 60 },
  // ---------- 좀비 (14~15장) ----------
  zombie: {
    // 지역별 등장 확률과 규모 (14장 ①)
    regions: {
      outskirts:   { chance: 0.20, sizes: ['small'] },
      residential: { chance: 0.25, sizes: ['small', 'medium'] },
      military:    { chance: 0.30, sizes: ['medium'] },
      downtown:    { chance: 0.35, sizes: ['medium', 'large'] },
      airport:     { chance: 0.40, lateChance: 0.45, lateDay: 21, sizes: ['medium', 'large'] }
    },
    stopMin: 30,              // 30분 이상 멈추면 정차 (운전자 교대 10분은 제외)
    approachMin: 300,         // 임시값: 등장한 무리가 버스까지 오는 시간 (표의 '약 5시간')
    alarmMin: 120,            // 경보 함정은 무리가 2시간 거리에 오면 울린다 (06장)
    seeMin: 30,               // 규모는 30분 거리에서 보인다 (04장)
    nightApproach: 0.45,      // 미발각 밤 무리 중 30분 거리까지 오는 비율
    nightBonusDay3: 0.25,     // 밤 보정: 1일차 0% · 2일차 기본 · 3일차 기본 +25%p · 4일차 확정
    hideDetect: 0.70,         // 밤 숨기 발각
    baitDetect: 0.55,         // 미끼 두고 숨기 발각
    baitFood: 3, baitParts: 1,
    nightLeaveDurability: 3,  // 밤 30분 전 떠나기
    loopMin: 180,             // 떠나고 돌아오기: 무리는 3시간 뒤 흩어진다 (그동안 버스를 몰고 돈다)
    sizes: {
      small:  { label: '소규모', count: [3, 8],   siegeH: 1, dmg: 3, bite: 0.05 },
      medium: { label: '중규모', count: [9, 30],  siegeH: 3, dmg: 5, bite: 0.15 },
      large:  { label: '대규모', count: [31, 60], siegeH: 6, dmg: 8, bite: 0.30 }
    },
    siegeMental: -10,         // 중·대규모 포위를 겪은 사람
    breakout: [8, 15],        // 돌파 내구도 피해
    fight: { minCrew: 2, minutes: 30, bite: 0.05 },   // 소규모 전투 (무기는 버스 무기 보관함 것을 쓴다)
    // 잠자리 건물 안의 좀비 처리 (2026-11-11 결정: 인원이 많을수록 안전, 수치는 임시값). 1인당 부상·물림 확률
    clearRisk: [
      { min: 3, injury: 0.05, bite: 0.01 },   // 3명 이상: 웬만해선 안 다친다
      { min: 2, injury: 0.25, bite: 0.05 },   // 2명: 어느 정도 위험
      { min: 1, injury: 0.60, bite: 0.10 }    // 1명: 다칠 확률이 높다
    ],
    injuryChance: 0.30, injuryHp: -8                  // 임시값: '각 부상 판정' (기획서에 수치 없음)
  },
  // 감염 (12장): 시간 단위
  infection: { feverH: 24, worseH: 48, decideH: 66, turnH: 72 },
  // 기본 수리 (13장): 부품 2개·3시간·내구도 +15
  repair: { parts: 2, minutes: 180, amount: 15 },

  // 식사·신선도 (10장)
  meal: {
    rations: {
      normal: { label: '정상', amount: 1, mental: 0, deficit: -1 },
      half: { label: '반 배급', amount: 0.5, mental: -2, deficit: 1 },
      skip: { label: '거르기', amount: 0, mental: -4, deficit: 2 }
    },
    deficitHp: [{ min: 5, hp: -6 }, { min: 3, hp: -3 }, { min: 0, hp: 0 }],
    recovery: [{ min: 5, rate: 0.4 }, { min: 3, rate: 0.6 }, { min: 1, rate: 0.8 }, { min: 0, rate: 1.0 }]
  },
  food: {
    freshDecayHours: 48, freshDecayHoursFridge: 96,
    poison: [{ min: 70, chance: 0 }, { min: 50, chance: 0.15 }, { min: 25, chance: 0.30 }, { min: 0, chance: 0.70 }],
    poisonHp: -10, poisonHours: 12
  },
  medic: { poisonHoursFactor: 0.5 },   // 임시값: 간호사(이수아)가 일행에 있으면 식중독 기간 절반. 치료 시스템이 들어오기 전까지

  // 수면·대화 회복 (08~09장)
  sleep: { mentalHours: 6, mentalBonus: 5, hpHours: 8, hpBonus: 5, cooldownHours: 24 },
  talk: { minutes: 60, target: 5, partner: 2, cooldownHours: 24 },

  // 정신력 표시 단계 (09장)
  mentalStages: [
    { min: 60, label: '안정' },
    { min: 30, label: '동요' },
    { min: 0,  label: '흔들림' }
  ]
};
