// 결말 (24~25장): 공항 접수 · 마감 실패 · 특수 결말. 2026-11-25, 기말 피드백 2번.
window.LS = window.LS || {};

LS.Ending = (function () {
  const R = () => LS.Rules;
  const nm = (id) => LS.Rules.name(id);

  // 공항 대피 접수대에 도착했을 때 (Travel.landAt이 부른다). 접수하면 결말로 간다
  function arrivalEvent(state) {
    const names = state.crew.map((m) => nm(m.id)).join(', ');
    return {
      title: '공항 대피 접수대', screen: 'outside',
      lines: [
        { speaker: 'narration', text: '활주로 쪽에서 큰 엔진 소리가 울린다. 천막 아래 접수대 앞에 사람들이 줄지어 서 있다.' },
        { speaker: 'park_seoyun', text: '…도착했어요. 정말로요.' }
      ],
      observations: [
        `도착: ${LS.Clock.fullLabel(state.minute)} · 접수 마감까지 ${LS.Clock.remainingLabel(state.minute)}`,
        `함께 도착한 사람: ${names}`
      ],
      choices: [{
        label: '접수한다',
        run: () => setTimeout(() => LS.Time.handle([{ gameover: 'arrived' }]), 0),
        result: { lines: [{ speaker: 'narration', text: '접수대 직원이 버스에 탄 사람들의 이름을 하나씩 받아 적는다.' }] }
      }]
    };
  }

  return { arrivalEvent };
})();
