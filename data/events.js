// 사건(대화창) 데이터. 사건 진행: 상황 → 관찰 정보 → 동료 의견 → 선택 → 결과 (01장)
// speaker: 인물 id (characters.js) 또는 'narration', 'radio'
window.LS = window.LS || {};

LS.EVENTS = {
  prologue: {
    title: '출발',
    screen: 'outside',
    lines: [
      { speaker: 'narration', text: '1일째 06시. 도시 외곽, 버려진 소방서 차고. 셔터 틈으로 아침 햇빛이 들어온다.' },
      { speaker: 'narration', text: '시동을 걸지 않은 대형버스 한 대. 이 버스로 공항까지 가야 한다.' },
      { speaker: 'park_seoyun', text: '연료는 30시간분. 보존식은 열다섯 끼예요. 둘이서는 나흘이 안 돼요.' },
      { speaker: 'yoon_jaeha', text: '가는 길에 구하면 돼. 물자도, 사람도.' },
      { speaker: 'narration', text: '어젯밤 북쪽 버스 차고지에서 경적이 세 번 울렸다. 동쪽 주유소 옥상에는 붉은 십자가를 그린 천이 걸려 있다.' },
      { speaker: 'park_seoyun', text: '둘 다 오래 기다려 주진 않을 거예요. 한 곳만 들를 수 있을 것 같아요.' },
      { speaker: 'yoon_jaeha', text: '날이 밝을 때 움직이자. 멈추면 들킨다. 그래도 멈추지 않고는 못 가.' }
    ],
    observations: [
      '현재 위치: 도시 외곽 · 버려진 소방서 (낮)',
      '인원 2명 · 운전 가능 1명 (윤재하)',
      '외곽 버스 차고지: 어젯밤 경적 소리 (3시간)',
      '외곽 주유소: 옥상에 붉은 십자가 천 (3시간)',
      '아침 8시에 정기 라디오 방송이 있다'
    ],
    choices: [
      {
        label: '출발 준비를 한다',
        desc: '소방서 안을 먼저 둘러보거나, 지도에서 바로 출발할 수 있다.',
        result: {
          lines: [{ speaker: 'narration', text: '두 사람은 버스에서 내려 소방서 안을 둘러보기로 했다.' }],
          log: '출발 준비를 시작했다.',
          goto: 'outside'
        }
      }
    ]
  },

  radio_d1: {
    title: '접수 안내 방송',
    screen: 'bus',
    lines: [
      { speaker: 'narration', text: '08시. 배터리 라디오의 잡음이 걷힌다.' },
      { speaker: 'radio', text: '여기는 공항 임시 대피본부. 마지막 대피편 접수는 30일째 24시에 마감됩니다.' },
      { speaker: 'radio', text: '접수는 공항 지역 검문소에서 진행합니다. 이동 중인 생존자는 엔진 소리에 주의하십시오.' },
      { speaker: 'radio', text: '정차할 때는 반드시 주변을 먼저 확인하십시오. 반복합니다…' },
      { speaker: 'park_seoyun', text: '30일째 자정까지. 하루도 남기면 안 되겠네요.' },
      { speaker: 'yoon_jaeha', text: '남기는 게 아니라 쓰는 거야. 누군가를 태울 시간으로.' }
    ],
    observations: [
      '접수 마감: 30일째 24:00',
      '공항 지역의 위치가 지도에 표시되었다',
      '정차하면 근처의 좀비가 알아챌 수 있다'
    ],
    opinions: [
      { speaker: 'park_seoyun', text: '도시 외곽부터 빠져나가요. 여기선 보급할 데가 많지 않아요.' }
    ],
    choices: [
      {
        label: '지도를 확인한다',
        result: {
          lines: [{ speaker: 'narration', text: '윤재하는 접힌 도로 지도를 펼쳤다.' }],
          log: '공항 위치를 확인했다.',
          flags: { airportKnown: true },
          goto: 'map'
        }
      },
      {
        label: '버스를 둘러본다',
        result: {
          lines: [{ speaker: 'narration', text: '좌석 여섯 개, 비어 있는 뒤쪽 공간. 이 버스가 30일 동안의 집이다.' }],
          log: '공항 위치를 확인했다.',
          flags: { airportKnown: true },
          goto: 'bus'
        }
      }
    ]
  }
};

