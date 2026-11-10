// 식사·결핍·신선도·식중독 (10장)
window.LS = window.LS || {};

LS.Meals = (function () {
  const R = () => LS.Rules;
  const C = () => LS.CONFIG;

  function freshTotal(state) { return state.resources.fresh.reduce((a, b) => a + b.amount, 0); }

  // 보관 한도 안에서 식량을 넣는다. 신선식품은 신선도 100에서 시작
  function addFood(state, amount, freshRatio) {
    const r = state.resources;
    const room = Math.max(0, r.foodCap - LS.State.foodTotal(state));
    const stored = Math.min(room, amount);
    const fresh = Math.round(stored * freshRatio);
    r.food += stored - fresh;
    if (fresh > 0) r.fresh.push({ amount: fresh, freshness: 100 });
    return stored;
  }

  // 일반 보관 48시간에 0. 냉장(6단계 설비 + 엔진 켬)이면 96시간
  function fridgeOn(state) {
    return state.bus.engineOn && state.bus.facilities.some((f) => f && f.id === 'fridge');
  }

  function decay(state, minutes) {
    const hours = fridgeOn(state) ? C().food.freshDecayHoursFridge : C().food.freshDecayHours;
    const rate = 100 / hours;
    state.resources.fresh.forEach((b) => { b.freshness = Math.max(0, b.freshness - rate * minutes / 60); });
  }

  // 낮은 신선도부터 자동 소비 (신선식품을 먼저, 그다음 보존식)
  function take(state, amount) {
    const r = state.resources;
    const portions = [];
    let need = amount;
    r.fresh.sort((a, b) => a.freshness - b.freshness);
    for (const b of r.fresh) {
      if (need <= 1e-9) break;
      const use = Math.min(b.amount, need);
      b.amount -= use;
      need -= use;
      portions.push({ amount: use, freshness: b.freshness });
    }
    r.fresh = r.fresh.filter((b) => b.amount > 1e-9);
    if (need > 1e-9) {
      const use = Math.min(r.food, need);
      r.food -= use;
      portions.push({ amount: use, freshness: null });
    }
    return portions;
  }

  // 간호사(의료 전문)가 일행에 있으면 식중독 기간이 줄어든다 (임시값)
  function hasMedic(state) { return state.crew.some((m) => LS.CHARACTERS[m.id].expert === 'medic'); }
  function poisonHours(state) { return C().food.poisonHours * (hasMedic(state) ? C().medic.poisonHoursFactor : 1); }

  function poisonChance(freshness) {
    for (const p of C().food.poison) if (freshness >= p.min) return p.chance;
    return C().food.poison[C().food.poison.length - 1].chance;
  }

  function need(state, key) { return state.crew.length * C().meal.rations[key].amount; }
  function feasible(state, key) { return LS.State.foodTotal(state) + 1e-9 >= need(state, key); }

  function deficitHp(deficit) {
    for (const d of C().meal.deficitHp) if (deficit >= d.min) return d.hp;
    return 0;
  }

  // 실제 식사
  function eat(state, key) {
    const ration = C().meal.rations[key];
    const poisoned = [];
    const hungry = [];
    state.crew.slice().forEach((m) => {
      const portions = ration.amount > 0 ? take(state, ration.amount) : [];
      const fresh = portions.filter((p) => p.freshness != null && p.amount > 0);
      if (fresh.length) {
        const f = Math.min(...fresh.map((p) => p.freshness));
        if (R().chance(poisonChance(f))) {
          m.poisonUntil = state.minute + poisonHours(state) * 60;
          poisoned.push(m);
          R().hurt(state, m, C().food.poisonHp, 0);
        }
      }
      m.deficit = R().clamp(m.deficit + ration.deficit, 0, 6);
      const hp = deficitHp(m.deficit);
      if (hp) { R().hurt(state, m, hp, 0); hungry.push(m); }
      if (ration.mental) R().addMental(m, ration.mental);
    });
    const left = R().round1(LS.State.foodTotal(state));
    LS.State.addLog(state, `${ration.label} 배급`, false, 'meal', `${R().round1(need(state, key) || 0)}인분 먹음 · 남은 식량 ${left}인분`);
    const out = [];
    if (hungry.length) {
      LS.State.addLog(state, `굶주림으로 HP가 줄었다`, true, 'body', `${hungry.map((m) => `${R().name(m.id)} (결핍 ${m.deficit})`).join(', ')}`);
    }
    if (poisoned.length) {
      const who = poisoned.map((m) => R().name(m.id)).join(', ');
      LS.State.addLog(state, `식중독: ${who}`, true, 'body', `HP -10 · ${poisonHours(state)}시간 동안 외부 작업 불가 · 기력 회복 절반${hasMedic(state) ? ' · 간호사가 돌봐서 빨리 낫는다' : ''}`);
      out.push({ stop: true, toast: `식중독: ${who} (HP -10, ${poisonHours(state)}시간 외부 작업 불가)`, important: true });
    }
    return out;
  }

  function rationChoices(state, keepPolicy) {
    return Object.keys(C().meal.rations).map((key) => {
      const r = C().meal.rations[key];
      const ok = feasible(state, key);
      const effect = key === 'normal' ? '결핍 -1' : `정신력 ${r.mental}, 결핍 +${r.deficit}`;
      return {
        label: `${r.label} (1인 ${r.amount}인분)`,
        desc: ok ? `총 ${R().round1(need(state, key))}인분 · ${effect}` : '식량이 모자란다',
        disabled: !ok,
        run: (s) => {
          if (!keepPolicy) s.mealPolicy = key;
          eat(s, key).forEach((i) => { if (i.toast) LS.UI.toast(i.toast); });
        }
      };
    });
  }

  function policyEvent(state) {
    return {
      title: '첫 배급',
      lines: [
        { speaker: 'narration', text: `${LS.Clock.timeLabel(state.minute)}. 첫 정규 식사 시간이다.` },
        { speaker: 'park_seoyun', text: `식량이 ${R().round1(LS.State.foodTotal(state))}인분이에요. 어떻게 나눌까요?` }
      ],
      observations: [
        `인원 ${state.crew.length}명 · 정상 배급이면 한 끼 ${need(state, 'normal')}인분, 하루 ${need(state, 'normal') * 2}인분`,
        '반 배급도 세 번째 부족한 끼니부터 HP가 줄어든다',
        '정한 방식은 버스 내부의 [식량·배급]에서 바꿀 수 있다'
      ],
      choices: rationChoices(state, false)
    };
  }

  function shortageEvent(state) {
    const p = C().meal.rations[state.mealPolicy];
    return {
      title: '식량 부족',
      lines: [{ speaker: 'narration', text: `${p.label} 배급에 식량이 모자란다. (필요 ${R().round1(need(state, state.mealPolicy))}인분, 남은 ${R().round1(LS.State.foodTotal(state))}인분)` }],
      observations: ['이번 끼니만 가능한 배급을 고른다. 정한 방식은 그대로 유지된다.'],
      choices: rationChoices(state, true)
    };
  }

  // 정규 식사 시각에 호출된다
  function process(state) {
    if (!state.crew.length) return [];
    if (!state.mealPolicy) return [{ dialog: policyEvent(state) }];
    if (!feasible(state, state.mealPolicy)) return [{ dialog: shortageEvent(state) }];
    return eat(state, state.mealPolicy);
  }

  function discardSpoiled(state, below) {
    const r = state.resources;
    const thrown = r.fresh.filter((b) => b.freshness < below).reduce((a, b) => a + b.amount, 0);
    r.fresh = r.fresh.filter((b) => b.freshness >= below);
    if (thrown > 0) LS.State.addLog(state, '상한 신선식품을 버렸다', false, 'meal', `${R().round1(thrown)}인분`);
    return thrown;
  }

  return { addFood, decay, take, process, eat, freshTotal, need, feasible, poisonChance, discardSpoiled, fridgeOn };
})();
