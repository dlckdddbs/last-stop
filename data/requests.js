// 부탁·급한 용무·작은 순간 (17장 표, 20장, 21장). 5단계 3차.
// 보상 수치는 기획서도 "재산정"이라 했으므로 모두 [임시]. 평판은 부탁한 사람의 소속 집단에 준다.
window.LS = window.LS || {};

// kind: normal 일반 부탁 (동시에 3개, 연락하면 1회 연장) | urgent 급한 용무 (동시에 1개, 연장 불가)
// offer: join (합류한 뒤 다음 정차에서 꺼낸다) | refuge (그 대피소에 도착하면) | encounter (만남과 함께)
// days: 기한(일). null이면 기한 없음 · target: 일하러 가야 하는 장소(들)
// work: 그곳에서 할 일 (2명) · pay: 그곳에서 낼 물자 · deliver: 태워서 데려다주기 · airport: 공항에서 완료
// reward: rep 평판 / give 물자 / info 길 정보 / freeLodge 무료 숙박 (집단)
LS.REQUESTS = {
  narae_brother: {
    from: 'kim_narae', kind: 'normal', offer: 'join', title: '동생 집 조사', days: 3,
    target: ['res_apart'], work: { minutes: 120, label: '동생 집 조사' },
    reward: { rep: 2, info: 'region' },
    rewardText: '주거 지역 길 정보 (모든 길 확인) · 상인 무리 평판 +2',
    ask: [
      { speaker: 'kim_narae', text: '부탁이 하나 있어요. 동생이 주거 아파트 단지에 살았거든요. 집에 한 번만 들러 보고 싶어요.' },
      { speaker: 'kim_narae', text: '두 명이서 두 시간이면 돼요. 대신 이 동네 뒷길은 제가 다 알려 드릴게요.' }
    ],
    done: [
      { speaker: 'narration', text: '빈 집 냉장고 문에 쪽지가 붙어 있었다. "누나, 나 공항 간다. 꼭 와."' },
      { speaker: 'kim_narae', text: '…살아 있네. 고마워요. 약속대로 길은 제가 다 알아요.' }
    ]
  },
  oh_debt: {
    from: 'oh_taeseok', kind: 'normal', offer: 'join', title: '주유소 빚 갚기', days: 5,
    target: ['res_cross'], pay: { fuel: 1 },
    reward: { rep: 3, give: { fuel: 2 } },
    rewardText: '빚을 털면 상인들이 연료 2단위를 내준다 · 상인 무리 평판 +3',
    ask: [
      { speaker: 'oh_taeseok', text: '큰 교차로 주유소에 상인들한테 연료 빚이 하나 있소. 그냥 두고 떠나기가 영 찜찜해서.' },
      { speaker: 'oh_taeseok', text: '연료 1단위만 대신 갚아 주면, 그 친구들이 손해 보게 하진 않을 거요.' }
    ],
    done: [
      { speaker: 'narration', text: '주유소 사람이 장부의 줄을 긋는다. "오태석이 빚 갚을 날이 오네." 연료통 두 개를 밀어 준다.' },
      { speaker: 'oh_taeseok', text: '이제 좀 발 뻗고 자겠소.' }
    ]
  },
  seo_material: {
    from: 'seo_dongjin', kind: 'normal', offer: 'join', title: '억제제 재료 확보', days: 5,
    target: ['outskirts_pharmacy', 'res_pharm'], work: { minutes: 120, label: '억제제 재료 찾기' },
    reward: { rep: 2, give: { suppressant: 1 } },
    rewardText: '억제제 1개 (감염 진행 48시간 정지, 6단계에서 사용) · 의료 네트워크 평판 +2',
    ask: [
      { speaker: 'seo_dongjin', text: '약국 조제실에 남은 시약이 있으면 억제제를 하나 만들 수 있어요.' },
      { speaker: 'seo_dongjin', text: '주거 약국 거리든 외곽 약국이든, 두 사람이 두 시간 찾아 주시면 돼요.' }
    ],
    done: [
      { speaker: 'seo_dongjin', text: '이거면 돼요. …됐다. 억제제 하나. 물린 사람이 생기면 시간을 벌 수 있어요.' }
    ]
  },
  song_list: {
    from: 'song_jiho', kind: 'normal', offer: 'refuge', at: 'res_school', title: '아이 명단 전달', days: null,
    airport: true,
    reward: { rep: 3 },
    rewardText: '공항 접수대에 명단을 전하면 완료 · 주민 대피소 연합 평판 +3 (공항은 7단계)',
    ask: [
      { speaker: 'song_jiho', text: '여기 있는 아이들 이름과 보호자 연락처예요. 공항 접수대에 꼭 전해 주세요.' },
      { speaker: 'song_jiho', text: '그래야 수송대가 우리를 찾으러 와요. 버스가 없어서 우리는 갈 수가 없거든요.' }
    ],
    done: [{ speaker: 'narration', text: '접수대 직원이 명단을 받아 든다. "학교 대피소요? 수송대 편성하겠습니다."' }]
  },
  kwon_ride: {
    from: 'kwon_sunja', kind: 'normal', offer: 'encounter', title: '자급 마을까지 이송', days: 2,
    deliver: 'res_village',
    reward: { rep: 3, freeLodge: 'residents' },
    rewardText: '주민 대피소 연합 평판 +3 · 주민 대피소에서 숙박 1회 무료 (21장)',
    done: [
      { speaker: 'kwon_sunja', text: '여기가 우리 동생네 마을이야. 고마워요, 젊은이들.' },
      { speaker: 'lim_hyejin', text: '권순자 할머니를 모셔 오셨네요. 다음에 오시면 하룻밤은 그냥 묵고 가세요.' }
    ]
  },
  // 급한 용무 (20장): 고립자 구조. 대피소에 처음 갔을 때 무전으로 들어온다 [임시: 6일째부터, 대피소당 40%]
  rescue: {
    kind: 'urgent', offer: 'radio', title: '고립자 구조', hours: 12,
    work: { minutes: 60, label: '고립자 구조' },
    reward: { rep: 4, give: { food: 8, meds: 1 } },
    rewardText: '대피소 평판 +4 · 구조한 사람이 나눠 준 식량 8인분·약 1회분 · 참여자 정신력 +2'
  }
};

