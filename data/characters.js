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
  }
};

// 대사창에 나오는 인물이 아닌 화자
LS.SPEAKERS = {
  narration: { name: '', portrait: null },
  radio: { name: '라디오', portrait: 'radio' }
};
