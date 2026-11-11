// 좀비 (14~15장): 정차하면 등장 판정 → 접근 → 경보·관측 → 숨기·떠나기·전투·버티기 → 포위. 물리면 감염 시계 (12장)
// 정찰·경보·직접 관측으로 알게 된 무리만 화면에 보인다. 모르는 무리는 기록에도 남기지 않는다.
window.LS = window.LS || {};

LS.Zombie = (function () {
  const R = () => LS.Rules;
  const C = () => LS.CONFIG;
  const Z = () => LS.CONFIG.zombie;
  const josa = (w, p) => LS.Rules.josa(w, p);
  const H = (min) => R().hoursLabel(Math.max(0, Math.round(min)));

  function z(state) { return state.zombie; }
  function sizeOf(key) { return Z().sizes[key]; }
  function sizeText(h) { return `${sizeOf(h.size).label} (${h.count}마리)`; }
  function pct(p) { return `${Math.round(p * 100)}%`; }
  function known(h) { return !!(h && (h.known || h.alarmed || h.warned)); }
  function region(state) { const loc = LS.State.location(state); return (loc && loc.region) || 'outskirts'; }
  function regionDef(state) { return Z().regions[region(state)] || Z().regions.outskirts; }

  // 버스 쪽에 있는가 (잠자리 건물에 간 사람은 떨어져 있다)
  function taskOf(state, m) { return m.task ? LS.Tasks.find(state, m.task) : null; }
  function atBus(state, m) { const t = taskOf(state, m); return !(t && t.type === 'shelter'); }
  function sleeping(state, m) { const t = taskOf(state, m); return !!(t && LS.Tasks.DEF[t.type].isSleep); }
  function busCrew(state) { return state.crew.filter((m) => atBus(state, m)); }
  function names(ms) { return ms.map((m) => R().name(m.id)).join('·'); }

  // 동료 의견을 말할 사람 (주인공이 아닌 사람 중 앞사람)
  function voice(state) {
    const o = state.crew.find((m) => m.id !== 'yoon_jaeha' && atBus(state, m));
    return o ? o.id : 'yoon_jaeha';
  }

  // ---------- 정차 ----------
  function nextDayBoundary(m) {
    const d0 = Math.floor(m / 1440) * 1440;
    return [d0 + C().dayStartHour * 60, d0 + C().nightStartHour * 60, d0 + 1440 + C().dayStartHour * 60].find((t) => t > m);
  }

  // 도착·도로 위 정차·돌고 돌아옴 때 부른다. 30분 뒤 첫 판정
  function beginStop(state) {
    state.stop = { since: state.minute, nextRoll: state.minute + Z().stopMin };
    const zz = z(state);
    if (!zz.pursuit) return;
    const p = zz.pursuit;
    zz.pursuit = null;
    if (state.minute - p.departedAt < 60 && !zz.horde) {
      // 1시간 미만으로 움직였으면 같은 무리가 따라온다 (15장 추격)
      p.horde.arriveAt = Math.max(state.minute + Z().seeMin, p.horde.arriveAt);
      p.horde.seeDone = p.horde.seeDone && p.horde.arriveAt - Z().seeMin <= state.minute;
      zz.horde = p.horde;
      if (known(p.horde)) LS.State.addLog(state, '무리가 따라왔다', true, 'event', `약 ${H(p.horde.arriveAt - state.minute)} 뒤 도착 · 1시간 넘게 움직여야 떨칠 수 있다`);
    } else if (known(p.horde)) {
      LS.State.addLog(state, '무리를 떨쳐냈다', false, 'event', '1시간 넘게 움직였다');
    }
  }

  // 출발할 때: 밤 떠나기 대가, 포위 돌파 피해, 추격 기록. 알림 문구 목록을 돌려준다
  function onDepart(state, driverId) {
    const zz = z(state);
    const b = state.bus;
    const toasts = [];
    if (zz.leaveCost) {
      b.durability = Math.max(0, b.durability - zz.leaveCost);
      LS.State.addLog(state, '어둠 속에서 급히 떠났다', true, 'travel', `내구도 -${zz.leaveCost}`);
      toasts.push(`급히 떠나느라 버스가 긁혔다 (내구도 -${zz.leaveCost}).`);
      zz.leaveCost = 0;
    }
    if (zz.siege && zz.breakout) {
      const S = sizeOf(zz.siege.size);
      const dmg = R().randInt(Z().breakout[0], Z().breakout[1]);
      b.durability = Math.max(0, b.durability - dmg);
      // 사고 1회 (07장 운전 표: 경미 70 · 부상 25 · 큰 사고 5)
      const sev = R().pickWeighted(C().mistake.severity);
      const driver = R().member(state, driverId);
      let acc = '큰 탈 없이 빠져나왔다';
      if (sev === 'injury' && driver) { R().hurt(state, driver, -5, C().shock.minorInjury); acc = `${josa(R().name(driver.id), '이가')} 핸들에 부딪혔다 (HP -5)`; }
      if (sev === 'major') {
        b.durability = Math.max(0, b.durability - 10);
        const others = state.crew.filter((m) => m.id !== driverId);
        const v = others.length ? R().pick(others) : driver;
        if (v) R().hurt(state, v, -10, C().shock.majorInjury);
        acc = `버스가 크게 흔들렸다 (내구도 -10${v ? `, ${R().name(v.id)} HP -10` : ''})`;
      }
      LS.State.addLog(state, '포위를 뚫고 나왔다', true, 'event', `${S.label} 무리 · 내구도 -${dmg} · ${acc}`);
      toasts.push(`포위를 뚫었다! 내구도 -${dmg} · ${acc}`);
      zz.siege = null;
    }
    zz.breakout = false;
    state.stop = null;
    if (zz.horde) { zz.pursuit = { horde: zz.horde, departedAt: state.minute }; zz.horde = null; }
    return toasts;
  }

  // ---------- 등장 판정 (14장 ①·③) ----------
  function spawnChance(state) {
    // 대피소에 묵는 동안은 버스도 담장 안에 있다 (5단계 [해석])
    if (LS.Factions && LS.Factions.safeStop(state)) return { p: 0, night: LS.Clock.isNight(state.minute), base: 0, refuge: true };
    const reg = regionDef(state);
    let base = reg.chance;
    if (reg.lateDay && LS.Clock.day(state.minute) >= reg.lateDay) base = reg.lateChance;
    // 1~3일째 밤에는 멈춘 버스의 밤 사건이 없다 (03장). 3일째 밤이 끝나는 4일째 06시까지.
    // 낮에 나왔어도 도착이 그 밤에 걸리면 나오지 않는다 (예: 19시 등장 → 0시 도착)
    const protectEnd = 3 * 1440 + C().dayStartHour * 60;
    if (!LS.Clock.isNight(state.minute)) {
      const arrive = state.minute + Z().approachMin;
      if (arrive < protectEnd && LS.Clock.isNight(arrive)) return { p: 0, night: false, base, protectedNight: true };
      return { p: base, night: false, base };
    }
    if (state.minute < protectEnd) return { p: 0, night: true, base, protectedNight: true };
    // 밤 보정: 마지막 밤 등장 후 1일차 0% · 2일차 기본 · 3일차 +25%p · 4일차 확정 (날은 자정에 바뀐다)
    const d = LS.Clock.rolloverIndex(state.minute) - z(state).lastNightIdx + 1;
    const p = d <= 1 ? 0 : d === 2 ? base : d === 3 ? Math.min(1, base + Z().nightBonusDay3) : 1;
    return { p, night: true, base, nightDay: d };
  }

  function roll(state, out) {
    const zz = z(state);
    const c = spawnChance(state);
    const hit = !zz.horde && !zz.siege && R().chance(c.p);
    zz.history.push({ at: state.minute, p: Math.round(c.p * 100), night: c.night, nightDay: c.nightDay, hit });
    if (zz.history.length > 60) zz.history.shift();
    if (hit) spawn(state, c.night, out);
  }

  function spawn(state, night, out) {
    const size = R().pick(regionDef(state).sizes);
    const S = sizeOf(size);
    const place = LS.State.place(state);
    const h = {
      size, count: R().randInt(S.count[0], S.count[1]),
      spawnedAt: state.minute, arriveAt: state.minute + Z().approachMin, night,
      detected: !night,                                          // 낮에는 멀리서 보고 온다 (발각 확정)
      coming: night ? R().chance(Z().nightApproach) : true,      // 미발각 밤 무리는 45%만 30분 거리까지 온다
      known: !!(place && place.scouted),                          // 정찰(경보 함정)이 있으면 존재를 안다
      alarmed: false, warned: false, halved: false, hide: null, alarmDone: false, seeDone: false
    };
    z(state).horde = h;
    if (night) z(state).lastNightIdx = LS.Clock.rolloverIndex(state.minute);
    if (h.known) {
      LS.State.addLog(state, '경보 함정: 무리의 기척', true, 'event', `이쪽으로 오고 있다 · 약 ${H(h.arriveAt - state.minute)} 거리 · 규모 모름`);
      out.push({ stop: true, toast: `정찰한 쪽에서 무리의 기척. 이쪽으로 오고 있다 (약 ${H(h.arriveAt - state.minute)}, 규모 모름).`, important: true });
    }
  }

  // ---------- 엔진 규칙 ② (v3.3 이후 결정) ----------
  // 2시간 거리 안의 무리가 엔진 소리를 들으면 발각되고, 도착까지 남은 시간이 절반이 된다
  function engineHeard(state, out) {
    const h = z(state).horde;
    if (!h || h.halved || state.travel || !state.bus.engineOn) return;
    const left = h.arriveAt - state.minute;
    if (left > Z().alarmMin) return;
    h.detected = true; h.coming = true; h.halved = true; h.hide = null;
    h.arriveAt = state.minute + Math.ceil(left / 2);
    if (known(h)) {
      LS.State.addLog(state, '엔진 소리에 무리가 발각했다', true, 'event', `도착까지 남은 시간이 절반 (약 ${H(h.arriveAt - state.minute)})`);
      out.push({ stop: true, toast: `엔진 소리를 들은 무리가 서두른다. 약 ${H(h.arriveAt - state.minute)} 뒤 도착.`, important: true });
    }
  }

  function onEngine(state) { const out = []; engineHeard(state, out); return out; }

  // ---------- 알아채기 ----------
  function canSee(state, h) {
    if (h.alarmed) return true;                                   // 경보를 듣고 깨어 지켜보는 중
    if (LS.Tasks.watchers(state) >= 2) return true;               // 경계 2명은 밤에도 30분 전에 알아챈다
    if (LS.Clock.isNight(state.minute)) return false;             // 밤에는 도착할 때까지 모른다
    return busCrew(state).some((m) => !sleeping(state, m));       // 낮에는 버스 쪽에 깨어 있는 사람이 본다
  }

  // 경보·관측이 오면 버스 옆 침낭에서 자던 사람은 깬다
  function wakeCampers(state) {
    state.tasks.filter((t) => t.type === 'camp').forEach((t) => LS.Tasks.abort(state, t.id));
  }

  // ---------- 부상 판정·물림·감염 ----------
  function exposeRoll(state, m, biteP, injuryP) {
    const parts = [];
    if (R().chance(injuryP == null ? Z().injuryChance : injuryP)) { R().hurt(state, m, Z().injuryHp, C().shock.minorInjury); parts.push(`다쳤다 (HP ${Z().injuryHp})`); }
    if (R().member(state, m.id) && R().chance(biteP)) { infect(state, m); parts.push('물렸다 — 감염'); }
    return `${R().name(m.id)}: ${parts.length ? parts.join(', ') : '무사하다'}`;
  }

  // 잠자리 건물 안의 좀비 처리: 인원이 많을수록 1인당 위험이 낮다 (1명 높음 · 2명 보통 · 3명 이상 거의 없음)
  function clearRisk(n) { return Z().clearRisk.find((r) => n >= r.min) || Z().clearRisk[Z().clearRisk.length - 1]; }
  function clearRoll(state, team) {
    const r = clearRisk(team.length);
    return team.map((m) => exposeRoll(state, m, r.bite, r.injury));
  }
  function clearRiskText(n) {
    const r = clearRisk(n);
    return `${n}명이면 1인당 부상 ${pct(r.injury)} · 물림 ${pct(r.bite)}`;
  }

  function infect(state, m) {
    if (m.infectedAt != null) return;
    const I = C().infection;
    m.infectedAt = state.minute;
    LS.State.addLog(state, `${josa(R().name(m.id), '이가')} 물렸다`, true, 'body', `감염 확정 · ${I.feverH}시간 뒤 발열, ${I.worseH}시간 뒤 악화, ${I.turnH}시간에 전환 (해독제는 이후 단계)`);
  }

  // ---------- 떠나기 ----------
  function leaveBlock(state) {
    if (state.tasks.some((t) => t.type === 'shelter')) return '잠자리 건물에 간 사람이 돌아와야 떠날 수 있다';
    if (state.bus.durability <= 0) return '버스가 멈췄다 (내구도 0)';
    if (!state.crew.some((m) => R().canDrive(state, m))) return '운전할 수 있는 사람이 없다';
    if (state.resources.fuel <= 0) return '연료가 없다';
    return '';
  }

  // 밖에서 일하던 사람을 불러들인다 (잠자리 건물은 멀어서 바로 못 부른다)
  function recall(state) { state.tasks.slice().forEach((t) => { if (t.type !== 'shelter') LS.Tasks.abort(state, t.id); }); }

  function leave(state, kind, cost) {
    recall(state);
    if (kind === 'loop') {
      z(state).leaveCost = cost;
      const res = LS.Travel.departLoop(state);
      if (res.error) { z(state).leaveCost = 0; setTimeout(() => LS.UI.toast(res.error), 0); }
      else (res.toasts || []).forEach((t) => setTimeout(() => LS.UI.toast(t, { sticky: true }), 0));
      return;
    }
    z(state).leaveCost = cost;
    state.screen = 'map';
    setTimeout(() => LS.UI.toast('떠날 곳을 지도에서 고르세요. 1시간 넘게 움직여야 무리를 떨칠 수 있어요.', { sticky: true }), 0);
  }

  function leaveChoices(state, cost) {
    const block = leaveBlock(state);
    const loopBlock = block || LS.Travel.loopBlock(state);
    const costText = cost ? ` · 내구도 -${cost}` : '';
    const fuel = R().round1(C().fuel.drivePerHour * Z().loopMin / 60);
    return [
      {
        label: '떠난다 · 버스를 몰고 돌다 돌아오기',
        desc: loopBlock || `운전 ${H(Z().loopMin)} · 연료 ${fuel}단위 · 그사이 무리가 흩어진다 · 하던 일은 그대로 남는다${costText}`,
        disabled: !!loopBlock,
        run: (s) => leave(s, 'loop', cost),
        result: { lines: [{ speaker: 'narration', text: '모두 버스에 올랐다. 시동을 건다.' }] }
      },
      {
        label: '떠난다 · 다른 장소로',
        desc: block || `지도에서 고른다 · 1시간 넘게 움직이면 떨칠 수 있다${costText}`,
        disabled: !!block,
        run: (s) => leave(s, 'map', cost),
        result: { lines: [{ speaker: 'narration', text: '모두 버스에 올랐다. 어디로 갈지 정해야 한다.' }] }
      }
    ];
  }

  // ---------- 경보 함정 (2시간 전) ----------
  function alarmEvent(state, h) {
    const S = sizeOf(h.size);
    return {
      title: '경보 함정', screen: 'outside',
      lines: [
        { speaker: 'narration', text: '정찰 때 걸어 둔 깡통 줄이 덜그럭거린다. 무리가 2시간 거리까지 왔다.' },
        { speaker: voice(state), text: h.night ? '아직 우리를 봤는지는 모르겠어요. 그냥 지나갈 수도 있고요.' : '낮이에요. 저것들은 멀리서도 봐요. 이대로면 와요.' }
      ],
      observations: [
        `규모: ${sizeText(h)}`,
        `도착까지 약 ${H(h.arriveAt - state.minute)}`,
        h.night ? (h.detected ? '이미 우리를 알아챘다' : '밤: 우리를 봤는지 모른다 (지나갈 수도 있다)') : '낮: 무리는 멀리서도 본다. 버티면 포위된다',
        `버티면 포위 ${S.siegeH}시간 · 내구도 -${S.dmg}/시간`,
        '지금 떠나면 대가 없음 (1시간 넘게 움직여야 떨친다)',
        state.bus.engineOn ? '엔진이 켜져 있다: 2시간 안에서는 소리를 듣고 서두른다' : '엔진은 꺼져 있다'
      ],
      choices: leaveChoices(state, 0).concat([{
        label: '지켜본다',
        desc: '30분 거리에 오면 다시 정한다',
        result: { lines: [{ speaker: 'narration', text: '모두 깨어 창밖을 지켜본다.' }] }
      }])
    };
  }

  // ---------- 30분 전 (직접 관측) ----------
  function fighters(state) {
    return busCrew(state).filter((m) => !m.temp && !LS.CHARACTERS[m.id].child && R().canHeavy(state, m) && R().canOutside(state, m));   // 임시 동행·아이는 싸우지 않는다
  }

  function fightChoice(state, h) {
    const fs = fighters(state);
    const ok = h.size === 'small' && fs.length >= Z().fight.minCrew;
    return {
      label: '맞서 싸운다 (소규모 전투)',
      desc: h.size !== 'small' ? '소규모 무리만 상대할 수 있다'
        : !ok ? '싸울 수 있는 사람 2명 이상 필요 (기력 30 초과)'
          : `${names(fs)} · 무기 보관함의 무기로 ${Z().fight.minutes}분 · 각자 부상 판정, 물림 ${pct(Z().fight.bite)}`,
      disabled: !ok,
      resolve: (s) => {
        const team = fighters(s);
        const notes = team.map((m) => exposeRoll(s, m, Z().fight.bite));
        z(s).horde = null;
        LS.State.addLog(s, '무리와 싸웠다', true, 'event', `${sizeText(h)} · ${notes.join(' · ')}`);
        const alive = team.filter((m) => R().member(s, m.id));
        if (alive.length) LS.Tasks.start(s, 'fight', alive.map((m) => m.id), {});
        return { lines: notes.map((t) => ({ speaker: 'narration', text: t })).concat([{ speaker: 'narration', text: '무리를 정리했다. 숨을 고르며 주변을 치운다.' }]) };
      }
    };
  }

  function hideChoice(state, h, label, detectP, bait) {
    const zz = z(state);
    let block = '';
    if (zz.hidOnce) block = '지난번에 숨어서 넘겼다. 이번에는 확정 발각된다';
    if (!block && bait === 'food' && LS.State.foodTotal(state) < Z().baitFood) block = `식량이 ${Z().baitFood}인분 필요하다`;
    if (!block && bait === 'parts' && state.resources.parts < Z().baitParts) block = `부품이 ${Z().baitParts}개 필요하다`;
    return {
      label,
      desc: block || `발각 ${pct(detectP)} · 들키면 포위 · 엔진은 끈다${bait ? ' · 미끼는 버스에서 떨어진 곳에 둔다' : ''}`,
      disabled: !!block,
      run: (s) => {
        s.bus.engineOn = false;
        if (bait === 'food') LS.Meals.take(s, Z().baitFood);
        if (bait === 'parts') s.resources.parts -= Z().baitParts;
        h.hide = R().chance(detectP);   // true면 들킨다. 결과는 무리가 올 때 드러난다
        LS.State.addLog(s, bait ? '미끼를 두고 숨었다' : '엔진을 끄고 숨었다', false, 'event', bait === 'food' ? `식량 -${Z().baitFood}` : bait === 'parts' ? `부품 -${Z().baitParts}` : '');
      },
      result: { lines: [{ speaker: 'narration', text: bait ? '버스에서 떨어진 곳에 미끼를 두고 돌아왔다. 숨을 죽인다.' : '불을 끄고 숨을 죽인다. 버스 밖으로 발소리가 가까워진다.' }] }
    };
  }

  function stayChoice(state, h) {
    const S = sizeOf(h.size);
    return {
      label: '버스에서 버틴다',
      desc: `포위 ${S.siegeH}시간 · 내구도 -${S.dmg}/시간 · 버스 안 사람은 내구도가 남아 있으면 물리지 않는다`,
      result: { lines: [{ speaker: 'narration', text: '문을 잠그고 창을 막는다. 모두 버스 안으로.' }] }
    };
  }

  function seeEvent(state, h) {
    const S = sizeOf(h.size);
    const night = LS.Clock.isNight(state.minute);
    const zz = z(state);
    // 지난 30분 결정에서 숨어 넘겼다면 이번은 확정 발각 (15장)
    const forced = night && !h.detected && zz.hidOnce;
    if (forced) h.detected = true;
    const choices = leaveChoices(state, night ? Z().nightLeaveDurability : 0);
    if (night && !h.detected) {
      choices.push(hideChoice(state, h, '엔진을 끄고 숨는다', Z().hideDetect, null));
      choices.push(hideChoice(state, h, `미끼(식량 ${Z().baitFood}인분)를 두고 숨는다`, Z().baitDetect, 'food'));
      choices.push(hideChoice(state, h, `미끼(부품 ${Z().baitParts}개)를 두고 숨는다`, Z().baitDetect, 'parts'));
    } else {
      if (!night) choices.push(fightChoice(state, h));
      choices.push(stayChoice(state, h));
    }
    const out = state.tasks.filter((t) => LS.Tasks.DEF[t.type].outside && t.type !== 'shelter');
    return {
      title: '무리가 온다', screen: 'outside',
      lines: [
        { speaker: 'narration', text: night ? '어둠 너머로 질질 끄는 발소리. 무리가 30분 거리까지 왔다.' : `길 끝에 무리가 보인다. ${h.count}마리쯤. 30분이면 여기까지 온다.` },
        { speaker: voice(state), text: h.detected ? '이미 우리를 봤어요. 어떻게 할 거예요?' : '아직은 우리를 못 본 것 같아요.' }
      ],
      observations: [
        `규모: ${sizeText(h)} · 30분 뒤 도착`,
        h.detected ? (h.halved ? '엔진 소리를 듣고 우리를 알아챘다' : forced ? '이번에는 들킨다' : night ? '이미 우리를 알아챘다' : '이미 우리를 알아챘다 (낮에는 멀리서도 본다)') : '아직 우리를 알아채지 못했다',
        `버티면 포위 ${S.siegeH}시간 · 내구도 -${S.dmg}/시간 (지금 ${state.bus.durability})`,
        night ? `밤에 지금 떠나면 내구도 -${Z().nightLeaveDurability}` : '지금 떠나면 대가 없음',
        out.length ? `밖에서 일하던 사람은 떠날 때 불러들인다 (${out.map((t) => LS.Tasks.taskTitle(state, t)).join(', ')})` : '모두 버스 근처에 있다',
        forced ? '지난번에 숨어서 넘겼다: 이번에는 확정 발각 (숨기·미끼 소용없음)' : ''
      ].filter(Boolean),
      choices
    };
  }

  // ---------- 무리 도착 ----------
  function passBy(state, h, out) {
    z(state).horde = null;
    if (!known(h)) return;
    LS.State.addLog(state, '무리가 방향을 틀어 지나갔다', true, 'event', sizeText(h));
    out.push({ stop: true, toast: '무리가 방향을 틀어 멀리 지나갔다.' });
  }

  function arrive(state, h, out) {
    const zz = z(state);
    zz.horde = null;
    const S = sizeOf(h.size);
    const bus = busCrew(state);
    if (!bus.length) {
      // 모두 잠자리 건물에 있다: 빈 버스 곁을 지나간다
      LS.State.addLog(state, '무리가 빈 버스 곁을 지나갔다', false, 'event', `${S.label} · 모두 잠자리 건물에 있었다`);
      return;
    }
    // 버스 근처 밖에 있던 사람: 침낭에서 자던 사람, 밖에서 일하던 사람
    const exposed = bus.filter((m) => { const t = taskOf(state, m); return t && (t.type === 'camp' || LS.Tasks.DEF[t.type].outside); });
    let detected = h.detected;
    if (!detected) {
      if (h.hide != null) detected = h.hide;                       // 숨기 결정의 결과
      else if (exposed.length) detected = true;                    // 밖에서 자던 사람이 있으면 들킨다
      else detected = R().chance(Z().hideDetect);                  // 모두 버스 안에서 잠든 채 조용하면 숨기와 같은 판정 (해석)
    }
    if (!detected) {
      if (h.hide === false) zz.hidOnce = true;
      if (known(h)) {
        LS.State.addLog(state, '무리가 버스 곁을 지나갔다', true, 'event', `${sizeText(h)} · 들키지 않았다`);
        out.push({ stop: true, toast: '무리가 버스 곁을 스쳐 지나갔다. 들키지 않았다.', important: true });
      } else {
        LS.State.addLog(state, '밤사이 무리가 버스 곁을 지나갔다', false, 'event', '모두 잠들어 있었고, 들키지 않았다');
      }
      return;
    }
    // 들켰다: 밖에 있던 사람은 버스로 뛰어든다 (각자 부상 판정·물림)
    const notes = exposed.map((m) => exposeRoll(state, m, S.bite));
    exposed.forEach((m) => { const t = taskOf(state, m); if (t) LS.Tasks.abort(state, t.id); });
    startSiege(state, h, out, notes, !(h.warned || h.alarmed));
  }

  // ---------- 포위 (15장) ----------
  function startSiege(state, h, out, notes, surprised) {
    const S = sizeOf(h.size);
    const zz = z(state);
    zz.hidOnce = false;   // 발각되면 숨기 기록을 지운다
    zz.siege = { size: h.size, count: h.count, startedAt: state.minute, endsAt: state.minute + S.siegeH * 60, acc: 0, baitUsed: false, breached: false };
    if (S.siegeH >= 3) busCrew(state).forEach((m) => R().addMental(m, Z().siegeMental));   // 중·대규모 포위를 겪은 사람
    const ev = siegeEvent(state, notes, surprised);
    ev.logDetail = `${sizeText(h)} · ${S.siegeH}시간 · 내구도 -${S.dmg}/시간${notes.length ? ' · ' + notes.join(' · ') : ''}`;
    out.push({ dialog: ev });
  }

  function siegeChoices(state) {
    const s = z(state).siege;
    const S = sizeOf(s.size);
    const baitBlock = s.baitUsed ? '이미 미끼를 썼다' : s.size === 'large' ? '대규모 무리에는 통하지 않는다' : state.resources.parts < 1 ? '부품이 없다' : '';
    const driverOk = busCrew(state).some((m) => R().canDrive(state, m));
    const breakBlock = state.bus.durability <= 0 ? '버스가 멈췄다 (내구도 0)' : !driverOk ? '운전할 수 있는 사람이 없다' : state.resources.fuel <= 0 ? '연료가 없다' : '';
    return [
      { label: '버틴다', desc: `남은 ${H(s.endsAt - state.minute)} · 내구도 -${S.dmg}/시간`, result: { lines: [{ speaker: 'narration', text: '창을 두드리는 소리를 견딘다.' }] } },
      {
        label: '부품 1개를 미끼로 던진다',
        desc: baitBlock || '소리 나는 부품을 멀리 던진다 · 남은 포위 시간 절반',
        disabled: !!baitBlock,
        run: (s2) => {
          const sg = z(s2).siege;
          s2.resources.parts -= 1;
          sg.baitUsed = true;
          sg.endsAt = s2.minute + Math.ceil((sg.endsAt - s2.minute) / 2);
          LS.State.addLog(s2, '부품을 미끼로 던졌다', false, 'event', `부품 -1 · 남은 포위 ${H(sg.endsAt - s2.minute)}`);
        },
        result: { lines: [{ speaker: 'narration', text: '쇳덩이가 길 건너에서 요란하게 구른다. 무리 일부가 그쪽으로 돈다.' }] }
      },
      {
        label: '돌파한다',
        desc: breakBlock || `지도에서 방향을 고르면 출발 · 내구도 -${Z().breakout[0]}~${Z().breakout[1]} · 사고 1회`,
        disabled: !!breakBlock,
        run: (s2) => {
          z(s2).breakout = true;
          s2.screen = 'map';
          setTimeout(() => LS.UI.toast('돌파할 방향을 지도에서 고르세요. 출발하지 않으면 포위가 계속돼요.', { sticky: true }), 0);
        },
        result: { lines: [{ speaker: 'narration', text: '운전석에 앉는다. 어느 쪽으로 밀고 나갈지 정해야 한다.' }] }
      },
      { label: '무전으로 구조를 요청한다', desc: '가까운 집단과의 연락은 이후 단계 (5단계)', disabled: true }
    ];
  }

  function siegeEvent(state, notes, surprised) {
    const s = z(state).siege;
    const S = sizeOf(s.size);
    return {
      title: '포위', screen: 'outside',
      lines: [
        { speaker: 'narration', text: surprised ? '쾅. 버스 옆구리를 두드리는 소리에 모두 깼다. 무리다.' : '무리가 버스를 에워쌌다. 창마다 손바닥이 붙는다.' }
      ].concat(notes.map((t) => ({ speaker: 'narration', text: t }))),
      observations: [
        `규모: ${S.label} (${s.count}마리) · 포위 ${S.siegeH}시간`,
        `내구도 -${S.dmg}/시간 (지금 ${state.bus.durability})`,
        '버스 안 사람은 내구도가 0이 되기 전에는 물리지 않는다',
        '포위 중에는 밖에 나갈 수 없다',
        S.siegeH >= 3 ? `중·대규모 포위: 겪은 사람 정신력 ${Z().siegeMental}` : ''
      ].filter(Boolean),
      choices: siegeChoices(state)
    };
  }

  function damageBus(state, n, out) {
    const s = z(state).siege;
    const b = state.bus;
    b.durability = Math.max(0, b.durability - n);
    if (b.durability > 0 || s.breached) return;
    // 내구도 0: 침입. 버스 안 사람마다 부상 판정·물림
    s.breached = true;
    const notes = busCrew(state).map((m) => exposeRoll(state, m, sizeOf(s.size).bite));
    LS.State.addLog(state, '무리가 버스 안으로 들어왔다', true, 'body', `내구도 0 · ${notes.join(' · ')}`);
    out.push({ stop: true, toast: `내구도 0! 무리가 안으로 들어왔다. ${notes.join(' · ')}`, important: true });
  }

  function siegeTick(state, prev, next, out) {
    const s = z(state).siege;
    const S = sizeOf(s.size);
    const from = Math.max(prev, s.startedAt);
    const to = Math.min(next, s.endsAt);
    if (to > from) {
      s.acc += S.dmg * (to - from) / 60;
      const whole = Math.floor(s.acc + 1e-9);
      if (whole > 0) { s.acc -= whole; damageBus(state, whole, out); }
    }
    if (z(state).siege && next >= s.endsAt) {
      z(state).siege = null;
      z(state).breakout = false;
      LS.State.addLog(state, '무리가 흩어졌다', true, 'event', `포위 끝 · 내구도 ${state.bus.durability}`);
      out.push({ stop: true, toast: `무리가 흩어졌다. 포위가 끝났다 (내구도 ${state.bus.durability}).`, important: true });
    }
  }

  // ---------- 감염 시계 (12장) ----------
  function decideEvent(state, m) {
    const nm = R().name(m.id);
    const hero = m.id === 'yoon_jaeha';
    const sua = state.crew.some((o) => o.id === 'lee_sua') && m.id !== 'lee_sua';
    return {
      title: `${nm}의 감염 · 66시간`, screen: 'bus',
      lines: [
        { speaker: 'narration', text: `${josa(nm, '은는')} 열에 들떠 눈을 제대로 뜨지 못한다. 6시간 뒤면 돌아오지 못한다.` },
        { speaker: hero ? 'park_seoyun' : m.id, text: hero ? '재하 씨… 정해야 해요.' : '…저 아직 괜찮아요. 아직은요.' }
      ],
      observations: [
        '해독제가 있으면 완치 (해독제는 이후 단계에서 구할 수 있어요)',
        '격리 좌석: 좌석 하나를 쓰며 끝까지 함께 간다. 전환 때 다치는 사람 없이 작별한다',
        hero ? '스스로 내리면 남은 일행이 이어서 간다 (결말 판정은 7단계)' : '여기서 내려놓으면 함께한 사람들의 마음이 흔들린다',
        sua && !hero ? '이수아와 감염자를 버리지 않기로 약속했다 (합류 조건, 4단계에서 적용)' : ''
      ].filter(Boolean),
      choices: [
        { label: '해독제를 쓴다', desc: '해독제가 없다 (이후 단계)', disabled: true },
        {
          label: '격리 좌석으로 끝까지 함께 간다',
          run: (s) => { const mm = R().member(s, m.id); if (mm) mm.isolated = true; LS.State.addLog(s, `${nm}: 격리 좌석`, true, 'body', '끝까지 함께 간다'); },
          result: { lines: [{ speaker: 'narration', text: '뒤쪽 좌석 하나를 비워 담요를 깔았다.' }] }
        },
        { label: '대피소에 맡긴다', desc: '대피소·집단은 이후 단계', disabled: true },
        hero ? {
          label: '스스로 내린다',
          run: () => setTimeout(() => LS.Time.handle([{ gameover: 'selfExit' }]), 0),
          result: { lines: [{ speaker: 'yoon_jaeha', text: '여기까지야. 공항까지는… 너희가 가.' }] }
        } : {
          label: '여기서 내려놓는다',
          run: (s) => {
            LS.State.killMember(s, m.id, 'left');
            if (sua) setTimeout(() => LS.Time.handle(LS.People.violation(s, 'lee_sua', `감염된 ${josa(nm, '을를')} 내려놓았다`)), 0);   // 이수아 합류 조건
            s.crew.forEach((o) => R().addMental(o, -3));   // 임시값: 위험 하차 충격 (기획서 -3~-8)
            LS.State.addLog(s, `${josa(nm, '을를')} 내려놓았다`, true, 'event', `감염 66시간 · 모두 정신력 -3${sua ? ' · 이수아와의 약속을 어겼다 (4단계에서 적용)' : ''}`);
          },
          result: { lines: [{ speaker: 'narration', text: `${josa(nm, '은는')} 고개를 끄덕였다. 문이 닫힌다.` }] }
        }
      ]
    };
  }

  function turn(state, m, out) {
    const nm = R().name(m.id);
    if (m.id === 'yoon_jaeha') { out.push({ gameover: 'heroTurned' }); return; }
    LS.State.killMember(state, m.id, 'turned');
    LS.State.addLog(state, `${josa(nm, '와과')}의 작별`, true, 'body', '감염 72시간 · 전환 · 모두 정신력 -15');
    out.push({
      dialog: {
        title: '작별', screen: 'bus',
        lines: [
          { speaker: 'narration', text: `격리 좌석의 숨소리가 멎었다. ${josa(nm, '은는')} 끝까지 함께 왔다.` },
          { speaker: 'narration', text: '아무도 다치지 않게, 조용히 작별했다.' }
        ],
        choices: [{ label: '계속 간다' }]
      }
    });
  }

  function infectionTick(state, prev, next, out) {
    const I = C().infection;
    state.crew.slice().forEach((m) => {
      if (m.infectedAt == null) return;
      const at = (h) => m.infectedAt + h * 60;
      const nm = R().name(m.id);
      if (prev < at(I.feverH) && next >= at(I.feverH)) {
        const t = taskOf(state, m);
        if (t && LS.Tasks.DEF[t.type].outside && t.type !== 'shelter') LS.Tasks.abort(state, t.id);
        LS.State.addLog(state, `${nm}: 감염 발열`, true, 'body', '외부 작업 불가 · 기력 회복 절반');
        out.push({ stop: true, toast: `${josa(nm, '이가')} 열이 오른다 (감염 발열: 외부 작업 불가).`, important: true });
      }
      if (prev < at(I.worseH) && next >= at(I.worseH)) {
        const t = taskOf(state, m);
        if (t && !LS.Tasks.DEF[t.type].isSleep) LS.Tasks.abort(state, t.id);
        LS.State.addLog(state, `${nm}: 감염 악화`, true, 'body', '모든 작업 불가 · 누워 있어야 한다');
        out.push({ stop: true, toast: `${josa(nm, '이가')} 일어나지 못한다 (감염 악화).`, important: true });
      }
      if (prev < at(I.decideH) && next >= at(I.decideH) && !m.isolated) out.push({ dialog: decideEvent(state, m) });
      if (next >= at(I.turnH) && R().member(state, m.id)) turn(state, m, out);
    });
  }

  // ---------- 매 진행 구간 ----------
  function advance(state, prev, next) {
    const out = [];
    const zz = z(state);
    if (state.stop && !state.travel) {
      while (state.stop && state.stop.nextRoll <= next) {
        const at = state.stop.nextRoll;
        roll(state, out);
        state.stop.nextRoll = nextDayBoundary(at);   // 오래 머물면 낮·밤이 바뀔 때마다 다시 판정 (해석)
      }
    }
    const h = zz.horde;
    if (h) {
      engineHeard(state, out);
      if (!h.alarmDone && next >= h.arriveAt - Z().alarmMin) {
        h.alarmDone = true;
        const place = LS.State.place(state);
        if (place && place.scouted) { h.alarmed = true; wakeCampers(state); out.push({ dialog: alarmEvent(state, h) }); }
      }
      if (zz.horde === h && !h.seeDone && next >= h.arriveAt - Z().seeMin) {
        h.seeDone = true;
        if (!h.coming) passBy(state, h, out);
        else if (canSee(state, h)) { h.warned = true; wakeCampers(state); out.push({ dialog: seeEvent(state, h) }); }
      }
      if (zz.horde === h && next >= h.arriveAt) arrive(state, h, out);
    }
    if (zz.siege) siegeTick(state, prev, next, out);
    infectionTick(state, prev, next, out);
    return out;
  }

  // 시간 진행이 정확히 멈춰야 할 다음 시각까지 남은 분
  function nextMilestone(state) {
    const m = state.minute;
    const zz = z(state);
    const c = [];
    if (state.stop && !state.travel) c.push(state.stop.nextRoll);
    const h = zz.horde;
    if (h) {
      if (!h.alarmDone) c.push(h.arriveAt - Z().alarmMin);
      if (!h.seeDone) c.push(h.arriveAt - Z().seeMin);
      c.push(h.arriveAt);
    }
    if (zz.siege) c.push(zz.siege.endsAt);
    const I = C().infection;
    state.crew.forEach((mm) => {
      if (mm.infectedAt == null) return;
      [I.feverH, I.worseH, I.decideH, I.turnH].forEach((hh) => c.push(mm.infectedAt + hh * 60));
    });
    const f = c.filter((t) => t > m);
    return f.length ? Math.min(...f) - m : Infinity;
  }

  // '다음 상황까지'에 보여줄 것 (아는 것만)
  function nextKnown(state) {
    const zz = z(state);
    if (zz.siege) return { at: zz.siege.endsAt, label: '포위 끝', busy: true };
    const h = zz.horde;
    if (known(h)) {
      const pts = [];
      if (!h.alarmDone) pts.push({ at: h.arriveAt - Z().alarmMin, label: '경보 (무리 2시간 거리)' });
      if (!h.seeDone) pts.push({ at: h.arriveAt - Z().seeMin, label: '무리 30분 거리' });
      pts.push({ at: h.arriveAt, label: '무리 도착' });
      const f = pts.filter((p) => p.at > state.minute).sort((a, b) => a.at - b.at);
      if (f.length) return f[0];
    }
    return null;
  }

  // 위쪽 바·장면에 보여줄 상태 (아는 것만)
  function status(state) {
    const zz = z(state);
    if (zz.siege) {
      const S = sizeOf(zz.siege.size);
      return { level: 'danger', text: `포위 중 · ${S.label} ${zz.siege.count}마리 · 남은 ${H(zz.siege.endsAt - state.minute)} · 내구도 -${S.dmg}/시간` };
    }
    const h = zz.horde;
    if (known(h)) {
      const size = h.alarmed || h.warned ? sizeOf(h.size).label : '규모 모름';
      return { level: h.arriveAt - state.minute <= Z().alarmMin ? 'danger' : 'warn', text: `무리 · 약 ${H(h.arriveAt - state.minute)} · ${size}` };
    }
    return null;
  }

  function siegeActive(state) { return !!z(state).siege; }

  // 소음(바리케이드 돌파 등)으로 근처 무리가 확정 접근한다. 발각 상태로, 도착 시각을 안다
  function forceHorde(state, minutes, why) {
    const zz = z(state);
    if (zz.horde || zz.siege || state.travel) return '';
    const size = R().pick(regionDef(state).sizes);
    const S = sizeOf(size);
    zz.horde = {
      size, count: R().randInt(S.count[0], S.count[1]),
      spawnedAt: state.minute, arriveAt: state.minute + minutes, night: LS.Clock.isNight(state.minute),
      detected: true, coming: true, known: true,
      alarmed: false, warned: false, halved: false, hide: null, alarmDone: false, seeDone: false
    };
    LS.State.addLog(state, `${why}: 무리가 다가온다`, true, 'event', `약 ${H(minutes)} 뒤 도착 · 떠나면 떨쳐낼 수 있다`);
    return `${why}에 근처 무리가 이쪽으로 온다 (약 ${H(minutes)})`;
  }

  // 주변 정찰을 마쳤을 때: 정찰은 근처 무리도 확인한다 (06장). 이미 오고 있는 무리가 있으면 알게 된다
  function onScouted(state) {
    const h = z(state).horde;
    if (!h || h.known) return '';
    h.known = true;
    return h.coming ? `근처에 무리가 있다 · 이쪽으로 오고 있다 (약 ${H(h.arriveAt - state.minute)}, 규모 모름)` : '근처에 무리가 있다 (규모 모름)';
  }

  return {
    beginStop, onDepart, advance, nextMilestone, nextKnown, status, onEngine, siegeActive, siegeChoices, onScouted,
    exposeRoll, infect, spawnChance, leaveBlock, sizeOf, clearRoll, clearRisk, clearRiskText, forceHorde
  };
})();
