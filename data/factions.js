// 외부 집단·평판·대피소·통행료 바리케이드 (04장, 19장, 23장 ⑥, 참조 A). 5단계 2차.
window.LS = window.LS || {};

// 외부 4개 집단 (04장). 대표는 합류하지 않는다
LS.FACTIONS = {
  medical:   { name: '의료 네트워크',     leader: '고은영',     bases: '의료 대피소·약국·진료소', role: '약·억제제·치료·해독제' },
  merchant:  { name: '상인 무리',         leader: '마덕수',     bases: '교환 거점·점거 주유소',   role: '부품·연료·교환' },
  residents: { name: '주민 대피소 연합',  leader: '임혜진',     bases: '학교·자급 마을',          role: '식량·숙박·안전 인계' },
  military:  { name: '군 연락망',         leader: '하준기 중사', bases: '군 인근·검문소',          role: '도로·통행·검문·해독제' }
};

// 평판 구간 (19장). 위에서부터 min 이상이면 그 태도
LS.STANCES = [
  { min: 6,   key: 'trusted', label: '신뢰', effect: '만석이어도 들여보낸다 · 해독제 우선/선지급 · 무상 구조에도 평판 유지 · 엔딩 환대' },
  { min: 2,   key: 'friendly', label: '호의', effect: '무전 정보 무료 · 소속 인물이 먼저 합류를 제안' },
  { min: -1,  key: 'neutral', label: '보통', effect: '기본 대우' },
  { min: -5,  key: 'wary', label: '경계', effect: '만석이라며 숙박·인계 거절 · 소속 인물이 면담·합류를 주저' },
  { min: -10, key: 'hostile', label: '적대', effect: '출입·교환 거절 · 집단 바리케이드 통행 불가 · 경계 방송' }
];

// 리더 신뢰 구간 (18장): 명령 반응. 실제 거부·불복종은 6단계에서 연결
LS.TRUST_STAGES = [
  { min: 80, text: '실행 가능한 위험 임무도 거부 없이 받아들인다' },
  { min: 60, text: '대체로 따르지만, 위험한 일에는 장비·인원 조건을 붙인다' },
  { min: 40, text: '위험하거나 불공정한 배치에 항의하고 조건부로 협력한다' },
  { min: 20, text: '위험 임무를 거부하고 제멋대로 움직이기도 한다' },
  { min: 0,  text: '집단 불복종, 리더 교체까지 갈 수 있다' }
];

// 교환 가치 [임시]: 식량 1인분 = 1. 교환 대가는 평판 1점당 5% 할인/할증 (관리 시설에만, 19장)
LS.TRADE_VALUE = { food: 1, parts: 4, meds: 5, fuel: 6 };

// 대피소 (04장: 숙박·교환·치료·인계·정보. 수용과 대가는 평판에 따른다)
// lodgeFood: 숙박 1회 기본 대가(식량, 일행 전체) [임시] · trades: give 받는 것 / want 내는 것(기본량)
// handover: 맡길 수 있는 사람 (동의해야 한다) · host: 대피소에서 이야기하는 사람
LS.REFUGES = {
  res_school: {
    faction: 'residents', name: '초등학교 대피소', host: 'song_jiho', spot: 'rs_gym',
    desc: '체육관에 아이들과 주민이 모여 있다. 아이와 환자를 옮길 차량이 없어 버티는 중이다.',
    lodgeFood: 6,
    trades: [
      { id: 'sch_meds', give: { meds: 1 }, want: { food: 6 }, text: '보건실 약을 나눠 준다 (식량이 모자란다)' },
      { id: 'sch_parts', give: { parts: 1 }, want: { food: 5 }, text: '창고의 공구·부품' }
    ],
    donate: { food: 8 },                 // 작은 도움: 식량 기부 → 평판 +1 (참조 A '작은 도움 +1')
    handover: ['child', 'family', 'sick'],
    welcome: [
      { speaker: 'song_jiho', text: '여기는 아이들이 있는 곳이에요. 좀비만 달고 오지 않았다면 들어오세요.' },
      { speaker: 'song_jiho', text: '하룻밤 묵을 자리는 있어요. 대신 식량을 조금 나눠 주셨으면 해요. 다들 배가 고프거든요.' }
    ]
  },
  res_village: {
    faction: 'residents', name: '자급 마을', host: 'lim_hyejin', spot: 'rv_hall',
    desc: '밭을 일구며 스스로 지키는 마을. 떠나지 않고 이곳을 방어하기로 했다.',
    lodgeFood: 6,
    trades: [
      { id: 'vil_food_parts', give: { food: 10 }, want: { parts: 2 }, fresh: 0.7, text: '밭에서 거둔 채소와 곡식 (울타리 고칠 부품을 원한다)' },
      { id: 'vil_food_meds', give: { food: 10 }, want: { meds: 2 }, fresh: 0.7, text: '저장 식량 (약이 귀하다)' },
      { id: 'vil_food_fuel', give: { food: 6 }, want: { fuel: 1 }, fresh: 0.5, text: '발전기에 쓸 연료와 바꾼다' }
    ],
    donate: { parts: 1 },
    handover: ['elder', 'family', 'sick'],
    welcome: [
      { speaker: 'lim_hyejin', text: '주민 대피소 연합의 임혜진입니다. 우리는 떠나지 않고 여기를 지키기로 했어요.' },
      { speaker: 'lim_hyejin', text: '밭에서 나는 건 바꿔 드릴 수 있어요. 울타리 고칠 부품이 늘 모자라요.' }
    ]
  }
};