// 정해진 시각에 일어나는 사건 (게임 시작부터 경과한 분)
// 21장 정기 방송 · 05장 다리 폐쇄 (D7 예고, D10 적용)
LS.EVENTS.radio_d7 = {
  title: '다리 폐쇄 예고',
  screen: 'bus',
  lines: [
    { speaker: 'narration', text: '7일째 08시. 라디오가 지직거리다 또렷해진다.' },
    { speaker: 'radio', text: '알립니다. 주거 지역 하천 다리는 감염 확산 차단을 위해 10일째 0시부로 폐쇄됩니다.' },
    { speaker: 'radio', text: '이후 도심 방면은 하천 관리도로로 우회하십시오. 공항 검문소 위치는 변동 없습니다.' },
    { speaker: 'park_seoyun', text: '3일 남았어요. 다리로 갈지, 돌아갈 각오를 할지 정해야 해요.' }
  ],
  observations: [
    '10일째 0시부터 하천 다리 폐쇄 (도심 입구로 가는 지름길)',
    '늦으면 자급 마을 쪽 하천 관리도로로 돌아간다 (약 9시간)',
    '도심은 다음 업데이트에서 열립니다'
  ],
  choices: [{ label: '지도를 확인한다', result: { log: '다리 폐쇄 예고를 들었다', goto: 'map' } }]
};

LS.EVENTS.bridge_closed = {
  title: '다리 폐쇄',
  screen: 'map',
  lines: [
    { speaker: 'radio', text: '10일째 0시. 하천 다리가 폐쇄되었습니다. 접근하지 마십시오.' },
    { speaker: 'narration', text: '지도 위 다리 길에 붉은 줄이 그어졌다. 대신 하천 관리도로가 열렸다.' }
  ],
  observations: ['하천 다리 → 도심 입구 길이 닫혔다', '자급 마을 → 도심 입구: 하천 관리도로 9시간 (숨은 길)'],
  choices: [{ label: '알았다', result: { log: '하천 다리가 닫히고 하천 관리도로가 열렸다', flags: { bridgeClosed: true } } }]
};

LS.SCHEDULE = [
  { at: 6 * 60, event: 'prologue' },     // 1일째 06시(낮)에 시작
  { at: 8 * 60, event: 'radio_d1' },
  { at: 6 * 1440 + 8 * 60, event: 'radio_d7' },
  { at: 9 * 1440, event: 'bridge_closed' }
];

// 첫 동료 분기 (2026-11-10 결정): 소방서에서 처음 들른 곳에서 한 명을 만나고, 다른 쪽 사람은 떠난다.
// hint: 지도 경로 패널에 보이는 단서
LS.FIRST_COMPANION = {
  bus_garage: { id: 'han_jungsu', short: '경적 소리', hint: '어젯밤 경적이 세 번 울렸던 곳', meet: 'meet_driver', gone: 'gone_driver' },
  outskirts_gas: { id: 'lee_sua', short: '붉은 십자가 천', hint: '옥상에 붉은 십자가 천이 걸린 곳', meet: 'meet_nurse', gone: 'gone_nurse' }
};

