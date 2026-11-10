// 인물 데이터 (16~17장). 이름은 기획서 기준 가안.
window.LS = window.LS || {};

LS.CHARACTERS = {
  yoon_jaeha: {
    name: '윤재하',
    role: '주인공 · 전직 소방관',
    canDrive: true,
    traits: ['일반 운전', '응급처치', '장애물 제거 2시간 → 1시간 30분', '상처·물림 판별에 유리']
  },
  park_seoyun: {
    name: '박서윤',
    role: '전직 아파트 관리소 직원',
    canDrive: false,
    traits: ['건물 구조·수색에 익숙', '기본 수리', '운전 불가']
  },
  han_jungsu: {
    name: '한정수',
    role: '전직 버스 기사',
    canDrive: true,
    expert: 'driver',
    traits: ['운전 기력 시간당 -4', '본인이 운전한 구간 이동 시간 -10%'],
    joinCondition: '하루 운전 8시간까지'
  },
  // 기획서 v3.3의 간호사 (첫 만남은 원래 도심 진료소). 2026-11-11: 첫 동료 분기에서 외곽 주유소에서 만나도록 바꿈
  lee_sua: {
    name: '이수아',
    role: '간호사 · 도심 진료소 출신',
    canDrive: true,              // 임시값: 기획서에 운전 여부가 없음
    expert: 'medic',
    traits: [
      '간호사 치료: 의약품 1회분·2시간에 HP +20 (일반 +15) · 치료는 이후 단계',
      '의무실이 있으면 안정화 환자를 이동 중에도 치료',
      '일행의 식중독이 빨리 낫는다 (12시간 → 6시간, 치료가 들어오기 전까지 쓰는 임시 능력)',
      '일반 운전 (임시)'
    ],
    joinCondition: '감염자를 버리지 않는다',
    request: '환자 1명을 의료대피소로 이송 · 좌석 1 · 3일'
  }
};

// 대사창에 나오는 인물이 아닌 화자
LS.SPEAKERS = {
  narration: { name: '', portrait: null },
  radio: { name: '라디오', portrait: 'radio' }
};
