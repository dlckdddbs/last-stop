// 작업 배치 (07장): 외부 확인·정찰·파밍·장애물 제거·잠자리(건물·침낭·환자용 침상)·경계·회복 대화
// 모든 작업은 '배정'만 하고, 시간은 플레이어가 흘린다. 실수는 시작할 때 한 번 판정해 저장하고 작업의 절반을 넘기면 적용한다.
window.LS = window.LS || {};

LS.Tasks = (function () {
  const R = () => LS.Rules;
  const C = () => LS.CONFIG;
  const josa = (w, p) => LS.Rules.josa(w, p);
  let seq = 1;
  let watchersAtStart = 0;   // 이번 진행 구간이 시작될 때 경계를 서던 인원

  // crew: 필요한 인원 (multi면 그 이상 가능). timed: 시간을 정해 두는 일 (잠·경계). isSleep: 깊은 잠 보너스 대상
  const DEF = {
    check_outside:   { label: '외부 확인',       crew: 1, minutes: 10,  outside: true, noSlow: true,
                       help: '창밖에서 선반이 비었는지 확인해요. 비어 있으면 긴 수색 없이 떠날 수 있어요.' },
    scout_area:      { label: '주변 정찰',       crew: 2, minutes: 60,  drain: 'scout', mistake: 'scout', heavy: true, outside: true,
                       help: '주변 건물과 보급 가능성, 근처 무리를 확인하고 경보 함정을 설치해요. 정찰한 곳에서는 침낭으로 자도 안전해요.' },
    scout_route:     { label: '경로 정찰',       crew: 1, minutes: 120, drain: 'scout', mistake: 'scout', heavy: true, outside: true,
                       help: '이 길의 차단과 우회로를 미리 확인해요. 도로 사건 40% → 20%.' },
    farm:            { label: '파밍',            crew: 2,               drain: 'heavy', mistake: 'farm', heavy: true, outside: true,
                       help: '건물 안을 뒤져 물자를 가져와요. 끝까지 못 하면 한 만큼만 가져와요.' },
    remove_obstacle: { label: '장애물 조사·제거', crew: 2,               drain: 'heavy', mistake: 'obstacle', heavy: true, outside: true,
                       help: '길을 막은 잔해를 조사하고 치워요. 끝나면 지도에서 남은 구간을 이어갈 수 있어요.' },
    // 잠자리 건물: 가는 길+내부 확인(1시간) → 잠 → 버스로 돌아오기. 확인한 뒤에는 가는 길 → 잠 → 돌아오기
    shelter:         { label: '잠자리',          crew: 1, multi: true, outside: true, noWork: true, isSleep: true },
    camp:            { label: '침낭 수면',       crew: 1, multi: true, timed: true, rest: 'sleepBag', outside: false, noWork: true, isSleep: true,
                       help: '버스 옆에 침낭을 깔고 바로 자요. 기력 +3/시간. 정찰(경보 함정)이나 경계 2명이 없으면 자다가 습격받을 수 있어요.' },
    watch:           { label: '경계',            crew: 2, multi: true, timed: true, drain: 'light', outside: false,
                       help: '2명 이상이 깨어서 망을 봐요. 기력 -3/시간, 그동안 잘 수 없어요. 경계가 서 있으면 침낭으로 자도 안전해요.' },
    sleep_bed:       { label: '환자용 침상 수면', crew: 1, multi: true, timed: true, rest: 'sleepBed', outside: false, noWork: true, isSleep: true,
                       help: '버스 안 환자용 침상(1개)에 누워서 자요. 기력 +3/시간. 식중독·부상인 사람을 먼저 눕혀요.' },
    talk:            { label: '회복 대화',       crew: 2, minutes: 60,  outside: false, noSlow: true,
                       help: '두 사람이 1시간 이야기해요. 정신력이 낮은 쪽 +5, 상대 +2 (각자 하루 1회).' }
  };

  const PHASE = { check: '확인 중', walk: '가는 중', sleep: '자는 중', return: '돌아오는 중' };

  // 실수 결과 (07장 표)
  const SEVERITY = {
    scout:    { minor: { text: '소음을 냈다. 주변 위험이 커졌다.', noise: true }, injury: { hp: -5 }, major: { hp: -15 } },
    farm:     { minor: { text: '물자 일부를 잃었다. (20% 손실)', loss: 0.2 }, injury: { hp: -5 }, major: { hp: -15 } },
    obstacle: { minor: { text: '작업이 30분 늦어졌다.', delay: 30 },         injury: { hp: -8 }, major: { hp: -20 } }
  };

  function def(type) { return DEF[type]; }

  // 작업 속도: 기력 60 미만이 섞이면 느려진다. 대화·외부 확인처럼 가벼운 일은 예외 (2026-11-10)
  function speedOf(type, ms) { return DEF[type].noSlow || !ms.length ? 1 : R().speedFactor(ms); }
  function members(state, task) { return task.members.map((id) => R().member(state, id)).filter(Boolean); }
  function find(state, id) { return state.tasks.find((t) => t.id === id); }
  function names(ms) { return ms.map((m) => R().name(m.id)).join('·'); }
  function spotOf(state, task) {
    const place = LS.State.place(state, task.locId);
    return task.spotId && place ? place.spots[task.spotId] : null;
  }

  // 잠자리 건물 안을 확인할 사람: 고른 사람 중 기력이 가장 많고 밖에 나갈 수 있는 사람
  function checkerOf(state, ms) {
    const ok = ms.filter((m) => R().canHeavy(state, m) && R().canOutside(state, m));
    return ok.length ? ok.reduce((a, b) => (b.energy > a.energy ? b : a)) : null;
  }

  function watchers(state) { return state.tasks.filter((t) => t.type === 'watch').reduce((n, t) => n + members(state, t).length, 0); }

  // 침낭이 안전한가: 이 장소를 정찰했거나(경보 함정), 경계가 2명 이상 서 있다
  function campSafety(state) {
    const place = LS.State.place(state);
    if (place && place.scouted) return { safe: true, why: '정찰함 (경보 함정)' };
    const w = Math.max(watchersAtStart, watchers(state));
    if (w >= 2) return { safe: true, why: `경계 ${w}명` };
    return { safe: false, why: w === 1 ? '경계 1명 (2명 이상 필요)' : '정찰·경계 없음' };
  }

  // Sim이 매 진행 구간마다 작업보다 먼저 부른다 (경계가 이번 구간에 끝나도 그 구간은 지켜 준 것으로 친다)
  function beginStep(state) { watchersAtStart = watchers(state); }

  // ---------- 작업량 ----------
  function workMinutes(state, type, ids, opts) {
    const d = DEF[type];
    if (type === 'farm') {
      const spot = LS.State.place(state).spots[opts.spotId];
      return LS.SPOT_TYPES[spot.type].hours * 60;
    }
    if (type === 'remove_obstacle') {
      if (state.roadside && state.roadside.obstacleLeft != null) return state.roadside.obstacleLeft;
      const R2 = C().road;
      return R2.investigateMin + (ids.includes('yoon_jaeha') ? R2.removeMinFirefighter : R2.removeMin);
    }
    return d.minutes || 0;
  }

  // ---------- 가능 여부 ----------
  function validate(state, type, ids, opts) {
    const d = DEF[type];
    opts = opts || {};
    if (state.travel) return '이동 중에는 할 수 없다';
    if (!ids.length) return '인원을 고르세요';
    if (d.multi ? ids.length < d.crew : ids.length !== d.crew) return `${d.crew}명${d.multi ? ' 이상' : ''}이 필요하다`;
    const ms = ids.map((id) => R().member(state, id));
    if (ms.some((m) => !m)) return '없는 인원이 있다';
    const busy = ms.find((m) => m.task);
    if (busy) return `${josa(R().name(busy.id), '은는')} 다른 일을 하고 있다`;
    if (d.outside && !d.noWork) {
      const sick = ms.find((m) => !R().canOutside(state, m));
      if (sick) return `${josa(R().name(sick.id), '은는')} 밖에 나갈 수 없다 (${R().isPoisoned(state, sick) ? '식중독' : 'HP 낮음'})`;
    }
    if (d.heavy) {
      const tired = ms.find((m) => !R().canHeavy(state, m));
      if (tired) return `${R().name(tired.id)}의 기력이 부족하다 (30 이하)`;
    }
    const place = LS.State.place(state);
    const spot = opts.spotId && place ? place.spots[opts.spotId] : null;
    if (type === 'farm' || type === 'check_outside') {
      if (!spot || !LS.SPOT_TYPES[spot.type].loot) return '수색할 수 없는 곳이다';
      if (spot.checkedEmpty === true || (spot.farmedOnce && LS.World.isEmpty(spot))) return '비어 있다';
      if (type === 'check_outside' && (spot.farmedOnce || spot.checkedEmpty != null)) return '이미 확인했다';
    }
    if (type === 'shelter') {
      if (!spot || !spot.building || spot.absent) return '잘 곳이 없다';
      if (spot.building.checked && spot.building.threat) return '숨은 위협이 있어 쓸 수 없다';
      if (state.tasks.some((t) => t.type === 'shelter' && t.spotId === opts.spotId)) return '이미 그 건물에 가 있다';
      if (!spot.building.checked && !checkerOf(state, ms)) return '안을 확인할 사람이 없다 (기력 30 초과, 밖에 나갈 수 있어야 함)';
    }
    if (type === 'sleep_bed') {
      const n = LS.State.beds(state);
      const used = state.tasks.filter((t) => t.type === 'sleep_bed').reduce((k, t) => k + t.members.length, 0);
      if (ids.length + used > n) return `침상은 ${n}개뿐이다 (남은 침상 ${Math.max(0, n - used)}개)`;
    }
    if (type === 'scout_area' && place && place.scouted) return '이미 정찰했다';
    if (type === 'scout_route') {
      const info = state.routes[opts.routeKey];
      if (!info) return '갈 수 없는 길이다';
      if (info.known || info.traveled) return '이미 확인한 길이다';
      if (state.locationId === 'roadside') return '도로 위에서는 할 수 없다';
    }
    if (type === 'remove_obstacle' && !(state.roadside && state.roadside.blocked)) return '치울 장애물이 없다';
    return '';
  }

  // 모두 밖으로 나가게 되는가 (버스가 비면 엔진이 꺼진다)
  function wouldEmptyBus(state, type, ids) {
    if (!DEF[type].outside) return false;
    return state.crew.every((m) => ids.includes(m.id) || isOutside(state, m));
  }

  function isOutside(state, m) {
    if (!m.task) return false;
    const t = find(state, m.task);
    return !!(t && DEF[t.type].outside);
  }

  // ---------- 미리보기 (배정 화면 수치) ----------
  function preview(state, type, ids, opts) {
    const d = DEF[type];
    opts = opts || {};
    const reason = validate(state, type, ids, opts);
    const ms = ids.map((id) => R().member(state, id)).filter(Boolean);
    const out = { reason, minutes: 0, drain: 0, mistake: null, checker: null };
    if (type === 'shelter') { out.checker = checkerOf(state, ms); return out; }
    if (d.timed) {
      out.minutes = opts.hours ? opts.hours * 60 : 0;
      if (d.drain) out.drain = Math.round(-C().energy[d.drain] * out.minutes / 60);
      return out;
    }
    const base = workMinutes(state, type, ids, opts);
    out.minutes = Math.ceil(base / speedOf(type, ms));
    out.drain = d.drain ? Math.round(-C().energy[d.drain] * out.minutes / 60) : 0;
    if (d.mistake && ms.length) out.mistake = R().mistakeChance(ms, false);
    return out;
  }

  // ---------- 시작 ----------
  function start(state, type, ids, opts) {
    opts = opts || {};
    const reason = validate(state, type, ids, opts);
    if (reason) return { error: reason };
    const d = DEF[type];
    const ms = ids.map((id) => R().member(state, id));
    const task = {
      id: 't' + (seq++),
      type,
      members: ids.slice(),
      locId: state.locationId,
      spotId: opts.spotId || null,
      routeKey: opts.routeKey || null,
      startedAt: state.minute,
      workDone: 0,
      workTotal: workMinutes(state, type, ids, opts),
      endAt: d.timed ? state.minute + Math.round(opts.hours * 60) : null,
      outcome: null,
      victimIndex: 0
    };
    if (d.mistake) {
      task.outcome = R().rollOutcome(R().mistakeChance(ms, false));
      task.victimIndex = R().randInt(0, ms.length - 1);
      if (task.outcome === 'minor' && SEVERITY[d.mistake].minor.delay) task.workTotal += SEVERITY[d.mistake].minor.delay;
    }
    let detail = names(ms);
    if (type === 'shelter') {
      const spot = spotOf(state, task);
      task.walk = spot.walk;
      task.hours = opts.hours || 8;
      if (!spot.building.checked) {
        task.checker = checkerOf(state, ms).id;
        setPhase(task, 'check', state.minute);
        detail += ` · 확인: ${R().name(task.checker)}`;
      } else {
        setPhase(task, 'walk', state.minute);
      }
    }
    if (d.isSleep) ms.forEach((m) => { m.sleepStreak = 0; });
    state.tasks.push(task);
    ms.forEach((m) => { m.task = task.id; });
    LS.State.addLog(state, type === 'shelter' ? `${josa(spotLabel(state, task), '으로')} 자러 간다` : `${taskTitle(state, task)} 시작`, false, 'task', detail);
    updateBusPresence(state);
    return { task };
  }

  function setPhase(task, phase, now) {
    task.phase = phase;
    const len = phase === 'check' ? C().shelter.checkTotalMin : phase === 'sleep' ? task.hours * 60 : task.walk;
    task.phaseEnd = now + len;
  }

  function spotLabel(state, task) {
    const loc = LS.World.location(state, task.locId);
    const sp = loc && loc.spots.find((s) => s.id === task.spotId);
    return sp ? sp.label : DEF[task.type].label;
  }

  function taskTitle(state, task) {
    const d = DEF[task.type];
    if (task.type === 'shelter') return `${spotLabel(state, task)} 잠자리`;
    if (task.spotId) return `${spotLabel(state, task)} ${d.label}`;
    if (task.routeKey) {
      const other = task.routeKey.split('|').find((x) => x !== task.locId);
      return `${LS.LOCATIONS[other].name} 방향 ${d.label}`;
    }
    return d.label;
  }

  // 모두 밖에 나가면 버스가 비고 엔진은 꺼진다 (07장)
  function updateBusPresence(state) {
    if (state.travel) return;
    if (state.crew.every((m) => isOutside(state, m)) && state.bus.engineOn) {
      state.bus.engineOn = false;
      LS.State.addLog(state, '버스가 비어 엔진을 껐다.', false, 'system');
    }
  }

  // ---------- 진행 ----------
  // 깊은 잠: 안전하게 연속 6시간이면 정신력 +5, 연속 8시간이면 HP +5 (기획서 9쪽)
  function sleepBonus(state, m, dt) {
    const S = C().sleep;
    m.sleepStreak += dt;
    if (m.sleepStreak >= S.mentalHours * 60 && m.mental < 100 && state.minute - m.lastMentalSleep >= S.cooldownHours * 60) {
      m.lastMentalSleep = state.minute;
      R().addMental(m, S.mentalBonus);
      LS.State.addLog(state, `${R().name(m.id)}: 푹 잤다`, false, 'body', `연속 ${S.mentalHours}시간 수면 · 정신력 +${S.mentalBonus}`);
    }
    if (m.sleepStreak >= S.hpHours * 60 && m.hp < 100 && m.deficit === 0 && state.minute - m.lastHpSleep >= S.cooldownHours * 60) {
      m.lastHpSleep = state.minute;
      m.hp = Math.min(100, m.hp + S.hpBonus);
      LS.State.addLog(state, `${R().name(m.id)}: 몸이 조금 회복됐다`, false, 'body', `연속 ${S.hpHours}시간 수면 · HP +${S.hpBonus}`);
    }
  }

  function energyText(ms) { return `기력 ${ms.map((m) => `${R().name(m.id)} ${Math.round(m.energy)}`).join(', ')}`; }

  function advanceShelter(state, task, ms, prev, next) {
    const dt = next - prev;
    if (task.phase === 'check') {
      const ck = R().member(state, task.checker);
      if (ck) R().applyDrain(ck, C().energy.scout, dt);
    } else if (task.phase === 'sleep') {
      ms.forEach((m) => { R().applyRest(state, m, 'sleepBuilding', dt); sleepBonus(state, m, dt); });
    }
    if (next < task.phaseEnd - 1e-6) return [];
    const title = spotLabel(state, task);
    const spot = spotOf(state, task);
    if (task.phase === 'check') {
      spot.building.checked = true;
      if (spot.building.threat) {
        LS.State.addLog(state, `${title}: 숨은 위협`, true, 'task', `${josa(R().name(task.checker), '이가')} 확인 · 자지 않고 버스로 돌아온다 (위협 대응은 3단계)`);
        setPhase(task, 'return', next);
        return [{ stop: true, toast: `${title}: 안쪽에 숨은 위협이 있다. 자지 않고 돌아온다.`, important: true }];
      }
      LS.State.addLog(state, `${title}: 안전하다`, false, 'task', `${josa(R().name(task.checker), '이가')} 확인 · ${names(ms)} 잠듦 (${task.hours}시간)`);
      setPhase(task, 'sleep', next);
      ms.forEach((m) => { m.sleepStreak = 0; });
      return [{ toast: `${title}: 안전하다. ${josa(names(ms), '이가')} 잠들었다 (${task.hours}시간)` }];
    }
    if (task.phase === 'walk') {
      setPhase(task, 'sleep', next);
      ms.forEach((m) => { m.sleepStreak = 0; });
      return [];
    }
    if (task.phase === 'sleep') {
      setPhase(task, 'return', next);
      return [{ toast: `${title}: 일어났다. 버스로 돌아오는 중 (${task.walk}분)` }];
    }
    remove(state, task);
    LS.State.addLog(state, `${title}에서 돌아왔다`, false, 'task', energyText(ms));
    return [{ stop: true, toast: `${title}에서 돌아왔다 · ${energyText(ms)}` }];
  }

  // 침낭 습격 (임시 규칙): 안전하지 않은 동안 시간당 2%. 한 명 HP -15, 모두 정신력 -5, 다들 깬다
  function campRaid(state, task, ms, dt) {
    const K = C().camp;
    const p = 1 - Math.pow(1 - K.raidPerHour, dt / 60);
    if (!R().chance(p)) return null;
    const victim = R().pick(ms);
    R().hurt(state, victim, K.raidHp, C().shock.minorInjury);
    ms.forEach((m) => { if (m !== victim) R().addMental(m, K.raidMental); });
    remove(state, task);
    const text = `자다가 습격받았다! ${josa(R().name(victim.id), '이가')} 다쳤다 (HP ${K.raidHp})`;
    LS.State.addLog(state, text, true, 'body', `침낭 · 정찰도 경계도 없었다 · 모두 깼다 (정신력 ${K.raidMental}) · 임시 규칙`);
    return [{ stop: true, toast: `${text} · 모두 깼다.`, important: true }];
  }

  function advance(state, task, prev, next) {
    const d = DEF[task.type];
    const dt = next - prev;
    const ms = members(state, task);
    if (!ms.length) { remove(state, task); return []; }
    if (task.type === 'shelter') return advanceShelter(state, task, ms, prev, next);
    if (d.timed) {
      const safe = task.type !== 'camp' || campSafety(state).safe;
      ms.forEach((m) => {
        if (d.rest) R().applyRest(state, m, d.rest, dt);
        if (d.drain) R().applyDrain(m, C().energy[d.drain], dt);
        if (d.isSleep) { if (safe) sleepBonus(state, m, dt); else m.sleepStreak = 0; }
      });
      if (!safe) { const raid = campRaid(state, task, ms, dt); if (raid) return raid; }
      return next >= task.endAt - 1e-6 ? complete(state, task, 'done') : [];
    }
    task.workDone += dt * speedOf(task.type, ms);
    if (d.drain) ms.forEach((m) => R().applyDrain(m, C().energy[d.drain], dt));
    if (task.workDone >= task.workTotal - 1e-6) return complete(state, task, 'done');
    if (d.heavy && ms.some((m) => m.energy <= C().energy.heavyMin + 1e-6)) return complete(state, task, 'fatigue');
    return [];
  }

  // 다음으로 무언가 일어날 때까지 남은 분 (끝나거나 기력이 30에 닿는 시점). 시간 진행이 그 시각에 정확히 멈추게 한다.
  function nextMilestone(state, task) {
    const d = DEF[task.type];
    if (task.type === 'shelter') return Math.max(0, task.phaseEnd - state.minute);
    if (d.timed) return Math.max(0, task.endAt - state.minute);
    const ms = members(state, task);
    if (!ms.length) return 0;
    let t = Math.max(0, (task.workTotal - task.workDone) / speedOf(task.type, ms));
    if (d.heavy && d.drain) {
      const rate = -C().energy[d.drain];
      const low = Math.min(...ms.map((m) => m.energy));
      t = Math.min(t, Math.max(0, (low - C().energy.heavyMin) / rate * 60));
    }
    return t;
  }

  // ---------- 보급 저장 ----------
  function addLoot(state, key, amount, freshRatio) {
    const r = state.resources;
    if (amount <= 0) return 0;
    if (key === 'food') return LS.Meals.addFood(state, amount, freshRatio || 0);
    if (key === 'fuel') {
      const room = Math.max(0, r.fuelCap - r.fuel);
      const stored = R().round1(Math.min(room, amount));
      r.fuel = R().round1(r.fuel + stored);
      return stored;
    }
    r[key] = (r[key] || 0) + amount;
    return amount;
  }

  function applyOutcome(state, task, ms) {
    const kind = DEF[task.type].mistake;
    const sev = task.outcome;
    const eff = SEVERITY[kind][sev];
    if (sev === 'minor') {
      if (eff.noise) LS.State.place(state, task.locId).noise = true;
      return eff.text;
    }
    const victim = ms[task.victimIndex % ms.length];
    const vname = R().name(victim.id);
    if (sev === 'injury') {
      R().hurt(state, victim, eff.hp, C().shock.minorInjury);
      return `${josa(vname, '이가')} 다쳤다. (HP ${eff.hp})`;
    }
    ms.filter((m) => m !== victim).forEach((m) => R().addMental(m, C().shock.majorWitness));
    R().hurt(state, victim, eff.hp, C().shock.majorInjury);
    return `${josa(vname, '이가')} 크게 다쳤다. (HP ${eff.hp})`;
  }

  // ---------- 완료·중단 ----------
  function complete(state, task, reason) {
    const d = DEF[task.type];
    const ms = members(state, task);
    const who = names(ms);
    const frac = d.timed ? 1 : Math.min(1, task.workDone / task.workTotal);
    const done = reason === 'done';
    const parts = [];
    let summary = '';
    let important = false;

    // 실수는 작업의 절반을 넘긴 시점에 적용
    if (task.outcome && frac >= 0.5) {
      parts.push(applyOutcome(state, task, ms));
      important = task.outcome !== 'minor';
    }

    const place = LS.State.place(state, task.locId);
    const spot = spotOf(state, task);

    if (task.type === 'check_outside' && spot) {
      spot.checkedEmpty = spot.supply === 'looted' || LS.World.isEmpty(spot);
      summary = spot.checkedEmpty ? '선반이 비어 있다' : '물자가 남아 있는 것 같다';
    }

    if (task.type === 'farm' && spot) {
      const T = LS.SPOT_TYPES[spot.type];
      const loss = task.outcome === 'minor' && frac >= 0.5 ? 1 - SEVERITY.farm.minor.loss : 1;
      const got = [];
      Object.keys(spot.remaining).forEach((k) => {
        const avail = spot.remaining[k];
        if (avail <= 0) return;
        const planned = done ? avail : (k === 'fuel' ? R().round1(avail * frac) : Math.floor(avail * frac));
        if (planned <= 0) return;
        const take = k === 'fuel' ? R().round1(planned * loss) : Math.round(planned * loss);
        const stored = addLoot(state, k, take, T.freshRatio);
        const left = avail - planned + (take - stored);   // 잃은 몫은 사라지고, 보관 한도를 넘은 몫은 남는다
        spot.remaining[k] = k === 'fuel' ? R().round1(left) : Math.round(left);
        if (stored > 0) got.push(`${LS.LOOT_NAMES[k].name} +${stored}${LS.LOOT_NAMES[k].unit}`);
        if (take > stored) parts.push(`보관 한도를 넘어 ${LS.LOOT_NAMES[k].name} ${R().round1(take - stored)}${LS.LOOT_NAMES[k].unit}를 두고 왔다.`);
      });
      spot.farmedOnce = true;
      spot.checkedEmpty = null;
      summary = got.length ? got.join(', ') : '쓸 만한 물자를 찾지 못했다';
    }

    if (task.type === 'scout_area' && done && place) {
      place.scouted = true;
      Object.values(place.spots).forEach((s) => { s.info = 'scouted'; });
      summary = '건물별 보급 가능성을 확인하고 경보 함정을 설치했다 (이곳에선 침낭으로 자도 안전)';
    }

    if (task.type === 'scout_route' && done) {
      state.routes[task.routeKey].known = true;
      summary = '길을 확인했다 (도로 사건 40% → 20%)';
    }

    if (task.type === 'remove_obstacle' && state.roadside) {
      if (done) {
        state.roadside.blocked = false;
        state.roadside.obstacleLeft = null;
        summary = '길이 뚫렸다. 지도에서 남은 구간을 이어갈 수 있다';
      } else {
        state.roadside.obstacleLeft = Math.max(30, Math.round(task.workTotal - task.workDone));
        summary = `장애물이 남았다 (남은 작업 약 ${R().hoursLabel(state.roadside.obstacleLeft)})`;
      }
    }

    if (task.type === 'talk') {
      const T = C().talk;
      const sorted = ms.slice().sort((a, b) => a.mental - b.mental);
      const [target, partner] = sorted;
      const can = (m) => state.minute - m.lastTalk >= T.cooldownHours * 60;
      const got = [];
      if (target && can(target)) { R().addMental(target, T.target); got.push(`${R().name(target.id)} 정신력 +${T.target}`); }
      if (partner && can(partner)) { R().addMental(partner, T.partner); got.push(`${R().name(partner.id)} 정신력 +${T.partner}`); }
      ms.forEach((m) => { m.lastTalk = state.minute; });
      summary = got.length ? got.join(', ') : '오늘은 이미 충분히 이야기했다';
    }

    if (d.timed) summary = task.type === 'watch' ? `경계를 마쳤다 · ${energyText(ms)}` : `일어났다 · ${energyText(ms)}`;

    // 의미 있는 작업의 무실수 완료
    if (done && !task.outcome && (task.type === 'farm' || task.type === 'scout_area' || task.type === 'scout_route')) {
      ms.forEach((m) => R().meaningfulWork(state, m));
    }

    if (reason === 'fatigue') parts.unshift('기력이 30에 닿아 작업을 멈췄다.');
    if (reason === 'abort') parts.unshift('작업을 중단했다.');

    remove(state, task);
    const title = `${taskTitle(state, task)} ${done ? (d.timed ? '끝' : '완료') : '중단'}`;
    const detail = [who, summary].concat(parts).filter(Boolean).join(' · ');
    LS.State.addLog(state, title, important || reason !== 'done', 'task', detail);

    // 파밍 결과·중단·위협은 눌러서 닫을 때까지 알림을 남긴다
    return [{ stop: true, toast: `${title} · ${summary}${parts.length ? ' · ' + parts.join(' ') : ''}`, important: important || reason !== 'done' || task.type === 'farm' }];
  }

  function remove(state, task) {
    state.tasks = state.tasks.filter((t) => t !== task);
    task.members.forEach((id) => {
      const m = R().member(state, id);
      if (m && m.task === task.id) m.task = null;
    });
  }

  function abort(state, taskId) {
    const task = find(state, taskId);
    if (!task) return [];
    if (task.type === 'shelter') {
      if (task.phase === 'return') return [{ toast: '이미 버스로 돌아오는 중이에요.' }];
      const title = spotLabel(state, task);
      LS.State.addLog(state, `${title} 잠자리 중단`, false, 'task', `버스로 돌아오는 중 (${task.walk}분)`);
      setPhase(task, 'return', state.minute);
      return [{ toast: `${title}: 중단하고 버스로 돌아오는 중 (${task.walk}분)` }];
    }
    return complete(state, task, DEF[task.type].timed ? 'done' : 'abort');
  }

  // ---------- 표시용 ----------
  function eta(state, task) { return Math.ceil(remainingAll(state, task)); }

  // 작업이 완전히 끝날 때까지 남은 분 (잠자리는 돌아오는 길까지)
  function remainingAll(state, task) {
    const m = state.minute;
    if (task.type === 'shelter') {
      const left = Math.max(0, task.phaseEnd - m);
      if (task.phase === 'check' || task.phase === 'walk') return left + task.hours * 60 + task.walk;
      if (task.phase === 'sleep') return left + task.walk;
      return left;
    }
    if (DEF[task.type].timed) return Math.max(0, task.endAt - m);
    const ms = members(state, task);
    return Math.max(0, (task.workTotal - task.workDone) / speedOf(task.type, ms));
  }

  function labelFor(state, m) {
    if (state.travel) {
      if (state.travel.driverId === m.id) return '운전 중';
      return LS.Travel.restKind(state, m.id) === 'bedMoving' ? '침상 휴식 (이동 중)' : '좌석 휴식 (이동 중)';
    }
    const t = m.task ? find(state, m.task) : null;
    if (t && t.type === 'shelter') return `${spotLabel(state, t)} · ${PHASE[t.phase]} · ${R().hoursLabel(Math.max(0, t.phaseEnd - state.minute))}`;
    if (t) return `${taskTitle(state, t)} · ${R().hoursLabel(eta(state, t))} 남음`;
    return m.energy < C().energy.seatRest.cap ? '좌석 휴식 (버스 안)' : '대기 (버스 안)';
  }

  // 버스 화면 좌석 표시용 짧은 꼬리표
  function tagFor(state, m) {
    const t = m.task ? find(state, m.task) : null;
    if (!t) return '';
    const d = DEF[t.type];
    if (d.outside) return t.type === 'shelter' && t.phase === 'sleep' ? 'zZ 밖' : '밖';
    if (t.type === 'watch') return '경계';
    if (d.isSleep) return 'zZ';
    return '대화';
  }

  // 지금 이 사람에게 맡길 만한 일이 있는가 ('! 할 일' 표시용. 잠은 일로 치지 않는다)
  function hasWork(state, m) {
    if (state.travel || m.task || !R().canHeavy(state, m) || !R().canOutside(state, m)) return false;
    const place = LS.State.place(state);
    if (!place) return false;
    if (state.locationId === 'roadside' && state.roadside && state.roadside.blocked) return true;
    if (!place.scouted) return true;
    const spotWork = Object.values(place.spots).some((s) => {
      if (s.absent) return false;
      const T = LS.SPOT_TYPES[s.type];
      return !!(T.loot && s.checkedEmpty !== true && !(s.farmedOnce && LS.World.isEmpty(s)));
    });
    if (spotWork) return true;
    if (state.locationId !== 'roadside') {
      return LS.World.routesFrom(state.locationId).some((r) => { const i = state.routes[r.key]; return !i.known && !i.traveled; });
    }
    return false;
  }

  return {
    DEF, def, validate, preview, start, advance, complete, abort, eta, labelFor, tagFor, find, taskTitle, members,
    nextMilestone, wouldEmptyBus, isOutside, hasWork, campSafety, beginStep, checkerOf
  };
})();
