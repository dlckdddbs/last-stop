// 지역과 장소 데이터 (05장). 1단계는 시작 장소와 지도 표시만 쓴다.
window.LS = window.LS || {};

// 지도 위치는 지도 그림 기준 백분율(%)
LS.REGIONS = {
  outskirts:   { name: '도시 외곽',   map: { x: 15, y: 58 } },
  residential: { name: '주거 지역',   map: { x: 36, y: 44 } },
  downtown:    { name: '도심',        map: { x: 57, y: 30 } },
  military:    { name: '군부대 주변', map: { x: 58, y: 72 } },
  airport:     { name: '공항 지역',   map: { x: 85, y: 50 } }
};

LS.LOCATIONS = {
  start_firestation: {
    name: '버려진 소방서',
    region: 'outskirts',
    type: 'base',
    bg: 'outskirts',
    map: { x: 12, y: 62 },
    // 정차 외부 화면의 건물 자리 (2단계에서 정찰·파밍 연결)
    spots: [
      { label: '차고 안쪽', x: 22, y: 48 },
      { label: '소방서 2층', x: 30, y: 30 },
      { label: '앞 도로', x: 74, y: 70 }
    ]
  }
};
