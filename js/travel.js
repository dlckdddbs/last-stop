// 이동 (02장, 05장): 운전·연료·도로 차단·운전자 교대·도로 위 정차·도착
window.LS = window.LS || {};

LS.Travel = (function () {
  const R = () => LS.Rules;
  const C = () => LS.CONFIG;

  function isExpert(m) { return LS.CHARACTERS[m.id].expert === 'driver'; }

  // 운전 속도: 전문 기사는 본인 운전 구간 시간 -10%, 기력 60 미만이면 시간 20% 증가
  function speed(m) {
    return (isExpert(m) ? 1 / C().driver.expertTimeFactor : 1) * R().speedFactor([m]);
  }

  function drivers(state, exceptId) {
    return state.crew.filter((m) => m.id !== exceptId && R().canDrive(state, m) && !m.task);
  }

  // 지금 위치에서 갈 수 있는 곳 (도로 위라면 앞으로 / 되돌아가기)
  function options(state) {
    if (state.locationId === 'roadside' && state.roadside) {
      const rs = state.roadside;
      return [
        { to: rs.to, key: rs.key, baseMinutes: rs.total - rs.progress, forward: true, blocked: !!rs.blocked },
        { to: rs.from, key: rs.key, baseMinutes: rs.progress, forward: false }
      ];
    }
    return LS.World.routesFrom(state.locationId).map((r) => ({ to: r.to, key: r.key, baseMinutes: r.hours * 60, road: r.road }));
  }

  function plan(state, toId, driverId) {
    const opt = options(state).find((o) => o.to === toId);
    if (!opt) return null;
    const driver = driverId ? R().member(state, driverId) : drivers(state)[0];
    const sp = driver ? speed(driver) : 1;
    const minutes = Math.ceil(opt.baseMinutes / sp);
    const fuelNeed = R().round1(C().fuel.drivePerHour * minutes / 60);
    const roadside = state.locationId === 'roadside';
    const info = state.routes[opt.key] || {};
    const drain = driver ? -(isExpert(driver) ? C().energy.driveExpert : C().energy.drive) * minutes / 60 : 0;
    return {
      to: toId, key: opt.key, minutes, fuelNeed, driver,
      known: !!(info.known || info.traveled),
      chance: roadside ? 0 : LS.World.eventChance(state, opt.key),
      blocked: !!opt.blocked,
      driverEnergyAfter: driver ? Math.round(driver.energy - drain) : null
    };
  }

  function departBlockReason(state, toId, driverId) {
    if (state.travel) return '이미 이동 중이다';
    if (state.zombie.siege && !state.zombie.breakout) return '포위 중이다. 돌파를 골라야 떠날 수 있다';
    if (state.bus.durability <= 0) return '버스가 멈췄다 (내구도 0). 정비가 필요하다';
    const outside = state.crew.find((m) => m.task && LS.Tasks.DEF[LS.Tasks.find(state, m.task).type].outside);
    if (outside) return `${LS.Rules.josa(R().name(outside.id), '이가')} 밖에 있다. 돌아와야 출발할 수 있다`;
    const p = plan(state, toId, driverId);
    if (!p) return '갈 수 없는 곳이다';
    if (p.blocked) return '길이 막혀 있다. 먼저 장애물을 치워야 한다';
    if (!p.driver) return '운전할 수 있는 사람이 없다';
    if (!R().canDrive(state, p.driver)) return `${R().name(p.driver.id)}: ${R().driveBlockReason(state, p.driver)}`;
    if (state.resources.fuel <= 0) return '연료가 없다';
    return '';
  }

  function depart(state, toId, driverId) {
    const reason = departBlockReason(state, toId, driverId);
    if (reason) return { error: reason };
    // 버스 옆에서 자거나 경계 서던 사람은 버스에 타고, 이동 중 휴식으로 이어간다
    state.tasks.slice().forEach((t) => { const d = LS.Tasks.DEF[t.type]; if (d.timed || d.person) LS.Tasks.abort(state, t.id); });   // 잠·경계·면담·검사는 출발하면 끝난다
    const fromLabel = LS.State.location(state).name;
    let travel;
    if (state.locationId === 'roadside') {
      const rs = state.roadside;
      if (toId === rs.to) {
        travel = { key: rs.key, from: rs.from, to: rs.to, total: rs.total, progress: rs.progress, event: rs.event, mistake: rs.mistake };
      } else {
        travel = { key: rs.key, from: rs.to, to: rs.from, total: rs.total, progress: rs.total - rs.progress, event: null, mistake: null };
      }
    } else {
      const route = LS.World.route(state.locationId, toId);
      const total = route.hours * 60;
      travel = { key: LS.World.routeKey(state.locationId, toId), from: state.locationId, to: toId, total, progress: 0, event: null, mistake: null };
      // 도로 사건과 운전 실수는 출발할 때 한 구간에 한 번 판정한다
      if (R().chance(LS.World.eventChance(state, travel.key))) travel.event = { type: 'block', at: Math.round(total * R().rand(0.2, 0.8)) };
      const driver = R().member(state, driverId || drivers(state)[0].id);
      const outcome = R().rollOutcome(R().mistakeChance([driver], false));
      if (outcome) travel.mistake = { severity: outcome, at: Math.round(total * R().rand(0.1, 0.9)) };
    }
    travel.driverId = driverId || drivers(state)[0].id;
    travel.startedAt = state.minute;
    LS.People.onDepart(state);   // 태울지 정하지 않은 사람은 두고 간다
    const toasts = LS.Zombie.onDepart(state, travel.driverId);   // 밤 떠나기·포위 돌파 대가, 추격 기록
    state.travel = travel;
    state.roadside = null;
    delete state.places.roadside;
    state.locationId = null;
    state.bus.engineOn = true;
    state.screen = 'travel';
    LS.State.addLog(state, `${LS.Rules.josa(LS.LOCATIONS[travel.to].name, '으로')} 출발`, true, 'travel', `${fromLabel}에서 · 운전 ${R().name(travel.driverId)}`);
    return { ok: true, toasts };
  }

  // ---------- 떠나고 돌아오기 (15장): 무리가 흩어질 때까지 버스를 몰고 돌다 같은 자리로 돌아온다 ----------
  // 떠날 때는 잠자리 건물에 간 사람 말고는 모두 불러들이므로, 하던 일이 있어도 운전자 후보로 친다
  function loopDriver(state) {
    const ds = state.crew.filter((m) => {
      const t = m.task ? LS.Tasks.find(state, m.task) : null;
      return R().canDrive(state, m) && !(t && t.type === 'shelter');
    });
    return ds.find(isExpert) || ds.sort((a, b) => b.energy - a.energy)[0] || null;
  }

  function loopBlock(state) {
    const d = loopDriver(state);
    if (!d) return '운전할 수 있는 사람이 없다';
    const mins = C().zombie.loopMin;
    const need = C().fuel.drivePerHour * mins / 60;
    if (state.resources.fuel < need) return `연료가 모자라다 (${R().round1(need)}단위 필요)`;
    const drain = -(isExpert(d) ? C().energy.driveExpert : C().energy.drive) * mins / 60;
    if (d.energy - drain <= C().driver.minEnergy) return `${R().name(d.id)}의 기력으로는 ${R().hoursLabel(mins)} 운전을 버티지 못한다`;
    return '';
  }

  function departLoop(state) {
    if (state.travel) return { error: '이미 이동 중이다' };
    if (state.bus.durability <= 0) return { error: '버스가 멈췄다 (내구도 0)' };
    const block = loopBlock(state);
    if (block) return { error: block };
    state.tasks.slice().forEach((t) => { const d = LS.Tasks.DEF[t.type]; if (d.timed || d.person) LS.Tasks.abort(state, t.id); });   // 잠·경계·면담·검사는 출발하면 끝난다
    const d = loopDriver(state);
    const loc = LS.State.location(state);
    const toasts = LS.Zombie.onDepart(state, d.id);   // 돌고 돌아오면 같은 자리라, 만난 사람은 그대로 기다린다
    state.travel = {
      loop: true, key: null, from: state.locationId, to: state.locationId, name: loc.name, mapPos: loc.map,
      total: C().zombie.loopMin, progress: 0, event: null, mistake: null, driverId: d.id, startedAt: state.minute
    };
    state.locationId = null;
    state.bus.engineOn = true;
    state.screen = 'travel';
    LS.State.addLog(state, '버스를 몰고 돌며 무리가 흩어지길 기다린다', true, 'travel', `${loc.name} · ${R().hoursLabel(C().zombie.loopMin)} · 운전 ${R().name(d.id)} · 하던 일은 그대로 남는다`);
    return { ok: true, toasts };
  }

  function locName(id) { return id === 'roadside' ? '도로 위' : LS.LOCATIONS[id].name; }

  function etaMinutes(state) {
    const t = state.travel;
    if (!t) return 0;
    const d = R().member(state, t.driverId);
    return Math.ceil((t.pause || 0) + (t.total - t.progress) / (d && !t.loop ? speed(d) : 1));
  }

  // 다음으로 무언가 일어날 때까지 남은 분: 도착·도로 사건·운전 실수·기력 30·연료 바닥
  function nextMilestone(state) {
    const t = state.travel;
    const d = R().member(state, t.driverId);
    if (!d) return 0;
    const sp = t.loop ? 1 : speed(d);
    const pause = t.pause || 0;
    const cands = [(t.total - t.progress) / sp];
    if (t.event && !t.event.done && t.event.at > t.progress) cands.push((t.event.at - t.progress) / sp);
    if (t.mistake && !t.mistake.done && t.mistake.at > t.progress) cands.push((t.mistake.at - t.progress) / sp);
    const rate = -(isExpert(d) ? C().energy.driveExpert : C().energy.drive);
    cands.push(Math.max(0, (d.energy - C().driver.minEnergy) / rate * 60));
    cands.push(Math.max(0, state.resources.fuel / C().fuel.drivePerHour * 60));
    return pause + Math.max(0, Math.min(...cands));
  }

  // ---------- 진행 ----------
  function advance(state, prev, next) {
    const t = state.travel;
    let dt = next - prev;
    const out = [];
    // 운전자 교대 중(10분)에는 버스가 서 있다
    if (t.pause) {
      const used = Math.min(t.pause, dt);
      t.pause -= used;
      dt -= used;
      if (dt <= 0) return out;
    }
    const driver = R().member(state, t.driverId);
    if (!driver) {
      stopRoadside(state, 'nodriver');
      out.push({ stop: true, toast: '운전자를 잃었다. 버스가 도로 위에 멈췄다.' });
      return out;
    }
    const before = t.progress;
    t.progress = Math.min(t.total, t.progress + dt * (t.loop ? 1 : speed(driver)));
    state.resources.fuel = Math.max(0, state.resources.fuel - C().fuel.drivePerHour * dt / 60);
    R().applyDrain(driver, isExpert(driver) ? C().energy.driveExpert : C().energy.drive, dt);
    out.push(...LS.People.onDrive(state, driver, dt));   // 한정수 합류 조건: 하루 운전 8시간
    const kinds = restKinds(state, driver.id);
    state.crew.forEach((m) => { if (m !== driver) R().applyRest(state, m, kinds[m.id], dt); });

    if (t.mistake && !t.mistake.done && before < t.mistake.at && t.progress >= t.mistake.at) {
      t.mistake.done = true;
      out.push(...driveMistake(state, t, driver));
    }
    if (t.event && !t.event.done && before < t.event.at && t.progress >= t.event.at) {
      t.progress = t.event.at;
      t.event.done = true;
      out.push({ dialog: blockEvent(state) });
      return out;
    }
    if (t.progress >= t.total - 1e-6) { out.push(...arrive(state)); return out; }
    if (t.loop) {
      // 돌고 오는 중에는 도로 위에 서지 않는다 (출발할 때 연료·기력을 확인했다)
      if (state.resources.fuel <= 1e-6) { state.resources.fuel = 0; out.push(...arrive(state)); }
      return out;
    }
    if (state.resources.fuel <= 1e-6) {
      state.resources.fuel = 0;
      stopRoadside(state, 'fuel');
      out.push({ dialog: fuelEvent(state) });
      return out;
    }
    if (driver.energy <= C().driver.minEnergy + 1e-6 || driver.mental < C().driver.minMental) {
      out.push({ dialog: fatigueEvent(state, driver) });
    }
    return out;
  }

  function driveMistake(state, t, driver) {
    const sev = t.mistake.severity;
    let text;
    if (sev === 'minor') {
      t.total += 30;
      LS.State.addLog(state, '길을 잘못 들어 30분 우회했다', false, 'travel', `운전 실수 · ${R().name(driver.id)}`);
      return [];
    }
    if (sev === 'injury') {
      R().hurt(state, driver, -5, C().shock.minorInjury);
      text = `급정거로 ${LS.Rules.josa(R().name(driver.id), '이가')} 다쳤다. (HP -5)`;
    } else {
      state.bus.durability = Math.max(0, state.bus.durability - 10);
      const victim = R().pick(state.crew);
      state.crew.filter((m) => m !== victim).forEach((m) => R().addMental(m, C().shock.majorWitness));
      R().hurt(state, victim, -10, C().shock.majorInjury);
      text = `버스가 잔해에 부딪혔다. 내구도 -10, ${R().name(victim.id)} HP -10`;
    }
    LS.State.addLog(state, text, true, 'body', '운전 실수');
    return [{ stop: true, toast: text, important: true }];
  }

  function arrive(state) {
    const t = state.travel;
    if (t.loop) {
      state.locationId = t.to;
      state.travel = null;
      state.bus.engineOn = false;
      state.screen = 'outside';
      LS.Zombie.beginStop(state);
      LS.State.addLog(state, `${LS.Rules.josa(t.name, '으로')} 돌아왔다`, true, 'travel', '무리는 흩어졌다 · 하던 일은 그대로 남아 있다');
      return [{ stop: true, toast: `${LS.Rules.josa(t.name, '으로')} 돌아왔다. 무리는 흩어졌다.` }];
    }
    const loc = LS.LOCATIONS[t.to];
    state.locationId = t.to;
    state.travel = null;
    state.bus.engineOn = false;
    LS.Zombie.beginStop(state);
    state.routes[t.key].traveled = true;
    state.places[t.to].visited = true;
    state.screen = 'outside';
    LS.State.addLog(state, `도착: ${loc.name}`, true, 'travel', '엔진을 껐다. 건물을 눌러 정찰·파밍을 배정할 수 있다.');
    const out = [{ stop: true, toast: `도착: ${loc.name}` }];
    if (loc.exit) out.push({ dialog: gateEvent() });
    // 첫 동료 분기: 처음 들른 쪽에서 만나고, 나중에 다른 쪽에 가면 이미 떠난 뒤다
    const fc = LS.FIRST_COMPANION[t.to];
    if (fc && !state.flags['companionSeen_' + t.to]) {
      state.flags['companionSeen_' + t.to] = true;
      if (!state.flags.firstCompanion) { state.flags.firstCompanion = fc.id; out.push({ dialog: fc.meet }); }
      else out.push({ dialog: fc.gone });
    }
    LS.People.onStop(state, out);   // 임시 동행 목적지, 합류 조건 하차, 이 장소의 생존자
    return out;
  }

  function stopRoadside(state, reason) {
    const t = state.travel;
    LS.World.makeRoadside(state, {
      key: t.key, from: t.from, to: t.to, total: t.total, progress: t.progress,
      blocked: reason === 'block', obstacleLeft: null,
      event: t.event && !t.event.done ? t.event : null,
      mistake: t.mistake && !t.mistake.done ? t.mistake : null
    });
    state.travel = null;
    state.locationId = 'roadside';
    state.bus.engineOn = false;
    state.screen = 'outside';
    LS.Zombie.beginStop(state);
    const why = { block: '길이 막혀', fuel: '연료가 떨어져', fatigue: '운전자가 지쳐', nodriver: '운전자가 없어' }[reason] || '';
    LS.State.addLog(state, `${why} 도로 위에 멈췄다`, true, 'travel', `${LS.LOCATIONS[t.from].name} → ${LS.LOCATIONS[t.to].name} · ${R().hoursLabel(t.progress)}째 지점`);
  }

  function reverse(state) {
    const t = state.travel;
    state.travel = Object.assign({}, t, { from: t.to, to: t.from, progress: t.total - t.progress, event: null, mistake: null });
    LS.State.addLog(state, `${LS.Rules.josa(LS.LOCATIONS[t.from].name, '으로')} 되돌아간다`, false, 'travel');
  }

  // ---------- 사건 ----------
  function blockEvent(state) {
    const t = state.travel;
    const D = C().road;
    const removers = state.crew.filter((m) => R().canHeavy(state, m) && R().canOutside(state, m) && !m.task);
    const canRemove = removers.length >= 2;
    const removeMin = D.investigateMin + (removers.some((m) => m.id === 'yoon_jaeha') ? D.removeMinFirefighter : D.removeMin);
    const [dlo, dhi] = D.detourHours;
    const chanceText = canRemove ? ` · 실수 확률 ${Math.round(R().mistakeChance(removers.slice(0, 2), false) * 100)}%` : '';
    return {
      title: '도로 차단',
      screen: 'travel',
      lines: [
        { speaker: 'narration', text: `${LS.LOCATIONS[t.from].name} → ${LS.LOCATIONS[t.to].name} 구간 ${R().hoursLabel(t.progress)}째. 버려진 차와 잔해가 길을 막고 있다.` },
        { speaker: t.driverId, text: '멈출게. 이대로는 못 지나가.' }
      ],
      observations: [
        `남은 운전: 약 ${R().hoursLabel(t.total - t.progress)}`,
        `조사·제거: 2명, 조사 1시간 + 제거 ${R().hoursLabel(removeMin - D.investigateMin)}${chanceText}`,
        `우회: 추가 ${dlo}~${dhi}시간과 그만큼의 연료`,
        `되돌아가기: 온 길 ${R().hoursLabel(t.progress)}`
      ],
      opinions: [{ speaker: 'park_seoyun', text: '치우는 동안은 여기 멈춰 있어야 해요. 연료가 넉넉하면 돌아가는 것도 방법이고요.' }],
      choices: [
        {
          label: '멈춰서 조사하고 치운다',
          desc: canRemove ? `도로 위에 정차하고, 치울 사람 2명을 고른다 · 기본 ${R().hoursLabel(removeMin)} (지치면 더 걸림)` : '기력이 30보다 많은 2명이 필요하다',
          disabled: !canRemove,
          run: (s) => {
            stopRoadside(s, 'block');
            setTimeout(() => LS.Panel.open('area'), 0);   // 대화창이 닫힌 뒤 배정 패널을 연다
          }
        },
        {
          label: '우회한다',
          desc: `추가 ${dlo}~${dhi}시간`,
          run: (s) => {
            const add = Math.round(R().rand(dlo, dhi) * 2) * 30;
            s.travel.total += add;
            LS.State.addLog(s, '우회로로 돌아간다', false, 'travel', `+${R().hoursLabel(add)}`);
          }
        },
        { label: '되돌아간다', run: (s) => reverse(s) }
      ]
    };
  }

  function fatigueEvent(state, driver) {
    const t = state.travel;
    const others = drivers(state, driver.id);
    const choices = others.map((o) => ({
      label: `${R().name(o.id)}에게 운전을 넘긴다`,
      desc: `기력 ${Math.round(o.energy)} · 교대 10분${LS.CHARACTERS[o.id].condition === 'drive8' ? ` · 오늘 운전 ${R().hoursLabel(LS.People.drivenToday(state, o))} (합류 조건 하루 8시간)` : ''}`,
      run: (s) => {
        s.travel.driverId = o.id;
        s.travel.pause = (s.travel.pause || 0) + 10;   // 안전 정차 교대 10분 (02장)
        LS.State.addLog(s, `운전자 교대: ${R().name(o.id)}`, false, 'travel', '10분 정차');
      }
    }));
    choices.push({ label: '여기서 정차한다', desc: '도로 위에 멈춰 쉰다', run: (s) => stopRoadside(s, 'fatigue') });
    return {
      title: '운전자 교대 필요',
      screen: 'travel',
      lines: [{ speaker: 'narration', text: `${R().name(driver.id)}의 ${driver.mental < C().driver.minMental ? '정신력이 흔들린다' : '기력이 바닥났다'}. 더 운전하면 위험하다.` }],
      observations: [
        `${R().name(driver.id)} 기력 ${Math.round(driver.energy)}`,
        `남은 운전: 약 ${R().hoursLabel(etaMinutes(state))}`,
        others.length ? `교대 가능한 사람: ${others.map((o) => R().name(o.id)).join(', ')}` : '교대할 수 있는 사람이 없다',
        '도로 위에 30분 넘게 멈추면 좀비 등장 판정을 한다'
      ],
      choices
    };
  }

  function fuelEvent(state) {
    return {
      title: '연료 바닥',
      lines: [{ speaker: 'narration', text: '엔진이 콜록거리다 멈췄다. 연료가 떨어졌다.' }],
      observations: ['근처의 차량에서 연료를 구할 수 있을지도 모른다.', '도로 위에 멈춘 상태다.'],
      choices: [{ label: '주변을 살핀다' }]
    };
  }

  function gateEvent() {
    return {
      title: '주거 지역 입구',
      lines: [
        { speaker: 'narration', text: '도시 외곽의 끝. 이 너머가 주거 지역이다.' },
        { speaker: 'park_seoyun', text: '여기서부터는 사람이 더 많았던 곳이에요. 좀비도요.' }
      ],
      observations: ['지금 시험판은 도시 외곽까지예요.', '주거 지역은 이후 단계에서 열립니다.'],
      choices: [{ label: '주변을 둘러본다' }]
    };
  }

  function position(state) {
    const t = state.travel;
    if (!t) return null;
    if (t.loop) return t.mapPos;
    const a = LS.LOCATIONS[t.from].map;
    const b = LS.LOCATIONS[t.to].map;
    const f = t.total ? t.progress / t.total : 0;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  // 동승자 휴식: 환자용 침상은 식중독·HP 낮은 사람 → 기력 낮은 사람 순 (시간당 +2, 100까지), 나머지는 좌석(+1, 80까지)
  function restKinds(state, driverId) {
    const sick = (m) => (R().isPoisoned(state, m) ? 1 : 0);
    const pass = state.crew.filter((m) => m.id !== driverId).sort((a, b) => (sick(b) - sick(a)) || (a.hp - b.hp) || (a.energy - b.energy));
    const n = LS.State.beds(state);
    const out = {};
    pass.forEach((m, i) => { out[m.id] = i < n ? 'bedMoving' : 'seatRest'; });
    return out;
  }

  function restKind(state, id) { return state.travel ? restKinds(state, state.travel.driverId)[id] : null; }

  // 출발 패널·이동 화면용: 동승자의 휴식 예상
  function passengerRest(state, driverId, minutes) {
    const kinds = restKinds(state, driverId);
    return state.crew.filter((m) => m.id !== driverId).map((m) => {
      const E = C().energy[kinds[m.id]];
      const capped = m.energy >= E.cap;
      const after = capped ? m.energy : Math.min(E.cap, m.energy + E.rate * R().recoveryRate(state, m) * minutes / 60);
      return { m, bed: kinds[m.id] === 'bedMoving', cap: E.cap, now: Math.round(m.energy), after: Math.round(after), capped };
    });
  }

  return { options, plan, depart, departBlockReason, drivers, etaMinutes, nextMilestone, advance, position, speed, passengerRest, restKind, departLoop, loopBlock, locName };
})();
