// 생존자 만남 (16~17장 합류·상의·면담·검사, 22장 사건 예시).
// where: 만나는 장소 id, 또는 'stopD2D3' (2~3일째 낮에 버스가 서 있는 곳으로 다가온다)
// kind: join 공항까지 동료 | temp 목적지까지 임시 동행 | thief 동행을 핑계로 식량을 노리는 사람 (속이는 인물)
// observed: 만났을 때 보이는 것 · interview: 면담(1시간) 결과 · inspect: 검사(1시간) 결과
window.LS = window.LS || {};

LS.ENCOUNTERS = {
  // 16장 인물 목록: 오태석 · 정비원/상인 · 외곽 고물상
  oh_taeseok: {
    who: ['oh_taeseok'], kind: 'join', where: 'outskirts_junkyard', pos: { x: 40, y: 66 },
    title: '고물상의 정비원',
    purpose: '공항까지 같이 가고 싶어 한다',
    condition: '없음',
    intro: [
      { speaker: 'narration', text: '고물상 마당, 뜯어 놓은 엔진 옆에서 기름때 묻은 남자가 렌치를 내려놓는다.' },
      { speaker: 'oh_taeseok', text: '그 버스, 앞바퀴 소리가 이상한데. 공항 가는 길이면 나도 끼워 주쇼. 고칠 줄은 아니까.' }
    ],
    observed: ['공구 가방을 멨다. 손에 기름때', '고물상 사무실에 혼자 지낸 흔적', '합류를 원한다'],
    opinion: { speaker: 'park_seoyun', text: '정비할 줄 아는 사람이면 든든하죠. 부품도 아낄 수 있고요.' },
    interview: ['고물상을 하던 오태석. 주유소에 연료 빚을 져서 마음에 걸린다고 한다 (부탁은 5단계)', '말에 앞뒤가 맞는다. 공항에 가려는 이유도 분명하다'],
    inspect: { results: ['공구 가방과 렌치, 부품 몇 개', '상처나 물린 자국은 없다'], grumble: '"뒤져 봐야 기름때밖에 없소." 조금 언짢아한다' },
    acceptLine: '좋소. 바퀴부터 봐 드리리다.'
  },

  // 임시 인물 (Claude 추가): 임시 동행 + 검사로 상처를 가려보는 연습
  lee_junghoon: {
    who: ['lee_junghoon'], kind: 'temp', dest: 'residential_gate', destText: '주거 지역 입구', where: 'outskirts_pharmacy', pos: { x: 44, y: 64 },
    title: '붕대 감은 남자',
    purpose: '주거 지역 입구까지만 태워 달라고 한다 (가족이 그쪽에 있다)',
    condition: '없음 · 목적지에서 내린다',
    intro: [
      { speaker: 'narration', text: '약국 셔터 앞, 팔에 붕대를 감은 남자가 약 봉지를 끌어안고 있다.' },
      { speaker: 'lee_junghoon', text: '주거 지역 입구까지만 태워 주실 수 있어요? 딸이 거기 있어요. 약을 구하러 나왔다가…' }
    ],
    observed: ['왼팔에 붕대. 피가 조금 배었다', '약 봉지와 사진 한 장을 들고 있다', '주거 지역 입구까지만 원한다'],
    opinion: { speaker: 'park_seoyun', text: '팔에 붕대… 물린 거면 어떡해요? 확인은 해 보는 게 좋겠어요.' },
    interview: ['딸이 주거 지역 아파트에 있다고 한다. 사진 속 아이와 이야기가 맞는다', '약국 유리창을 깨다 다쳤다고 한다'],
    inspect: {
      results: ['짐: 해열제·아동용 시럽, 사진 한 장'],
      wound: { hero: '붕대 아래는 유리에 베인 상처다. 물린 자국이 아니다 (윤재하는 상처를 가려볼 줄 안다)', other: '베인 상처 같지만, 물린 자국이 아니라고 확신하긴 어렵다' },
      grumble: '"의심하시는 건 알아요." 씁쓸하게 웃는다'
    },
    acceptLine: '고맙습니다. 정말로요.',
    farewell: [
      { speaker: 'lee_junghoon', text: '여기서 내릴게요. 딸 찾으면… 공항 쪽으로 가 볼게요.' },
      { speaker: 'narration', text: '그는 약 봉지를 꼭 쥐고 주거 지역 쪽으로 걸어갔다.' }
    ]
  },

  // 22장 ① 어디까지만 태워주세요 (초반 고정, 2~3일째). 사실 식량을 노린다. 이름은 임시
  brothers: {
    who: ['go_mansik', 'go_mansu'], kind: 'thief', dest: 'next', destText: '다음 마을', where: 'stopD2D3', pos: { x: 38, y: 68 },
    title: '어디까지만 태워주세요',
    purpose: '다음 마을까지만 태워 달라고 한다',
    condition: '없음 · 다음 마을에서 내린다고 한다',
    intro: [
      { speaker: 'narration', text: '도로변에서 두 남자가 손을 흔든다. 배낭은 둘 다 홀쭉하다.' },
      { speaker: 'go_mansik', text: '다음 마을까지만 태워 주쇼. 둘이 걸어서는 해 지기 전에 못 가요.' },
      { speaker: 'go_mansu', text: '…' }
    ],
    observed: ['둘 다 배낭이 비어 있다', '말하는 동안 버스 안 식량 상자 쪽을 자꾸 본다', '다음 마을까지만 원한다 (좌석 2개)'],
    opinion: { speaker: 'park_seoyun', text: '둘 다 식량 상자만 보는 것 같은데요… 기분 탓일까요.' },
    interview: ['형은 "주거 지역 친척 집"에 간다고 하고, 동생은 "마트에 아는 사람이 있다"고 한다. 행선지가 어긋난다'],
    inspect: { results: ['접이식 칼 한 자루 (흔한 것이다)', '빈 자루 두 개. 수상하지만 훔친 물건은 없어 확정할 수 없다'], grumble: '동생이 머뭇거리자 형이 "보여 드려"라며 막는다' },
    acceptLine: '고맙수. 신세 좀 지겠소.'
  }
};