// 통행료 바리케이드 (23장 ⑥): 교차로·다리. 주인은 게임마다 셋 중 하나 [임시: 같은 확률]
// clues: 정찰(2인 1시간)로 1~2개, 배달 경험자(김나래)가 있으면 1개 더
LS.BARRICADES = {
  res_cross: {
    name: '큰 교차로 바리케이드',
    owners: ['keeper', 'merchant', 'robber']
  }
};

LS.BARRICADE_OWNERS = {
  keeper: {
    label: '거점 지킴이', faction: 'residents',
    toll: { food: 4 },
    clues: ['바리케이드 기둥에 주민 대피소 연합 표식이 그려져 있다', '너머에 빨래가 널려 있고 화분에 파가 자란다 (사람이 사는 흔적)', '바리케이드 뒤에서 아이 목소리가 들린다'],
    say: '여긴 우리 동네 길이요. 지나가려면 먹을 걸 조금 놓고 가쇼.'
  },
  merchant: {
    label: '상인 검문', faction: 'merchant',
    toll: { food: 6 },
    clues: ['고깔과 줄로 차선을 나눠 놨다. 정돈된 검문이다', '칠판에 물자별 통행료 목록이 적혀 있다'],
    say: '통행료 받습니다. 규칙대로요. 목록 보시고 내세요.'
  },
  robber: {
    label: '강도', faction: null,
    toll: { food: 10 },
    clues: ['보이는 사람은 셋인데 바닥 발자국은 훨씬 많다', '길가에 털린 짐과 불탄 차가 널려 있다', '요구하는 양이 다른 곳보다 지나치게 많다'],
    say: '식량 열 인분. 아니면 못 지나가. 흥정은 없어.'
  }
};

LS.FACTION_RULES = {
  detourMin: 90,        // 바리케이드 우회: 다음 구간 +1시간 30분 [임시]
  breakDurability: 8,   // 돌파: 내구도 -8 (23장)
  breakRep: -3,         // 돌파: 거점·상인 평판 -3
  breakHordeMin: 120,   // 돌파 소음으로 근처 무리가 확정 접근 (2시간 뒤 도착) [임시]
  helpMin: 120,         // 일손 돕기 (치료·정비 2~3시간 대신 제공, 23장) [임시: 2시간]
  robberTalkMin: 30,    // 강도와 협상: 30분 [임시]
  robberTalkChance: 0.5,
  newsFood: 2,          // 보통 평판에서 소식 듣기 대가 [임시] (호의 이상 무료, 19장)
  sickHp: 40            // 이 아래면 대피소에 남아 쉬겠다고 동의한다 [임시]
};

// ---------- 도심 앞부분 (5단계 4차) ----------
Object.assign(LS.REFUGES, {
  dt_clinic: {
    faction: 'medical', name: '도심 진료소', host: 'go_eunyoung', spot: 'dc_clinic',
    desc: '의료 네트워크가 지키는 진료소. 다친 사람과 환자를 받고, 약과 물자를 바꿔 준다. 치료는 6단계에서 연결.',
    lodgeFood: 8,
    trades: [
      { id: 'cl_meds_food', give: { meds: 2 }, want: { food: 8 }, text: '진료소 약품 (환자 식량이 모자란다)' },
      { id: 'cl_meds_parts', give: { meds: 1 }, want: { parts: 2 }, text: '발전기 부품과 바꾼다' }
    ],
    donate: { food: 6 },
    handover: ['sick', 'child', 'elder'],
    welcome: [
      { speaker: 'go_eunyoung', text: '의료 네트워크의 고은영입니다. 환자가 있으면 데려오세요. 물린 사람은… 사정을 듣고 정해요.' },
      { speaker: 'go_eunyoung', text: '약은 넉넉하지 않지만 바꿀 수는 있어요. 해독제는 아직 구하는 중이에요.' }
    ]
  },
  dt_market: {
    faction: 'merchant', name: '도심 교환 거점', host: 'ma_deoksu', spot: 'dm_base',
    desc: '주차 빌딩을 통째로 막아 만든 상인 무리의 거점. 연료와 부품이 모인다.',
    lodgeFood: 6,
    trades: [
      { id: 'mk_fuel_food', give: { fuel: 2 }, want: { food: 10 }, text: '드럼통 연료' },
      { id: 'mk_parts_food', give: { parts: 2 }, want: { food: 8 }, text: '정비용 부품 꾸러미' },
      { id: 'mk_food_meds', give: { food: 12 }, want: { meds: 2 }, fresh: 0.2, text: '통조림 상자 (약이 비싸게 팔린다)' },
      { id: 'mk_fuel_parts', give: { fuel: 1 }, want: { parts: 3 }, text: '부품을 받고 연료를 내준다' }
    ],
    donate: { food: 6 },
    handover: [],
    welcome: [
      { speaker: 'ma_deoksu', text: '상인 무리의 마덕수요. 여기선 뭐든 바꿀 수 있소. 공짜만 빼고.' },
      { speaker: 'ma_deoksu', text: '하룻밤 묵고 싶으면 값을 치르쇼. 사람 맡아 주는 일은 안 하오.' }
    ]
  }
});
