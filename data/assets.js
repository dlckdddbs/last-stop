// 그림 목록. 임시 그림을 정식 그림으로 바꿀 때는 파일만 교체하거나 여기 경로만 고친다.
// 권장 크기: 배경·장면 16:9 (1600x900), 인물 정사각형 (256x256)
window.LS = window.LS || {};

LS.ASSETS = {
  bg: {
    outskirts_day: 'images/bg/outskirts_day.svg',       // 시작 장소: 버려진 소방서
    outskirts_night: 'images/bg/outskirts_night.svg',
    street_day: 'images/bg/street_day.svg',             // 외곽 거리 (장소별 정식 배경 전까지 공용)
    street_night: 'images/bg/street_night.svg'
  },
  bus: {
    exterior: 'images/bus/exterior.svg',
    interior: 'images/bus/interior.svg'
  },
  map: 'images/map/region_map.svg',
  travel: {
    far: 'images/travel/far.svg',
    near: 'images/travel/near.svg'
  },
  portraits: {
    yoon_jaeha: 'images/portraits/yoon_jaeha.svg',
    park_seoyun: 'images/portraits/park_seoyun.svg',
    han_jungsu: 'images/portraits/han_jungsu.svg',
    lee_sua: 'images/portraits/lee_sua.svg',
    oh_taeseok: 'images/portraits/oh_taeseok.svg',
    lee_junghoon: 'images/portraits/lee_junghoon.svg',
    go_mansik: 'images/portraits/go_mansik.svg',
    go_mansu: 'images/portraits/go_mansu.svg',
    radio: 'images/portraits/radio.svg'
  },
  icons: {
    food: 'images/icons/food.svg',
    fuel: 'images/icons/fuel.svg',
    meds: 'images/icons/meds.svg',
    parts: 'images/icons/parts.svg',
    bus: 'images/icons/bus.svg',
    engine: 'images/icons/engine.svg'
  }
};