// ---------- 주거 지역 (5단계, 16~17장 인물 목록) ----------
Object.assign(LS.ENCOUNTERS, {
  // 김나래 · 배달 경험/상인 · 주거 편의점 · "먼저 동행 요청"
  kim_narae: {
    who: ['kim_narae'], kind: 'join', where: 'res_conv', pos: { x: 38, y: 66 },
    title: '먼저 손을 든 사람',
    purpose: '공항까지 같이 가고 싶어 한다. 길 안내를 하겠다고 한다',
    condition: '하루 두 끼 정상 배급 (반 배급·거르기를 하면 위반)',
    intro: [
      { speaker: 'narration', text: '편의점 앞, 배달 가방을 멘 여자가 버스를 보자마자 달려온다.' },
      { speaker: 'kim_narae', text: '공항 가요? 저 이 동네 골목 다 알아요. 배달만 오 년 했거든요. 대신… 밥은 하루 두 끼 꼭 먹고요.' }
    ],
    observed: ['배달 가방에 지도와 볼펜', '손에 굳은살. 상처는 없어 보인다', '먼저 동행을 청했다'],
    opinion: { speaker: 'park_seoyun', text: '길 아는 사람은 귀하죠. 두 끼 조건은 식량을 보고 정해요.' },
    interview: ['동생이 이 근처 아파트에 살았다고 한다. 확인하고 싶어 한다 (부탁은 다음 업데이트)', '골목과 뒷길 이야기가 구체적이다. 말에 앞뒤가 맞는다'],
    inspect: { results: ['배달 가방: 지도, 볼펜, 빈 물병', '상처나 물린 자국은 없다'], grumble: '"까다롭네요." 하면서도 순순히 보여 준다' },
    acceptLine: '좋아요! 지름길은 저한테 맡겨요.'
  },
  // 정민경·정하율 · 부모·아이 · 주거 아파트 · 좌석 2개 · 가족을 분리하지 않음 (22장 ③ 만석의 가족)
  jung_family: {
    who: ['jung_minkyung', 'jung_hayul'], kind: 'join', where: 'res_apart', pos: { x: 34, y: 68 },
    title: '아파트의 엄마와 아이',
    purpose: '아이와 함께 공항까지 가고 싶어 한다',
    condition: '가족을 떼어 놓지 않는다 (좌석 2개가 같이 필요하다)',
    intro: [
      { speaker: 'narration', text: '아파트 현관에서 여자가 아이 손을 꼭 잡고 나온다. 아이는 버스를 신기하게 올려다본다.' },
      { speaker: 'jung_minkyung', text: '둘이 같이 타야 해요. 하율이랑 떨어지는 건 안 돼요. 짐은 거의 없어요.' },
      { speaker: 'jung_hayul', text: '버스 크다…' }
    ],
    observed: ['좌석 2개가 함께 필요하다', '아이는 일을 할 수 없다. 식량은 둘 몫이 든다', '엄마의 소매에 피가 묻었다 — 자기 피일까?'],
    opinion: { speaker: 'park_seoyun', text: '아이를 두고 갈 순 없잖아요… 그래도 식량은 계산해 봐야 해요.' },
    interview: ['남편은 사흘 전 물을 구하러 나가 돌아오지 않았다고 한다', '아이 이야기를 할 때 목소리가 떨린다. 말에 앞뒤는 맞는다'],
    inspect: {
      results: ['짐: 아이 옷, 약간의 빵, 가족사진'],
      wound: { hero: '소매의 피는 아이가 넘어져 무릎이 까진 걸 닦은 자국이다. 둘 다 물린 자국은 없다', other: '물린 자국은 안 보이지만, 소매의 피가 어디서 났는지는 확실치 않다' },
      grumble: '"아이는 무서워해요. 빨리 해 주세요."'
    },
    acceptLine: '고맙습니다… 하율아, 인사해.',
    // 22장 ③: 학교까지 이송 (좌석 2개 확보 후). 주민 평판 +2~+3 → [임시] +2
    altTemp: {
      dest: 'res_school', destText: '초등학교 대피소', faction: 'residents', rep: 2,
      acceptLine: '학교요? 거기 아이들이 모여 있다고 들었어요. 거기까지라도 부탁드려요.',
      farewell: [
        { speaker: 'jung_minkyung', text: '여기라면 하율이도 덜 무서워하겠어요. 정말 고마워요.' },
        { speaker: 'jung_hayul', text: '버스 고마워요! 안녕!' }
      ]
    }
  },
  // 서동진 · 약사/의료 · 주거 약국
  seo_dongjin: {
    who: ['seo_dongjin'], kind: 'join', where: 'res_pharm', pos: { x: 40, y: 66 },
    title: '약국의 약사',
    purpose: '공항까지 같이 가고 싶어 한다',
    condition: '없음',
    intro: [
      { speaker: 'narration', text: '셔터 내린 약국 안에서 안경 쓴 남자가 손전등을 깜빡인다.' },
      { speaker: 'seo_dongjin', text: '약사입니다. 남은 약은 별로 없지만 뭘 써야 하는지는 알아요. 저도 공항까지 데려가 주시겠어요?' }
    ],
    observed: ['흰 가운에 이름표', '약 봉투 몇 개를 챙겼다', '합류를 원한다'],
    opinion: { speaker: 'park_seoyun', text: '약 아는 사람이 있으면 다쳤을 때 마음이 놓이겠어요.' },
    interview: ['억제제를 만드는 재료를 안다고 한다 (부탁은 다음 업데이트)', '약국을 지키다 혼자 남았다. 말에 앞뒤가 맞는다'],
    inspect: { results: ['약 봉투: 해열제·소독약 조금', '상처나 물린 자국은 없다'], grumble: '"당연히 확인해야죠." 협조적이다' },
    acceptLine: '고맙습니다. 약은 제가 정리할게요.'
  }
});

