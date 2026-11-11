// 장소(건물) 종류별 파밍 기준 (06장). 보상은 2명 팀 전체 몫, '일부 남음' 상태 기준.
window.LS = window.LS || {};

LS.SPOT_TYPES = {
  house: {
    name: '주택', hours: 2, crew: 2,
    loot: { food: [4, 6], parts: [0, 1] },
    freshRatio: 0.3           // 임시값: 획득 식량 중 신선식품 비율 (기획서에 없음)
  },
  convenience: {
    name: '편의점', hours: 3, crew: 2,
    loot: { food: [8, 12] },
    freshRatio: 0.25          // 임시값
  },
  mart: {
    name: '마트', hours: 4, crew: 2,
    loot: { food: [16, 24] },
    freshRatio: 0.5           // 임시값
  },
  pharmacy: {
    name: '약국', hours: 3, crew: 2,
    loot: { meds: [1, 3] },
    suppressantChance: 0.10   // 억제제 10% (초기값)
  },
  junkyard: {
    name: '고물상', hours: 4, crew: 2,
    loot: { parts: [4, 6] }
  },
  roadside_car: {
    name: '도로변 차량', hours: 2, crew: 2,
    loot: { fuel: [0.8, 1.2], parts: [0, 1] }
  },
  gas_station: {
    name: '주유소', hours: 3, crew: 2,
    loot: { fuel: [2.5, 4] }
  },
  // 주거 지역 (5단계, 05장 장소 유형: 학교·아파트). 수치는 임시값
  school: {
    name: '학교', hours: 3, crew: 2,
    loot: { food: [6, 10], meds: [0, 1] },
    freshRatio: 0.2
  },
  apartment: {
    name: '아파트', hours: 4, crew: 2,
    loot: { food: [8, 14], parts: [0, 2] },
    freshRatio: 0.3
  },
  // 잠자리 건물 (2026-11-10): 파밍 건물과 따로, 장소마다 있을 수도 없을 수도 있다. 버스에서 걸어서 15~20분
  shelter: {
    name: '잠자리 건물', canRest: true
  }
};

LS.LOOT_NAMES = {
  food: { name: '식량', unit: '인분' },
  meds: { name: '의약품', unit: '회분' },
  parts: { name: '부품', unit: '개' },
  fuel: { name: '연료', unit: '단위' },
  suppressant: { name: '억제제', unit: '개' }
};
