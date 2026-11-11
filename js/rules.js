// 규칙 계산 모음: 확률, 기력, 실수, 운전 조건 등. 수치는 data/config.js에서 가져온다.
window.LS = window.LS || {};

LS.Rules = (function () {
  const C = () => LS.CONFIG;

  // ---------- 확률 도구 ----------
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function chance(p) { return Math.random() < p; }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function pickWeighted(weights) {
    const r = Math.random();
    let acc = 0;
    const keys = Object.keys(weights);
    for (const k of keys) { acc += weights[k]; if (r < acc) return k; }
    return keys[keys.length - 1];
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }

  // ---------- 인물 ----------
  function member(state, id) { return state.crew.find((m) => m.id === id); }
  function char(id) { return LS.CHARACTERS[id]; }
  function name(id) { return char(id) ? char(id).name : id; }

  function isPoisoned(state, m) { return !!(m.poisonUntil && state.minute < m.poisonUntil); }
  function isFree(m) { return !m.task; }

  // HP가 너무 낮으면 치료·휴식만 (임시값)
  function lowHp(m) { return m.hp <= C().lowHpWorkLimit; }

  // 감염 단계 (12장): 잠복 0~24시간 · 발열 24~48 (외부 작업 불가, 기력 회복 절반) · 악화 48~72 (모든 작업 불가)
  function infectionHours(state, m) { return m.infectedAt == null ? null : (state.minute - m.infectedAt) / 60; }
  function infectionStage(state, m) {
    const h = infectionHours(state, m);
    if (h == null) return null;
    const I = C().infection;
    return h < I.feverH ? '잠복' : h < I.worseH ? '발열' : '악화';
  }

  // 운전·정찰·파밍·정비·장애물 제거 같은 고강도 작업이 가능한가
  function canHeavy(state, m) {
    return m.energy > C().energy.heavyMin && !lowHp(m) && infectionStage(state, m) !== '악화';
  }

  // 밖에 나가서 하는 작업이 가능한가 (식중독이면 12시간, 감염은 발열부터 외부 작업 불가)
  function canOutside(state, m) {
    const st = infectionStage(state, m);
    return !isPoisoned(state, m) && !lowHp(m) && st !== '발열' && st !== '악화';
  }

  function canDrive(state, m) {
    const D = C().driver;
    return !!char(m.id).canDrive && !m.temp && m.energy > D.minEnergy && m.mental >= D.minMental && !lowHp(m) && infectionStage(state, m) !== '악화';
  }

  function driveBlockReason(state, m) {
    const D = C().driver;
    if (!char(m.id).canDrive) return '운전 불가';
    if (m.energy <= D.minEnergy) return '기력 부족';
    if (m.mental < D.minMental) return '정신력 흔들림';
    if (lowHp(m)) return 'HP 낮음';
    if (infectionStage(state, m) === '악화') return '감염 악화';
    return '';
  }

  function mentalStage(v) { return LS.State.mentalStage(v); }

  // ---------- 기력 ----------
  // 결핍·식중독에 따른 회복률
  function recoveryRate(state, m) {
    let rate = 1;
    for (const r of C().meal.recovery) { if (m.deficit >= r.min) { rate = r.rate; break; } }
    if (isPoisoned(state, m)) rate *= 0.5;
    const st = infectionStage(state, m);
    if (st === '발열' || st === '악화') rate *= 0.5;
    return rate;
  }

  // 기력 60 미만이 섞이면 작업 시간 20% 증가
  function speedFactor(members) {
    return members.some((m) => m.energy < C().energy.slowBelow) ? 1 / C().energy.slowFactor : 1;
  }

  function applyRest(state, m, kind, minutes) {
    const E = C().energy[kind];
    if (m.energy >= E.cap) return;
    m.energy = Math.min(E.cap, m.energy + E.rate * recoveryRate(state, m) * minutes / 60);
  }

  function applyDrain(m, ratePerHour, minutes) {
    m.energy = Math.max(0, m.energy + ratePerHour * minutes / 60);
  }

  // ---------- 실수 판정 (07장) ----------
  function mentalAdj(mental) {
    if (mental >= 60) return 0;
    if (mental >= 30) return C().mistake.shaken;
    return C().mistake.broken;
  }

  // 2인 외부 작업은 낮은 정신력 기준
  function mistakeChance(members, dangerous) {
    const M = C().mistake;
    const lowest = Math.min(...members.map((m) => m.mental));
    return clamp(M.base + mentalAdj(lowest) + (dangerous ? M.dangerous : 0), 0, M.max);
  }

  // 작업 시작 때 한 번 판정해서 저장한다 (불러오기·교대로 다시 뽑지 않음)
  function rollOutcome(p) {
    if (!chance(p)) return null;
    return pickWeighted(C().mistake.severity);   // minor | injury | major
  }

  // ---------- 상태 변화 ----------
  function hurt(state, m, hp, mental) {
    m.hp = clamp(m.hp + hp, 0, 100);
    if (mental) m.mental = clamp(m.mental + mental, 0, 100);
    if (m.hp <= 0) LS.State.killMember(state, m.id);
  }

  function addMental(m, v) { m.mental = clamp(m.mental + v, 0, 100); }

  // 의미 있는 작업의 무실수 완료 +2 (24시간 최대 +4)
  function meaningfulWork(state, m) {
    const W = C().work;
    const dayKey = Math.floor(state.minute / 1440);
    if (m.workBonusDay !== dayKey) { m.workBonusDay = dayKey; m.workBonusToday = 0; }
    if (m.workBonusToday >= W.meaningfulDailyMax) return;
    m.workBonusToday += W.meaningfulBonus;
    addMental(m, W.meaningfulBonus);
  }

  function hoursLabel(min) {
    const h = Math.floor(min / 60);
    const mm = Math.round(min % 60);
    if (h && mm) return `${h}시간 ${mm}분`;
    if (h) return `${h}시간`;
    return `${mm}분`;
  }

  // 받침에 맞는 조사를 붙인다. pair: '이가' | '은는' | '을를' | '으로'  (예: 윤재하가, 한정수가, 주유소로, 마트로)
  function josa(word, pair) {
    const s = String(word);
    const c = s.charCodeAt(s.length - 1);
    const hangul = c >= 0xAC00 && c <= 0xD7A3;
    const jong = hangul ? (c - 0xAC00) % 28 : 0;
    const P = { '이가': ['이', '가'], '은는': ['은', '는'], '을를': ['을', '를'], '으로': ['으로', '로'], '와과': ['과', '와'] }[pair];
    const has = pair === '으로' ? jong !== 0 && jong !== 8 : jong !== 0;   // ㄹ 받침 뒤에는 '로'
    return s + (has ? P[0] : P[1]);
  }

  return {
    rand, randInt, chance, pick, pickWeighted, clamp, round1,
    member, char, name, isPoisoned, isFree, lowHp, infectionHours, infectionStage, canHeavy, canOutside, canDrive, driveBlockReason, mentalStage,
    recoveryRate, speedFactor, applyRest, applyDrain,
    mistakeChance, rollOutcome, hurt, addMental, meaningfulWork, hoursLabel, josa
  };
})();