// 권순자 · 보행 불편 노인/주민 · 외곽 주택 · 영구 합류 아님 · 자급 마을 이송 2일 (16~17장, 5단계 3차)
LS.ENCOUNTERS.kwon_sunja = {
  who: ['kwon_sunja'], kind: 'temp', dest: 'res_village', destText: '자급 마을', where: 'outskirts_houses', pos: { x: 70, y: 66 },
  request: 'kwon_ride',
  title: '지팡이를 짚은 할머니',
  purpose: '자급 마을의 동생네까지 데려다 달라고 한다 (이송 부탁, 2일 안)',
  condition: '영구 합류 아님 · 자급 마을에서 내린다',
  intro: [
    { speaker: 'narration', text: '주택 대문 앞, 지팡이를 짚은 할머니가 버스를 향해 천천히 손을 든다.' },
    { speaker: 'kwon_sunja', text: '젊은이들, 주거 지역 너머 자급 마을까지만 데려다줄 수 있수? 동생이 거기 살아. 다리가 이래서 걸어서는 못 가.' }
  ],
  observed: ['다리가 불편해 걷기 힘들다. 일은 맡길 수 없다', '작은 보따리 하나뿐', '자급 마을까지만 원한다 (좌석 1개)'],
  opinion: { speaker: 'park_seoyun', text: '자급 마을은 주거 지역 안쪽이에요. 가는 길이긴 한데… 이틀 안에 갈 수 있을까요?' },
  interview: ['자급 마을에 동생 부부가 산다고 한다. 주민 연합 사람들 이름을 안다', '말에 앞뒤가 맞는다'],
  inspect: { results: ['보따리: 약봉지, 사진, 떡 몇 개', '상처나 물린 자국은 없다'], grumble: '"늙은이 몸 뒤져서 뭐 나오겠수." 그래도 웃는다' },
  acceptLine: '고마워요. 신세 좀 질게.',
  farewell: [{ speaker: 'kwon_sunja', text: '여기야, 여기. 아이고, 살았다.' }]
};