LS.REQUEST_RULES = {
  maxNormal: 3,           // 일반 부탁 동시 3개 (20장)
  maxUrgent: 1,           // 급한 용무 동시 1개
  extendFactor: 0.5,      // 연락하면 원래 기한의 절반만큼 1회 연장
  extendReward: 0.7,      // 연장 안에 끝내면 보상 70%
  lateRep: -2,            // [해석] 연락 없이 기한을 넘김 (급한 용무 '늦음'과 같게)
  extendLateRep: -4,      // 연장 기한까지 어김 (20장)
  giveUpRep: -1,          // 포기 연락
  ignoreRep: -4,          // 급한 용무를 연락 없이 무시
  doneMental: 2,          // 참여자 정신력 +2
  rescueChance: 0.4,      // [임시] 대피소에 처음 갔을 때 고립자 구조 무전이 들어올 확률
  rescueFromDay: 6,
  promiseDays: 5,         // 리더 약속 기본 5일 (20장)
  promiseLateDays: 2,     // 기한 뒤 2일 안은 '늦음'
  keptDays: 5             // 합류 조건 5일 준수 (17장)
};

// 작은 순간 (21장): 같은 장면 한 판 1회, 하루 최대 1개
LS.MOMENTS = {
  han_check: { who: 'han_jungsu', kept: true, title: '한정수의 새벽 점검', effect: '내구도 +5',
    lines: [{ speaker: 'narration', text: '새벽, 엔진룸 쪽에서 덜그럭 소리가 난다.' }, { speaker: 'han_jungsu', text: '약속 지켜 줘서 고맙소. 그래서 나도 내 몫은 하려고. 벨트 좀 조여 놨소.' }] },
  narae_alley: { who: 'kim_narae', kept: true, title: '김나래의 뒷길 안내', effect: '지금 있는 곳에서 나가는 길을 모두 확인 (경로 정찰 생략)',
    lines: [{ speaker: 'kim_narae', text: '밥 꼬박꼬박 챙겨 줘서 기운이 나네요. 여기서 나가는 길, 제가 다 알아요. 정찰 안 해도 돼요.' }] },
  hayul_drawing: { who: 'jung_hayul', kept: true, keptBy: 'jung_minkyung', title: '하율의 창문 버스 그림', effect: '전원 정신력 +2',
    lines: [{ speaker: 'narration', text: '김 서린 버스 창문에 하율이 손가락으로 그림을 그렸다. 버스와 사람들, 그리고 비행기.' }, { speaker: 'jung_hayul', text: '이게 우리야! 다 같이 비행기 타는 거.' }] },
  firehouse: { title: '소방서 시절 이야기', effect: '윤재하·박서윤 정신력 +3',
    lines: [{ speaker: 'park_seoyun', text: '기억나요? 소방서 옥상에서 컵라면 먹던 거. 그때는 출동 벨이 제일 무서웠는데.' }, { speaker: 'yoon_jaeha', text: '…그래. 그땐 다 구할 수 있을 줄 알았지.' }] },
  radio_song: { title: '주파수 사이의 노래', effect: '전원 정신력 +1',
    lines: [{ speaker: 'narration', text: '라디오 주파수를 돌리다 잡음 사이로 오래된 노래가 흘러나온다. 아무도 끄자고 하지 않는다.' }] },
  first_request: { title: '첫 부탁 성공', effect: '참여자 정신력 +2',
    lines: [{ speaker: 'park_seoyun', text: '우리가 누군가를 도왔네요. …이런 날도 있어야죠.' }] }
};
