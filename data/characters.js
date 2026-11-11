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

// 대피소에서 만나는 사람 (합류하지 않는다). 5단계 2차
Object.assign(LS.CHARACTERS, {
  song_jiho: {
    name: '송지호',
    role: '교사 · 주민 · 초등학교 대피소',
    host: true,
    canDrive: false,
    traits: ['학교에 남아 아이들을 돌본다 (합류하지 않음)', '아이 명단을 공항에 전해 줄 사람을 찾는다 (부탁은 다음 업데이트)']
  },
  lim_hyejin: {
    name: '임혜진',
    role: '주민 대피소 연합 대표 · 자급 마을',
    host: true,
    canDrive: false,
    traits: ['자급 마을을 지킨다 (합류하지 않음)', '연합 무전망으로 소식을 주고받는다']
  }
});

// 권순자 · 보행 불편 노인 · 주민 · 외곽 주택 · 영구 합류 아님 (16장). 5단계 3차
LS.CHARACTERS.kwon_sunja = {
  name: '권순자',
  role: '보행 불편 노인 · 주민 · 외곽 주택',
  canDrive: false,
  elder: true,
  traits: ['다리가 불편해 일을 맡지 않는다', '자급 마을까지만 간다 (이송 부탁 2일)']
};

// ---------- 도심 앞부분 (5단계 4차, 16장) ----------
Object.assign(LS.CHARACTERS, {
  bae_jinhyuk: {
    name: '배진혁',
    role: '일반 성인 · 무소속 · 도심 정류장',
    canDrive: true,                // [임시] 기획서에 운전 여부가 없음
    hiddenBite: true,              // 팔을 숨김·미열. 합류 24시간 뒤 발열 (17장)
    traits: ['먼저 태워 달라고 청했다', '팔을 잘 보여 주지 않는다', '운전 가능 (임시)']
  },
  yoo_sangcheol: {
    name: '유상철',
    role: '상인 · 상인 무리 · 도심 교환 거점',
    canDrive: true,                // [임시]
    traits: ['교환품을 싣고 다닌다 (식량 보관 -10)', '합류 조건: 교환품이 식량 보관 10칸을 쓴다', '운전 가능 (임시)'],
    joinCondition: '교환품이 식량 보관 10칸을 쓴다',
    condition: 'tradeGoods',
    foodCapUse: 10
  },
  // 임시 인물 (Claude 추가): 이수아의 부탁 '환자 1명 의료대피소 이송'의 환자. 기획서에 이름이 없음
  nam_gyuhyun: {
    name: '남규현',
    role: '다친 주민 · 임시 동행 (임시 인물)',
    canDrive: false,
    traits: ['다리를 다쳐 걷기 힘들다', '도심 진료소까지만 간다']
  },
  go_eunyoung: { name: '고은영', role: '의료 네트워크 대표 · 도심 진료소', host: true, canDrive: false, traits: ['합류하지 않는다'] },
  ma_deoksu: { name: '마덕수', role: '상인 무리 대표 · 도심 교환 거점', host: true, canDrive: false, traits: ['합류하지 않는다'] }
});

// 소속 집단 (16장 직책·소속). 없으면 무소속
const FACTION_OF = {
  lee_sua: 'medical', seo_dongjin: 'medical', go_eunyoung: 'medical',
  oh_taeseok: 'merchant', kim_narae: 'merchant', yoo_sangcheol: 'merchant', ma_deoksu: 'merchant',
  jung_minkyung: 'residents', jung_hayul: 'residents', song_jiho: 'residents', lim_hyejin: 'residents', kwon_sunja: 'residents'
};
Object.keys(FACTION_OF).forEach((id) => { LS.CHARACTERS[id].faction = FACTION_OF[id]; });

// 대피소에 맡길 수 있는 사람의 종류 (REFUGES.handover와 맞춘다)
LS.CHARACTERS.jung_minkyung.family = 'jung';
LS.CHARACTERS.jung_hayul.family = 'jung';

// 대사창에 나오는 인물이 아닌 화자
LS.SPEAKERS = {
  narration: { name: '', portrait: null },
  radio: { name: '라디오', portrait: 'radio' },
  barricade: { name: '바리케이드의 사람', portrait: null }
};
