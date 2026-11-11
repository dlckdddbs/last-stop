// 지역·장소·경로 데이터 (05장). 2단계는 도시 외곽만 연다.
window.LS = window.LS || {};

// 전체 지역 (지도 오른쪽 위 작은 전체도에 표시)
LS.REGIONS = {
  outskirts:   { name: '도시 외곽' },
  residential: { name: '주거 지역' },
  downtown:    { name: '도심' },
  military:    { name: '군부대 주변' },
  airport:     { name: '공항 지역' }
};

// 장소. map: 지역 지도 좌표(1600x900 기준), spots: 정차 외부 화면의 건물 (x, y는 화면 백분율)
// type 'shelter'는 잠자리 건물 후보: 게임마다 60% 확률로 있다 (없으면 화면에 안 보인다)
LS.LOCATIONS = {
  start_firestation: {
    name: '버려진 소방서', region: 'outskirts', bg: 'outskirts', map: { x: 220, y: 640 },
    spots: [
      { id: 'fs_dorm', label: '소방서 2층 숙직실', type: 'house', x: 30, y: 30 },
      { id: 'fs_truck', label: '차고의 소방차', type: 'roadside_car', x: 20, y: 54 },
      { id: 'fs_lobby', label: '길 건너 교회', type: 'shelter', x: 48, y: 28 }
    ]
  },
  bus_garage: {
    name: '외곽 버스 차고지', region: 'outskirts', bg: 'street', map: { x: 300, y: 330 },
    spots: [
      { id: 'gr_office', label: '차고지 뒤 여관', type: 'shelter', x: 30, y: 42 },
      { id: 'gr_bus', label: '폐버스', type: 'roadside_car', x: 14, y: 64 }
    ]
  },
  outskirts_gas: {
    name: '외곽 주유소', region: 'outskirts', bg: 'street', map: { x: 560, y: 560 },
    spots: [
      { id: 'gs_pump', label: '주유소', type: 'gas_station', x: 22, y: 46 },
      { id: 'gs_shop', label: '주유소 편의점', type: 'convenience', x: 52, y: 40 },
      { id: 'gs_office', label: '언덕 위 모텔', type: 'shelter', x: 36, y: 22 }
    ]
  },
  outskirts_houses: {
    name: '외곽 주택가', region: 'outskirts', bg: 'street', map: { x: 560, y: 250 },
    spots: [
      { id: 'hs_a', label: '주택 A', type: 'house', x: 14, y: 42 },
      { id: 'hs_b', label: '주택 B', type: 'house', x: 34, y: 38 },
      { id: 'hs_c', label: '골목 끝 빈집', type: 'shelter', x: 54, y: 40 }
    ]
  },
  outskirts_pharmacy: {
    name: '외곽 약국 거리', region: 'outskirts', bg: 'street', map: { x: 880, y: 690 },
    spots: [
      { id: 'ph_store', label: '약국', type: 'pharmacy', x: 30, y: 42 },
      { id: 'ph_car', label: '도로변 차량', type: 'roadside_car', x: 14, y: 64 },
      { id: 'ph_room', label: '골목 안 원룸', type: 'shelter', x: 50, y: 30 }
    ]
  },
  outskirts_junkyard: {
    name: '외곽 고물상', region: 'outskirts', bg: 'street', map: { x: 900, y: 300 },
    spots: [
      { id: 'jk_yard', label: '고물상', type: 'junkyard', x: 30, y: 44 },
      { id: 'jk_office', label: '고물상 뒤 컨테이너', type: 'shelter', x: 56, y: 40 }
    ]
  },
  outskirts_mart: {
    name: '외곽 마트', region: 'outskirts', bg: 'street', map: { x: 1110, y: 520 },
    spots: [
      { id: 'mt_mart', label: '마트', type: 'mart', x: 28, y: 40 },
      { id: 'mt_house', label: '마트 옆 주택', type: 'house', x: 54, y: 42 },
      { id: 'mt_staff', label: '마트 뒤 빌라', type: 'shelter', x: 42, y: 20 }
    ]
  },
  // ---------- 주거 지역 (5단계) ----------
  // map: 그 지역 지도 좌표, alt: 이웃 지역 지도에도 보이는 경계 장소의 좌표
  residential_gate: {
    name: '주거 지역 입구', region: 'residential', bg: 'street', map: { x: 150, y: 470 }, alt: { outskirts: { x: 1440, y: 380 } },
    spots: [
      { id: 'rg_post', label: '검문 초소 잔해', type: 'roadside_car', x: 18, y: 62 },
      { id: 'rg_house', label: '길가 주택', type: 'house', x: 34, y: 38 },
      { id: 'rg_shelter', label: '초소 옆 컨테이너', type: 'shelter', x: 52, y: 28 }
    ]
  },
  res_conv: {
    name: '주거 편의점', region: 'residential', bg: 'street', map: { x: 400, y: 250 },
    spots: [
      { id: 'rc_store', label: '24시 편의점', type: 'convenience', x: 28, y: 42 },
      { id: 'rc_room', label: '편의점 위층 원룸', type: 'house', x: 50, y: 38 },
      { id: 'rc_shelter', label: '상가 2층 학원', type: 'shelter', x: 40, y: 20 }
    ]
  },
  res_apart: {
    name: '주거 아파트 단지', region: 'residential', bg: 'street', map: { x: 430, y: 690 },
    spots: [
      { id: 'ra_101', label: '101동', type: 'apartment', x: 22, y: 40 },
      { id: 'ra_102', label: '102동', type: 'apartment', x: 44, y: 36 },
      { id: 'ra_car', label: '지하 주차장 차량', type: 'roadside_car', x: 16, y: 64 },
      { id: 'ra_shelter', label: '관리사무소', type: 'shelter', x: 54, y: 22 }
    ]
  },
  res_pharm: {
    name: '주거 약국 거리', region: 'residential', bg: 'street', map: { x: 720, y: 450 },
    spots: [
      { id: 'rp_store', label: '큰길 약국', type: 'pharmacy', x: 28, y: 42 },
      { id: 'rp_mart', label: '동네 마트', type: 'mart', x: 50, y: 38 },
      { id: 'rp_shelter', label: '건너편 의원 대기실', type: 'shelter', x: 40, y: 20 }
    ]
  },
  res_school: {
    name: '초등학교', region: 'residential', bg: 'street', map: { x: 760, y: 170 },
    spots: [
      { id: 'rs_meal', label: '급식실', type: 'school', x: 28, y: 42 },
      { id: 'rs_gym', label: '체육관', type: 'shelter', x: 50, y: 30 }
    ]
  },
  res_cross: {
    name: '큰 교차로', region: 'residential', bg: 'street', map: { x: 1010, y: 560 },
    spots: [
      { id: 'rx_gas', label: '교차로 주유소', type: 'gas_station', x: 24, y: 44 },
      { id: 'rx_cars', label: '사고 차량들', type: 'roadside_car', x: 46, y: 60 }
    ]
  },
  res_village: {
    name: '자급 마을', region: 'residential', bg: 'outskirts', map: { x: 880, y: 770 },
    spots: [
      { id: 'rv_field', label: '마을 밭 옆 창고', type: 'house', x: 30, y: 44 },
      { id: 'rv_hall', label: '마을회관', type: 'shelter', x: 48, y: 30 }
    ]
  },
  res_bridge: {
    name: '하천 다리', region: 'residential', bg: 'street', map: { x: 1260, y: 330 },
    spots: [
      { id: 'rb_truck', label: '다리 위 버려진 트럭', type: 'roadside_car', x: 30, y: 56 }
    ]
  },
  // 다음 지역 입구 (이후 단계에서 열린다)
  downtown_gate: {
    name: '도심 입구', region: 'downtown', bg: 'street', map: { x: 160, y: 330 }, alt: { residential: { x: 1500, y: 300 } },
    exit: true,
    spots: []
  },
  military_gate: {
    name: '군부대 방향 길', region: 'military', bg: 'street', map: { x: 160, y: 700 }, alt: { residential: { x: 1480, y: 720 } },
    exit: true,
    spots: []
  }
};

