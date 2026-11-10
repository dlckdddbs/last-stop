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
    locationId: 'start_firestation'
  },

  // 개인 상태 기본값 (08~11장)
  member: { hp: 100, energy: 80, mental: 80, deficit: 0 },

  // 정신력 표시 단계 (09장)
  mentalStages: [
    { min: 60, label: '안정' },
    { min: 30, label: '동요' },
    { min: 0,  label: '흔들림' }
  ]
};