Object.assign(LS.EVENTS, {
  meet_driver: {
    title: '경적 소리',
    screen: 'outside',
    lines: [
      { speaker: 'narration', text: '차고지 안쪽, 앞유리가 깨진 시내버스 운전석에서 남자가 손을 들었다.' },
      { speaker: 'han_jungsu', text: '경적 들었소? 배터리가 다 돼서 세 번이 마지막이었지.' },
      { speaker: 'han_jungsu', text: '이 노선만 이십 년을 몰았소. 큰 차는 내가 더 잘 다뤄.' },
      { speaker: 'yoon_jaeha', text: '공항까지 갑니다. 운전대를 나눠 잡아 줄 사람이 필요해요.' }
    ],
    observations: [
      '한정수 · 전직 버스 기사',
      '합류 조건: 하루 운전 8시간까지 (넘기면 첫 번째는 경고, 두 번째는 다음 장소에서 내린다)',
      '운전 기력 소모가 적고(시간당 -4), 본인이 운전하면 이동 시간 -10%',
      '함께 가면 주유소 쪽 사람은 만나지 못한다'
    ],
    opinions: [
      { speaker: 'park_seoyun', text: '운전할 사람이 하나 더 생기면 밤새 달릴 수도 있겠네요.' }
    ],
    choices: [
      {
        label: '함께 가자',
        result: {
          lines: [{ speaker: 'han_jungsu', text: '좋소. 대신 운전석은 내 식대로 맞추겠소.' }]
        },
        run: (s) => LS.State.addMember(s, 'han_jungsu', '버스 기사')
      }
    ]
  },

  meet_nurse: {
    title: '붉은 십자가',
    screen: 'outside',
    lines: [
      { speaker: 'narration', text: '주유소 편의점 셔터가 반쯤 올라가더니, 구급가방을 멘 여자가 몸을 숙이고 나왔다.' },
      { speaker: 'lee_sua', text: '천 보고 오신 거죠? 이수아예요. 도심 진료소 간호사였어요.' },
      { speaker: 'lee_sua', text: '약을 구하러 외곽까지 나왔다가 돌아갈 길이 끊겼어요. 다친 사람 있으면 봐 드릴게요.' },
      { speaker: 'lee_sua', text: '대신 하나만 약속해 주세요. 누가 물려도, 길에 버리고 가지 않기로요.' },
      { speaker: 'yoon_jaeha', text: '공항까지 갑니다. 약속할게요.' }
    ],
    observations: [
      '이수아 · 간호사 (도심 진료소 출신)',
      '간호사 치료: 의약품 1회분·2시간에 HP +20 (일반 +15) · 치료는 이후 단계',
      '지금은 일행의 식중독이 빨리 낫는다 (12시간 → 6시간, 임시) · 일반 운전 가능 (임시)',
      '합류 조건: 감염자를 버리지 않는다',
      '함께 가면 차고지 쪽 사람은 만나지 못한다'
    ],
    opinions: [
      { speaker: 'park_seoyun', text: '의약품을 아낄 수 있겠어요. 다치는 건 시간문제니까요.' }
    ],
    choices: [
      {
        label: '함께 가자',
        result: {
          lines: [{ speaker: 'lee_sua', text: '고마워요. 구급가방은 제가 챙길게요.' }]
        },
        run: (s) => LS.State.addMember(s, 'lee_sua', '간호사')
      }
    ]
  },

  gone_driver: {
    title: '빈 운전석',
    screen: 'outside',
    lines: [
      { speaker: 'narration', text: '차고지 안쪽 시내버스의 운전석은 비어 있었다. 핸들 위에 "먼저 간다"라고 쓴 종이가 붙어 있다.' }
    ]
  },

  gone_nurse: {
    title: '내려진 천',
    screen: 'outside',
    lines: [
      { speaker: 'narration', text: '주유소 옥상의 붉은 십자가 천은 내려져 있었다. 편의점 바닥에 빈 붕대 포장지만 흩어져 있다.' }
    ]
  }
});

// 14일째 대피소 안부 방송 (21장): 맡긴 사람 소식·소문·교환 공고는 그때의 상황으로 만든다 (5단계 3차)
Object.defineProperty(LS.EVENTS, 'radio_d14', {
  configurable: true, enumerable: true,
  get() { return LS.Requests.radioD14(LS.game); }
});
LS.SCHEDULE.push({ at: 13 * 1440 + 8 * 60, event: 'radio_d14' });