// 경로: 기본 운전 시간(시간). road: '큰길'은 처음엔 미확인 (도로 사건 40%)
LS.ROUTES = [
  { a: 'start_firestation', b: 'bus_garage', hours: 3, road: '큰길' },
  { a: 'start_firestation', b: 'outskirts_gas', hours: 3, road: '큰길' },
  { a: 'bus_garage', b: 'outskirts_houses', hours: 4, road: '큰길' },
  { a: 'outskirts_gas', b: 'outskirts_houses', hours: 4, road: '큰길' },
  { a: 'outskirts_gas', b: 'outskirts_pharmacy', hours: 5, road: '큰길' },
  { a: 'outskirts_houses', b: 'outskirts_junkyard', hours: 5, road: '큰길' },
  { a: 'outskirts_pharmacy', b: 'outskirts_mart', hours: 3, road: '큰길' },
  { a: 'outskirts_junkyard', b: 'outskirts_mart', hours: 3, road: '큰길' },
  { a: 'outskirts_junkyard', b: 'residential_gate', hours: 6, road: '큰길' },
  { a: 'outskirts_mart', b: 'residential_gate', hours: 5, road: '큰길' },
  { a: 'outskirts_pharmacy', b: 'residential_gate', hours: 7, road: '큰길' },
  // 주거 지역 (5단계, 시간은 임시값: 입구 → 도심 입구 최단 약 15시간)
  { a: 'residential_gate', b: 'res_conv', hours: 4, road: '큰길' },
  { a: 'residential_gate', b: 'res_apart', hours: 4, road: '큰길' },
  { a: 'res_conv', b: 'res_school', hours: 3, road: '큰길' },
  { a: 'res_conv', b: 'res_pharm', hours: 4, road: '큰길' },
  { a: 'res_apart', b: 'res_pharm', hours: 3, road: '큰길' },
  { a: 'res_apart', b: 'res_village', hours: 4, road: '큰길' },
  { a: 'res_school', b: 'res_bridge', hours: 5, road: '큰길' },
  { a: 'res_pharm', b: 'res_cross', hours: 3, road: '큰길' },
  { a: 'res_cross', b: 'res_bridge', hours: 3, road: '큰길' },
  { a: 'res_cross', b: 'res_village', hours: 3, road: '큰길' },
  { a: 'res_cross', b: 'military_gate', hours: 6, road: '큰길' },
  { a: 'res_village', b: 'military_gate', hours: 5, road: '큰길' },
  { a: 'res_bridge', b: 'downtown_gate', hours: 3, road: '다리', closesDay: 10 },   // D7 예고, D10부터 폐쇄 (05장)
  // 숨은 길: 다리가 닫히면 드러나는 우회로 (05장 예시 '하천 관리도로', 6~10시간 우회)
  { a: 'res_village', b: 'downtown_gate', hours: 9, road: '하천 관리도로', hidden: true }
];
