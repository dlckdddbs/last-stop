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
    traits: ['운전 기력 시간당 -4', '본인이 운전한 구간 이동 시간 -10%', '합류 조건: 하루 운전 8시간까지'],
    joinCondition: '하루 운전 8시간까지',
    condition: 'drive8',
    warnLine: '하루 여덟 시간이라고 했잖소. 눈이 감겨서 사고 나면 다 죽어요.',
    leaveLine: '약속을 두 번이나 어겼으니 다음에 서는 곳에서 내리겠소.'
  },
  // 정비원 (16장 인물 목록: 외곽 고물상). 운전 여부는 기획서에 없어 임시로 불가
  oh_taeseok: {
    name: '오태석',
    role: '정비원 · 외곽 고물상 주인',
    canDrive: false,
    expert: 'mechanic',
    traits: ['정비원: 수리하면 내구도 +5 더', '고물·부품에 밝다', '운전 불가 (임시)'],
    request: '주유소 빚 연료 1 대신 상환 · 5일 (부탁은 5단계)'
  },
  // ---------- 주거 지역 (5단계, 16장 인물 목록) ----------
  kim_narae: {
    name: '김나래',
    role: '배달 경험 · 상인 · 주거 편의점',
    canDrive: true,                // 임시값: 배달 일을 했으니 운전 가능
    expert: 'local',
    traits: ['지역 경험자: 경로 정찰 2시간 → 1시간', '골목길을 잘 안다', '합류 조건: 하루 두 끼 정상 배급'],
    joinCondition: '하루 두 끼 정상 배급',
    condition: 'twoMeals',
    warnLine: '두 끼는 제대로 먹자고 했잖아요. 배고프면 다리가 안 움직여요.',
    leaveLine: '약속이 자꾸 깨지네요. 다음에 서는 곳에서 내릴게요.',
    request: '동생 집 조사 · 2인 2시간 (부탁은 다음 업데이트)'
  },
  jung_minkyung: {
    name: '정민경',
    role: '하율 엄마 · 주거 아파트',
    canDrive: false,
    traits: ['아이와 함께 다닌다', '합류 조건: 가족을 떼어 놓지 않는다'],
    joinCondition: '가족을 분리하지 않는다',
    condition: 'family'
  },
  jung_hayul: {
    name: '정하율',
    role: '정민경의 딸 · 아홉 살',
    canDrive: false,
    child: true,                   // 아이는 일을 맡지 않는다 (잠·휴식만)
    traits: ['아이: 일을 맡지 않는다', '버스 창문에 그림을 그린다']
  },
  seo_dongjin: {
    name: '서동진',
    role: '약사 · 의료 · 주거 약국',
    canDrive: false,
    expert: 'pharmacist',
    traits: ['약사: 약국을 뒤지면 의약품 +1 (임시)', '억제제 재료를 안다 (부탁은 다음 업데이트)'],
    request: '억제제 재료 확보 · 5일 · 억제제 1 보상 (다음 업데이트)'
  },
  // 임시 인물 (2026-11-11, Claude 추가): 임시 동행과 검사(상처 판별)를 익히는 정직한 사람
  lee_junghoon: {
    name: '이정훈',
    role: '임시 동행 · 약을 구하러 나왔던 아버지 (임시 인물)',
    canDrive: false,
    traits: ['주거 지역 입구까지만 같이 간다', '주거 지역에 가족이 있다', '팔에 붕대를 감았다']
  },
  // 임시 인물 (2026-11-11, Claude 추가): 22장 '어디까지만 태워주세요'의 도로변 두 사람. 기획서에 이름이 없어 임시로 붙임
  go_mansik: {
    name: '고만식',
    role: '임시 동행 · 도로변에서 만난 형 (임시 인물)',
    canDrive: false,
    traits: ['다음 마을까지 태워 달라고 했다']
  },
  go_mansu: {
    name: '고만수',
    role: '임시 동행 · 도로변에서 만난 동생 (임시 인물)',
    canDrive: false,
    traits: ['형을 따라다닌다']
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
    condition: 'noAbandon',
    warnLine: '물렸다고 길에 버리는 거, 저는 못 봐요. 한 번만 더 그러면 저도 내릴 거예요.',
    leaveLine: '약속했잖아요. 다음에 서는 곳에서 내릴게요.',
    request: '환자 1명을 의료대피소로 이송 · 좌석 1 · 3일'
  }
};

// 대사창에 나오는 인물이 아닌 화자
LS.SPEAKERS = {
  narration: { name: '', portrait: null },
  radio: { name: '라디오', portrait: 'radio' }
};
