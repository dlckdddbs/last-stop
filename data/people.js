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

LS.PEOPLE_RULES = {
  supportFood: 2,          // 물자만 나눠 줄 때 식량 (임시값)
  meetHours: [8, 19],      // 2~3일째 도로변 두 사람이 다가오는 시간대 (임시값)
  driveLimitMin: 8 * 60    // 한정수 합류 조건: 하루 운전 8시간
};
