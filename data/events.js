// 사건(대화창) 데이터. 사건 진행: 상황 → 관찰 정보 → 동료 의견 → 선택 → 결과 (01장)
// speaker: 인물 id (characters.js) 또는 'narration', 'radio'
window.LS = window.LS || {};

LS.EVENTS = {
  prologue: {
    title: '출발 전야',
    screen: 'outside',
    lines: [
      { speaker: 'narration', text: '1일째 00시. 도시 외곽, 버려진 소방서 차고.' },
      { speaker: 'narration', text: '셔터 너머로 시동을 걸지 않은 대형버스 한 대가 서 있다.' },
      { speaker: 'park_seoyun', text: '연료는 30시간분. 보존식은 열다섯 끼예요. 둘이서 나흘이 안 돼요.' },
      { speaker: 'yoon_jaeha', text: '가는 길에 구하면 돼.' },
      { speaker: 'park_seoyun', text: '라디오가 맞다면… 공항까지 30일이에요.' },
      { speaker: 'yoon_jaeha', text: '그럼 30일 안에 가면 되지.' },
      { speaker: 'narration', text: '멈추면 들킨다. 그래도 멈추지 않고는 갈 수 없다.' }
    ],
    observations: [
      '현재 위치: 도시 외곽 · 버려진 소방서',
      '인원 2명 · 운전 가능 1명 (윤재하)',
      '아침 8시에 정기 라디오 방송이 있다'
    ],
    choices: [
      {
        label: '날이 밝을 때까지 기다린다',
        desc: '시간 조작의 [다음 상황까지]로 방송 시각까지 진행할 수 있다.',
        result: {
          lines: [{ speaker: 'narration', text: '두 사람은 버스 안에서 방송 시각을 기다리기로 했다.' }],
          log: '출발 준비를 시작했다.',
          goto: 'bus'
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
LS.SCHEDULE = [
  { at: 0, event: 'prologue' },
  { at: 8 * 60, event: 'radio_d1' }
];