// ---------- 도심 앞부분 (5단계 4차, 16~17장) ----------
Object.assign(LS.ENCOUNTERS, {
  // 배진혁 · 도심 정류장 · 물림을 숨기고 먼저 요청 (속이는 인물). 합류 24시간 뒤 발열
  bae_jinhyuk: {
    who: ['bae_jinhyuk'], kind: 'join', where: 'dt_stop', pos: { x: 36, y: 68 },
    title: '먼저 다가온 남자',
    purpose: '공항까지 같이 가고 싶어 한다. 버스를 보자마자 달려왔다',
    condition: '없음',
    intro: [
      { speaker: 'narration', text: '정류장 유리 벽 뒤에서 남자가 뛰어나온다. 왼팔을 몸에 붙인 채다.' },
      { speaker: 'bae_jinhyuk', text: '공항 가시죠? 저도 태워 주세요. 뭐든 할게요. 운전도 할 줄 알아요. 제발요.' }
    ],
    observed: ['왼팔 소매를 손으로 꽉 쥐고 있다', '얼굴이 조금 붉고 땀이 난다', '먼저 태워 달라고 서두른다'],
    opinion: { speaker: 'park_seoyun', text: '너무 서두르는 것 같아요… 확인은 해 보는 게 어때요?' },
    interview: ['어디서 왔냐는 물음에 정류장, 지하상가, 친구 집으로 말이 바뀐다', '팔 이야기가 나오면 말을 돌린다'],
    inspect: {
      results: ['짐: 휴대폰, 지갑, 물 한 병', '이마가 뜨겁다. 미열이 있다'],
      wound: { hero: '소매를 걷게 하니 왼팔에 이빨 자국이 있다. 물린 지 하루가 안 됐다 (윤재하는 물린 자국을 알아본다)', other: '팔을 끝내 보여 주지 않는다. "넘어져서 까졌어요."' },
      grumble: '"그냥 좀 태워 주면 안 돼요?" 목소리가 떨린다'
    },
    acceptLine: '고마워요. 정말… 고마워요.'
  },
  // 유상철 · 상인 · 도심 교환 거점 · 교환품이 식량 보관 10칸을 쓴다
  yoo_sangcheol: {
    who: ['yoo_sangcheol'], kind: 'join', where: 'dt_market', pos: { x: 62, y: 66 },
    title: '짐 많은 상인',
    purpose: '공항까지 같이 가고 싶어 한다. 교환품을 싣고 가야 한다',
    condition: '교환품이 식량 보관 10칸을 쓴다 (식량 보관 한도 -10)',
    intro: [
      { speaker: 'narration', text: '교환 거점 입구에서 상자를 잔뜩 쌓은 손수레를 끄는 남자가 손을 든다.' },
      { speaker: 'yoo_sangcheol', text: '유상철이오. 공항까지 갑시다. 짐이 좀 많지만, 이게 다 길에서 돈이 되는 물건이오.' }
    ],
    observed: ['교환품 상자 여럿 (식량 보관 10칸 차지)', '상인 무리 완장', '합류를 원한다'],
    opinion: { speaker: 'park_seoyun', text: '식량 칸을 열 칸이나 쓰면… 그래도 상인 쪽 연줄은 생기겠네요.' },
    interview: ['상인 무리 소속. 공항 앞 교환 거점에 들러 물건을 넘겨야 한다고 한다 (부탁)', '말에 앞뒤가 맞는다. 계산이 빠르다'],
    inspect: { results: ['상자: 배터리, 공구, 담배, 통조림 약간', '상처나 물린 자국은 없다'], grumble: '"물건 흐트러뜨리지 마쇼."' },
    acceptLine: '좋소. 손해 볼 일은 없을 거요.'
  },
  // 이수아의 부탁에 나오는 환자 (임시 인물): 부탁을 맡았을 때만 주거 약국 거리 의원 대기실에 있다
  sua_patient: {
    who: ['nam_gyuhyun'], kind: 'temp', dest: 'dt_clinic', destText: '도심 진료소', where: 'res_pharm', pos: { x: 56, y: 64 },
    needsRequest: 'sua_patient', fulfills: 'sua_patient',
    title: '의원 대기실의 환자',
    purpose: '도심 진료소까지 데려다 달라고 한다 (이수아의 부탁)',
    condition: '없음 · 도심 진료소에서 내린다',
    intro: [
      { speaker: 'narration', text: '의원 대기실 의자에 다리를 붕대로 감은 남자가 누워 있다.' },
      { speaker: 'nam_gyuhyun', text: '이수아 간호사님이 보내셨어요? …진료소까지만 부탁드려요.' }
    ],
    observed: ['다리를 다쳐 걷기 힘들다', '붕대는 깨끗하다. 물린 상처는 아니라고 한다', '도심 진료소까지 (좌석 1개)'],
    opinion: { speaker: 'lee_sua', text: '제가 두고 온 환자예요. 진료소까지만 데려다주면 돼요.' },
    interview: ['공사장에서 다리를 다쳤다고 한다. 이수아와 이야기가 맞는다'],
    inspect: { results: ['다리의 골절 부목', '물린 자국은 없다'] },
    acceptLine: '감사합니다…',
    farewell: [{ speaker: 'go_eunyoung', text: '이수아 간호사가 말한 환자군요. 여기서 맡을게요.' }]
  }
});

LS.PEOPLE_RULES = {
  supportFood: 2,          // 물자만 나눠 줄 때 식량 (임시값)
  meetHours: [8, 19],      // 2~3일째 도로변 두 사람이 다가오는 시간대 (임시값)
  driveLimitMin: 8 * 60    // 한정수 합류 조건: 하루 운전 8시간
};
