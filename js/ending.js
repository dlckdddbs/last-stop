// 결말 (24~25장): 판정 · 마지막 장면 · 추가 장면 · 여행 기록. 2026-11-25, 기말 피드백 2번.
// 결말은 순위가 아니라 선택의 기록이다. 두 축: 선택(구한 쪽 / 그 사이 / 내려놓은 쪽) × 리더 신뢰(60 이상 따랐다 / 59 이하 흔들렸다)
window.LS = window.LS || {};

LS.Ending = (function () {
  const R = () => LS.Rules;
  const nm = (id) => LS.Rules.name(id);
  const josa = (w, p) => LS.Rules.josa(w, p);
  const esc = (t) => LS.UI.esc(t);
  const STARTERS = ['yoon_jaeha', 'park_seoyun'];
  const SEEN_KEY = 'lastStop.endings';

  // 결말 13종 (24장 성공 7 + 실패·특수 6)
  const ENDINGS = {
    full:    { title: '끝까지 태운 버스',   kind: 'success', scene: '태운 사람은 끝까지 데려왔다. 접수대 앞에 선 줄이 버스의 좌석 수보다 길었다.' },
    light:   { title: '가벼운 버스',        kind: 'success', scene: '각자의 정류장에 한 사람씩 내려 주었다. 공항에 닿은 버스는 가볍고 조용했다.' },
    tired:   { title: '지친 버스',          kind: 'success', scene: '남을 구하느라 우리를 돌보지 못했다. 다들 말없이 접수대 앞 바닥에 주저앉았다.' },
    cold:    { title: '냉정한 버스',        kind: 'success', scene: '두고 온 사람들이 있다. 그래도 모두 그 선택을 이해했고, 끝까지 리더를 따랐다.' },
    quiet:   { title: '조용한 버스',        kind: 'success', scene: '도착했지만 아무도 먼저 내리지 않았다. 두고 온 이름들이 버스 안에 오래 남았다.' },
    steady:  { title: '멈추지 않은 버스',   kind: 'success', scene: '모두를 구하지도, 모두를 버리지도 않았다. 다만 멈추지 않았다.' },
    shaken:  { title: '흔들린 버스',        kind: 'success', scene: '지킨 약속과 어긴 약속이 함께 실려 왔다. 공항에 닿았지만 서로 눈을 마주치지 않았다.' },
    waiting: { title: '다음 버스를 기다리며', kind: 'fail',  scene: '마지막 대피편은 떠났다. 버스는 믿을 수 있는 거점으로 돌아가 다음 버스를 기다리기로 했다.' },
    road:    { title: '길 위의 버스',       kind: 'fail',    scene: '마지막 대피편은 떠났다. 기댈 곳 없이, 버스는 아직 길 위에 있다.' },
    leader:  { title: '내린 리더',          kind: 'special', scene: '리더가 바뀌었다. 윤재하 없이 버스는 계속 간다.' },
    empty:   { title: '빈 운전석',          kind: 'special', scene: '윤재하가 돌아오지 못했다. 운전석이 비었다.' },
    stopped: { title: '멈춘 버스',          kind: 'special', scene: '버스에 남은 사람이 없다. 엔진은 다시 켜지지 않았다.' },
    last:    { title: '마지막 정류장',      kind: 'special', scene: '윤재하는 스스로 버스에서 내렸다. 여기가 그의 마지막 정류장이었다.' }
  };

  // ---------- 공항 도착 (Travel.landAt이 부른다) ----------
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
        run: () => LS.Time.handle([{ gameover: 'arrived' }]),   // 바로 결말 (뒤에 남은 사건은 열지 않는다)
        result: { lines: [{ speaker: 'narration', text: '접수대 직원이 버스에 탄 사람들의 이름을 하나씩 받아 적는다.' }] }
      }]
    };
  }

  // ---------- 판정 (24장) ----------
  function uniq(list) { const seen = new Set(); return list.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))); }

  function facts(state) {
    const rec = state.record;
    const rescued = state.crew.filter((m) => !STARTERS.includes(m.id));          // 공항까지 데려온 구조자
    const helped = uniq(rec.helped);                                               // 안전하게 맡기거나 데려다준 사람
    const helpedTotal = rescued.length + helped.filter((h) => !rescued.some((m) => m.id === h.id)).length;
    const letGo = uniq(rec.letGo);
    const dropped = helped.filter((h) => h.how === 'handover' || h.how === 'delivered');   // 내려준 사람
    const axis = letGo.length >= 2 ? 'letgo' : helpedTotal >= 5 ? 'saved' : 'between';
    return { rescued, helped, helpedTotal, letGo, dropped, axis, followed: state.trust >= 60 };
  }

  function trustedFaction(state) {
    const best = Object.keys(LS.FACTIONS).filter((k) => LS.Factions.rep(state, k) >= 6).sort((a, b) => LS.Factions.rep(state, b) - LS.Factions.rep(state, a))[0];
    return best || null;
  }

  // 주인공이 스스로 내렸을 때: 남은 일행이 마감 안에 닿을 수 있는가 (가장 짧은 길 × 1.5 + 검문 24시간, 운전자·연료)
  function shortestHours(state, from) {
    if (!from || !LS.LOCATIONS[from]) return Infinity;
    const dist = { [from]: 0 };
    const todo = [from];
    while (todo.length) {
      todo.sort((a, b) => dist[a] - dist[b]);
      const cur = todo.shift();
      if (LS.LOCATIONS[cur].terminal) return dist[cur];
      LS.World.routesFrom(cur, state).forEach((r) => {
        const d = dist[cur] + r.hours;
        if (dist[r.to] == null || d < dist[r.to]) { dist[r.to] = d; todo.push(r.to); }
      });
    }
    return Infinity;
  }

  function judge(state, reason) {
    const f = facts(state);
    if (reason === 'arrived') {
      let id;
      if (f.axis === 'saved') id = f.followed ? (f.rescued.length > f.dropped.length ? 'full' : 'light') : 'tired';
      else if (f.axis === 'letgo') id = f.followed ? 'cold' : 'quiet';
      else id = f.followed ? 'steady' : 'shaken';
      return { id, f };
    }
    if (reason === 'deadline') return { id: trustedFaction(state) ? 'waiting' : 'road', f };
    if (reason === 'protagonist' || reason === 'heroTurned') return { id: 'empty', f };
    if (reason === 'wipe') return { id: 'stopped', f };
    if (reason === 'leader') return { id: 'leader', f };
    if (reason === 'selfExit') {
      const others = state.crew.filter((m) => m.id !== 'yoon_jaeha');
      const hours = shortestHours(state, state.locationId);
      const left = LS.Clock.end() - state.minute;
      const canDrive = others.some((m) => LS.CHARACTERS[m.id].canDrive);
      const made = others.length > 0 && canDrive && hours * 60 * 1.5 + 24 * 60 <= left && state.resources.fuel >= hours * LS.CONFIG.fuel.drivePerHour;
      return { id: 'last', f, selfExit: { made, others } };
    }
    return { id: 'road', f };
  }

  // ---------- 추가 장면 (25장) ----------
  function extraScenes(state, j) {
    const lines = [];
    const success = ENDINGS[j.id].kind === 'success';
    if (success && state.trust >= 80) lines.push('대피편 안에서 누군가 물었다. “다음은 어디로 가요, 대장?”');
    if (success && state.trust >= 20 && state.trust < 40) lines.push('접수를 마치자 일행은 말없이 흩어졌다.');
    Object.keys(LS.FACTIONS).forEach((k) => {
      const v = LS.Factions.rep(state, k);
      const f = LS.FACTIONS[k];
      if (v >= 6) lines.push(`${f.name}의 무전: “그 버스는 우리 은인이다. 어디서든 환대하라.”`);
      if (v <= -6) lines.push(`${f.name}의 무전: “그 버스를 조심하라.”`);
    });
    if (j.id === 'waiting') {
      const tf = trustedFaction(state);
      if (tf) lines.push(`${josa(LS.FACTIONS[tf].name, '이가')} 버스를 받아 주었다. (${LS.FACTIONS[tf].bases})`);
    }
    if (j.selfExit) lines.push(j.selfExit.made ? '남은 일행은 운전대를 이어받아, 마감 전에 공항에 닿았다.' : '남은 일행은 끝내 공항에 닿지 못했다.');
    return lines;
  }

  // ---------- 모은 결말 (25장 "카드로 수집") ----------
  function seenEndings() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch (e) { return []; } }
  function markSeen(id) {
    try { const s = seenEndings(); if (!s.includes(id)) { s.push(id); localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } } catch (e) { /* 저장소 없음 */ }
  }

  function speakerName(id) { return LS.CHARACTERS[id] ? nm(id) : (LS.SPEAKERS[id] ? LS.SPEAKERS[id].name : ''); }
  function reactionsSafe(state, j) { try { return reactions(state, j); } catch (e) { return []; } }

  // ---------- 여행 기록 화면 ----------
  function chip(id, sub) {
    const src = LS.ASSETS.portraits[id];
    const name = LS.CHARACTERS[id] ? nm(id) : (String(id).indexOf('rescued_') === 0 ? '고립됐던 주민' : id);
    return `<div class="rec-chip">${src ? `<img src="${src}" alt="">` : ''}<span><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></div>`;
  }
  function placeName(id) { return id && LS.LOCATIONS[id] ? LS.LOCATIONS[id].name : '길 위'; }
  const HOW = { handover: '맡김', delivered: '데려다줌', rescue: '구조', stay: '원치 않는데 남김', force: '강제 하차', promise: '약속을 어김' };

  function section(title, body) { return `<div class="rec-sec"><h3>${esc(title)}</h3>${body}</div>`; }

  function show(state, reason) {
    const j = judge(state, reason);
    const e = ENDINGS[j.id];
    const f = j.f;
    if (!state.flags.demo) markSeen(j.id);   // 시연용 지름길은 모은 결말에 넣지 않는다
    LS.State.addLog(state, `결말: ${e.title}`, true, 'event', e.scene);
    const axisText = { saved: '구한 쪽', between: '그 사이', letgo: '내려놓은 쪽' }[f.axis];
    const arrivedAt = state.flags.arrivedAirport != null ? LS.Clock.fullLabel(state.flags.arrivedAirport) : null;
    const reactions = reactionsSafe(state, j);
    const extras = extraScenes(state, j);

    let html = `<div class="ending-box"><div class="ending-kind ${e.kind}">${e.kind === 'success' ? '공항 도착' : e.kind === 'fail' ? '대피편을 놓쳤다' : '특수 결말'}</div>`;
    html += `<h2>${esc(e.title)}</h2><p class="ending-scene">${esc(e.scene)}</p>`;
    if (state.flags.demo) html += '<div class="rec-demo">시연용 지름길로 시작한 여정이에요 (일반 진행이 아니라 모은 결말에는 넣지 않아요)</div>';
    if (reactions.length) html += '<div class="ending-react">' + reactions.map((r) => `<p>${r.speaker ? `<b>${esc(speakerName(r.speaker))}</b> ` : ''}${esc(r.text)}</p>`).join('') + '</div>';
    if (extras.length) html += '<div class="ending-extra">' + extras.map((t) => `<p>${esc(t)}</p>`).join('') + '</div>';

    // 판정 근거
    html += `<div class="rec-axis"><span>선택의 기록 <b>${axisText}</b> · 도운 사람 ${f.helpedTotal}명 · 내려놓은 선택 ${f.letGo.length}번</span><span>리더 신뢰 <b>${state.trust}</b> · ${f.followed ? '따랐다' : '흔들렸다'}</span><span>${arrivedAt ? `도착 ${arrivedAt}` : `끝난 때 ${LS.Clock.fullLabel(state.minute)}`}</span></div>`;

    // 여행 기록 (25장: 도착 시각·태운/맡긴/잃은 사람·약속·평판)
    html += '<div class="rec-grid">';
    html += section(reason === 'arrived' ? '함께 도착한 사람' : '마지막까지 버스에 있던 사람', `<div class="rec-chips">${state.crew.map((m) => chip(m.id, STARTERS.includes(m.id) ? '처음부터' : reason === 'arrived' ? '공항까지' : '끝까지')).join('') || '<p class="dim">없음</p>'}</div>`);
    const boarded = state.record.boarded || [];
    html += section('태운 사람', boarded.length ? `<div class="rec-chips">${boarded.map((b) => chip(b.id, `${placeName(b.where)}에서`)).join('')}</div>` : '<p class="dim">아무도 태우지 않았다</p>');
    html += section('맡기거나 데려다준 사람', f.helped.length ? `<div class="rec-chips">${f.helped.map((h) => chip(h.id, `${placeName(h.where)} · ${HOW[h.how] || h.how}`)).join('')}</div>` : '<p class="dim">없음</p>');
    const lost = state.dead.filter((d) => d.how !== 'left');
    html += section('잃은 사람', lost.length ? `<div class="rec-chips">${lost.map((d) => chip(d.id, d.how === 'turned' ? '감염으로 작별' : '숨짐')).join('')}</div>` : '<p class="dim">없음</p>');
    html += section('내려놓은 사람', f.letGo.length ? `<div class="rec-chips">${f.letGo.map((h) => chip(h.id, `${placeName(h.where)} · ${HOW[h.how] || h.how}`)).join('')}</div>` : '<p class="dim">없음</p>');
    // 약속
    const reqs = state.requests.list.filter((r) => r.kind !== 'urgent' || r.status !== 'active');
    const ST = { done: '지켰다', failed: '못 지켰다', gaveup: '포기했다', broken: '어겼다', active: '끝내지 못했다' };
    const promiseRows = reqs.map((r) => {
      const t = LS.Requests.tpl(r.tid);
      const title = r.kind === 'promise' ? `데리러 오겠다는 약속 · ${LS.ENCOUNTERS[r.enc].who.map(nm).join('·')}` : `${t.title}${r.from ? ` · ${nm(r.from)}` : ''}`;
      return `<li><span>${esc(title)}</span><b class="${r.status === 'done' ? 'ok' : 'bad'}">${ST[r.status] || r.status}</b></li>`;
    });
    const viol = state.crew.concat([]).filter((m) => m.violations).map((m) => `<li><span>${esc(nm(m.id))}의 합류 조건</span><b class="bad">${m.violations}번 어김</b></li>`);
    html += section('약속', (promiseRows.length || viol.length) ? `<ul class="rec-list">${promiseRows.join('')}${viol.join('')}</ul>` : '<p class="dim">맡은 약속이 없었다</p>');
    // 평판
    html += section('외부 집단의 평판', '<ul class="rec-list">' + Object.keys(LS.FACTIONS).map((k) => {
      const v = LS.Factions.rep(state, k);
      return `<li><span>${esc(LS.FACTIONS[k].name)}</span><b>${LS.Factions.signed(v)} · ${LS.Factions.stance(v).label}</b></li>`;
    }).join('') + '</ul>');
    html += '</div>';

    const seen = seenEndings();
    html += `<div class="ending-foot"><span>모은 결말 ${seen.length} / 13</span><button id="btn-ending-new" class="primary">처음부터</button></div></div>`;
    return html;
  }

  // ---------- 공항의 반응 (25장 인물 후일담 + 기말 심화: 태운 사람·지킨 약속에 따라 달라지는 문장) ----------
  // 여정 중의 선택을 마지막 장면에서 다시 떠올리게 한다: 처음 태운 사람, 지킨/어긴 약속, 내려놓은 사람
  function reqDone(state, tid) { return state.requests.list.some((r) => r.tid === tid && r.status === 'done'); }
  function reqStatus(state, tid) { const r = state.requests.list.find((x) => x.tid === tid); return r ? r.status : null; }
  function aboard(state, id) { return !!R().member(state, id); }

  function reactions(state, j) {
    const out = [];
    const arrived = j.id && ENDINGS[j.id].kind === 'success';
    const boarded = state.record.boarded || [];
    // 처음 태운 사람 (첫 정류장의 선택)
    const first = boarded[0];
    if (arrived && first && aboard(state, first.id)) {
      out.push({ speaker: null, text: `${placeName(first.where)}에서 처음 태운 ${josa(nm(first.id), '이가')} 맨 먼저 접수 명단에 이름을 적었다.` });
    }
    if (arrived) {
      // 25장 예: 한정수 — 조건을 지켰다면 마지막 구간 운전을 자원
      const han = R().member(state, 'han_jungsu');
      if (han && !han.violations) out.push({ speaker: 'han_jungsu', text: '약속 지켜 줘서 고맙소. 접수대 앞 마지막 길은 내가 몰았지.' });
      // 25장 예: 김나래 — 조사한 동생 집의 쪽지를 들고 접수대에 섬
      if (aboard(state, 'kim_narae')) {
        out.push(reqDone(state, 'narae_brother')
          ? { speaker: 'kim_narae', text: '(동생 집에서 찾은 쪽지를 내밀며) 이 이름도 같이 찾아 주세요. 먼저 왔을 거예요.' }
          : { speaker: 'kim_narae', text: '동생 집에는 끝내 못 가 봤네요. …여기 어딘가 있겠죠.' });
      }
      // 25장 예: 송지호 — 명단 전달 후 학교 대피소 수송대 출발 방송
      if (reqDone(state, 'song_list')) out.push({ speaker: 'radio', text: '초등학교 대피소에 수송대를 보냅니다. 명단을 전해 준 버스에 감사드립니다.' });
      // 이수아 — 물린 동료를 끝까지 데려왔으면 의료 인계 (12장 "전환 전 공항 도착은 의료 인계")
      const infected = state.crew.filter((m) => m.infectedAt != null);
      if (infected.length) {
        const who = infected.map((m) => nm(m.id)).join('·');
        out.push(aboard(state, 'lee_sua')
          ? { speaker: 'lee_sua', text: `${josa(who, '을를')} 의료진에게 넘겼어요. 끝까지 데려왔으니까, 약속은 지킨 거예요.` }
          : { speaker: null, text: `격리 좌석의 ${josa(who, '은는')} 공항 의료진에게 인계됐다.` });
      }
      const sua = R().member(state, 'lee_sua');
      if (sua && sua.violations) out.push({ speaker: 'lee_sua', text: '…길에 두고 온 사람이 생각나요.' });
      // 정민경·하율
      if (aboard(state, 'jung_hayul')) out.push({ speaker: 'jung_hayul', text: '(접수대 직원에게 그림을 보여 준다) 이게 우리 버스예요!' });
      // 오태석·유상철·서동진의 부탁
      if (aboard(state, 'oh_taeseok') && reqDone(state, 'oh_debt')) out.push({ speaker: 'oh_taeseok', text: '빚 털고 오니 발이 가볍소.' });
      if (aboard(state, 'yoo_sangcheol') && reqDone(state, 'yoo_visit')) out.push({ speaker: 'yoo_sangcheol', text: '교환품은 다 넘겼소. 빈 손수레로 비행기 타는 상인은 나 하나일 거요.' });
      if (aboard(state, 'seo_dongjin') && reqDone(state, 'seo_material')) out.push({ speaker: 'seo_dongjin', text: '억제제 만드는 법을 의료진에게 적어 줬어요. 누군가는 시간을 벌겠죠.' });
    }
    // 맡기거나 데려다준 사람의 소식 (25장 예: 권순자 — 버스가 데려다준 할머니로 마을에서 불림)
    if (reqDone(state, 'kwon_ride')) out.push({ speaker: null, text: '자급 마을에서는 권순자 할머니를 “버스가 데려다준 할머니”라고 부른다.' });
    const school = (state.record.helped || []).find((h) => h.where === 'res_school' && LS.CHARACTERS[h.id] && LS.CHARACTERS[h.id].child);   // 학교에 맡긴 아이
    if (school && LS.CHARACTERS[school.id]) out.push({ speaker: null, text: `초등학교 대피소의 벽에는 ${josa(nm(school.id), '이가')} 그린 버스 그림이 붙어 있다.` });
    // 리더 약속: 지켰으면 고마움, 어겼으면 빈자리
    state.requests.list.filter((r) => r.kind === 'promise').forEach((r) => {
      const names = LS.ENCOUNTERS[r.enc].who.map(nm).join('·');
      if (r.status === 'done' && arrived) out.push({ speaker: LS.ENCOUNTERS[r.enc].who[0], text: '데리러 와 줘서… 그 말, 믿길 잘했어요.' });
      if (r.status === 'broken' || r.status === 'active') out.push({ speaker: null, text: `데리러 가겠다고 했던 ${names}의 자리는 끝내 비어 있었다.` });
    });
    // 내려놓은 사람 (가장 마지막으로 내려놓은 한 명)
    const lastLetGo = (state.record.letGo || []).slice(-1)[0];
    if (lastLetGo && LS.CHARACTERS[lastLetGo.id]) out.push({ speaker: null, text: `${placeName(lastLetGo.where)}에 내려놓은 ${nm(lastLetGo.id)}의 좌석은 아무도 앉지 않았다.` });
    return out.slice(0, 7);
  }

  return { arrivalEvent, judge, show, facts, ENDINGS, seenEndings, reactions };
})();
