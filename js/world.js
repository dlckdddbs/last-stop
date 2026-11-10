// 세계 상태: 장소별 보급 생성, 경로, 보급 정보 표시 (05~06장)
// 보급 상태는 처음 한 번 생성해 저장하고, 재방문·불러오기로 다시 뽑지 않는다.
window.LS = window.LS || {};

LS.World = (function () {
  const R = () => LS.Rules;

  function routeKey(a, b) { return [a, b].sort().join('|'); }

  function generateSpot(sp) {
    const T = LS.SPOT_TYPES[sp.type];
    const S = LS.CONFIG.supply;
    const spot = {
      type: sp.type,
      info: 'unknown',           // unknown | scouted
      checkedEmpty: null,        // 외부 확인 결과 (true: 비어 있음)
      building: T.canRest ? { checked: false, threat: R().chance(LS.CONFIG.hiddenThreatChance) } : null,
      supply: null,
      remaining: {},
      farmedOnce: false
    };
    // 잠자리 건물: 있을 수도 없을 수도 있고, 버스에서 걸어서 15~20분 (임시값)
    if (sp.type === 'shelter') {
      const SH = LS.CONFIG.shelter;
      spot.absent = !R().chance(SH.chance);
      spot.walk = R().randInt(SH.walkMin[0], SH.walkMin[1]);
    }
    if (!T.loot) return spot;
    spot.supply = R().pickWeighted(S.weights);
    for (const key of Object.keys(T.loot)) {
      const [lo, hi] = T.loot[key];
      const mid = (lo + hi) / 2;
      let v;
      if (spot.supply === 'partial') v = R().rand(lo, hi);
      else if (spot.supply === 'looted') v = mid * R().rand(S.looted[0], S.looted[1]);
      else v = mid * R().rand(S.intact[0], S.intact[1]);
      spot.remaining[key] = key === 'fuel' ? R().round1(v) : Math.round(v);
    }
    if (T.suppressantChance && spot.supply !== 'looted' && R().chance(T.suppressantChance)) {
      spot.remaining.suppressant = 1;
    }
    return spot;
  }

  function generate(state) {
    state.places = {};
    for (const id of Object.keys(LS.LOCATIONS)) {
      const loc = LS.LOCATIONS[id];
      const spots = {};
      loc.spots.forEach((sp) => { spots[sp.id] = generateSpot(sp); });
      state.places[id] = { visited: id === state.locationId, scouted: false, noise: false, spots };
    }
    state.routes = {};
    LS.ROUTES.forEach((r) => { state.routes[routeKey(r.a, r.b)] = { known: false, traveled: false }; });
  }

  // 도로 위에 멈췄을 때 임시 장소
  function makeRoadside(state, info) {
    const spots = [];
    if (R().chance(LS.CONFIG.roadsideCarChance)) {
      spots.push({ id: 'rd_car', label: '도로변 차량', type: 'roadside_car', x: 16, y: 62 });
    }
    state.roadside = Object.assign({}, info, { spots });
    const genSpots = {};
    spots.forEach((sp) => { genSpots[sp.id] = generateSpot(sp); });
    state.places.roadside = { visited: true, scouted: false, noise: false, spots: genSpots };
  }

  function location(state, id) {
    id = id || state.locationId;
    if (id === 'roadside' && state.roadside) {
      const rs = state.roadside;
      const a = LS.LOCATIONS[rs.from];
      const b = LS.LOCATIONS[rs.to];
      const t = rs.total ? rs.progress / rs.total : 0;
      return {
        id: 'roadside',
        name: `도로 위 (${a.name} → ${b.name})`,
        region: a.region,
        bg: 'street',
        roadside: true,
        map: { x: a.map.x + (b.map.x - a.map.x) * t, y: a.map.y + (b.map.y - a.map.y) * t },
        spots: rs.spots
      };
    }
    const loc = LS.LOCATIONS[id];
    return loc ? Object.assign({ id }, loc) : null;
  }

  function routesFrom(id) {
    return LS.ROUTES.filter((r) => r.a === id || r.b === id).map((r) => ({
      to: r.a === id ? r.b : r.a, hours: r.hours, key: routeKey(r.a, r.b), road: r.road
    }));
  }

  function route(a, b) { return LS.ROUTES.find((r) => routeKey(r.a, r.b) === routeKey(a, b)); }

  function eventChance(state, key) {
    const info = state.routes[key];
    return info && (info.known || info.traveled) ? LS.CONFIG.road.knownChance : LS.CONFIG.road.unknownChance;
  }

  // ---------- 보급 정보 문구 ----------
  function lootRangeText(type, scale) {
    const T = LS.SPOT_TYPES[type];
    if (!T.loot) return '';
    return Object.keys(T.loot).map((k) => {
      const [lo, hi] = T.loot[k];
      const N = LS.LOOT_NAMES[k];
      const f = (v) => (k === 'fuel' ? R().round1(v) : Math.round(v));
      const a = scale ? f(((lo + hi) / 2) * scale[0]) : lo;
      const b = scale ? f(((lo + hi) / 2) * scale[1]) : hi;
      return `${N.name} ${a}~${b}${N.unit}`;
    }).join(', ');
  }

  function remainingText(spot) {
    const parts = Object.keys(spot.remaining).filter((k) => spot.remaining[k] > 0).map((k) => {
      const N = LS.LOOT_NAMES[k];
      return `${N.name} ${spot.remaining[k]}${N.unit}`;
    });
    return parts.length ? parts.join(', ') : '남은 물자 없음';
  }

  function isEmpty(spot) { return !Object.keys(spot.remaining).some((k) => spot.remaining[k] > 0); }

  // 플레이어에게 보여줄 보급 정보 (아이콘은 존재만 뜻하고 잔존을 보장하지 않는다)
  function supplyHint(spot) {
    const T = LS.SPOT_TYPES[spot.type];
    if (!T.loot) return '보급 없음';
    if (spot.farmedOnce) return isEmpty(spot) ? '수색 완료 · 남은 물자 없음' : `수색함 · 남은 것: ${remainingText(spot)}`;
    if (spot.checkedEmpty === true) return '비어 있음 (외부 확인)';
    if (spot.info === 'scouted') {
      const S = LS.CONFIG.supply;
      if (spot.supply === 'looted') return `대부분 털린 듯 · ${lootRangeText(spot.type, S.looted)}`;
      if (spot.supply === 'intact') return `비교적 온전해 보임 · ${lootRangeText(spot.type, S.intact)}`;
      return `일부 남은 듯 · ${lootRangeText(spot.type)}`;
    }
    if (spot.checkedEmpty === false) return `물자가 있어 보임 · 보통 ${lootRangeText(spot.type)}`;
    return `미확인 · 보통 ${lootRangeText(spot.type)}`;
  }

  function buildingHint(spot) {
    if (!spot.building) return '';
    const walk = spot.walk ? ` · 버스에서 걸어서 ${spot.walk}분` : '';
    if (!spot.building.checked) return `안은 아직 모름 (숨은 위협 가능)${walk}`;
    return spot.building.threat ? '숨은 위협 있음 · 쓸 수 없음 (대응은 3단계)' : `안전 확인됨${walk}`;
  }

  // 화면에 보이는 건물만 (없는 잠자리 건물은 뺀다)
  function visibleSpots(state, loc) {
    const place = state.places[loc.id] || LS.State.place(state);
    return loc.spots.filter((sp) => place && place.spots[sp.id] && !place.spots[sp.id].absent);
  }

  return {
    routeKey, generate, makeRoadside, location, routesFrom, route, eventChance,
    lootRangeText, remainingText, supplyHint, buildingHint, isEmpty, visibleSpots
  };
})();
