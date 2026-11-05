// 마을 안 미니게임 규칙(서버가 심판): 술래잡기(감염 방식)와 물풍선 피구.
// 참가 패드에 서 있는 사람이 최소 인원 이상이면 카운트다운 후 시작, 끝나면 패드 근처로 돌려보냄.
import { GAMES, TAG, DODGE, TAG_STARTS, IT_START, dodgeClamp, dodgeOut, padOf, resolve } from './public/world.js';

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SPEED = 12, RANGE = 16, HIT_R = 0.7, DODGE_Y = 0.55, TAG_R = 1.05;

export function createGames({ players, send, bcast, opts = {} }) {
  const COUNTDOWN = opts.countdown ?? 10000, READY = opts.ready ?? 3000, THROW_CD = opts.throwCd ?? 1200;
  const lobby = { tag: { ids: new Set(), cd: null, sec: -1 }, dodge: { ids: new Set(), cd: null, sec: -1 } };
  const run = { tag: null, dodge: null };
  const byId = (id) => players.get(id);
  const now = () => Date.now();
  // 그 판 참가자(탈락자 포함)에게는 mine, 나머지 사람에게는 others(없으면 안 보냄). 모집 알림(lobby)·판 상태(gstate)·물풍선 그림(balloon·bend)만 모두에게
  const split = (g, mine, others) => { for (const p of players.values()) { const o = g.parts.has(p.id) ? mine : others; if (o) send(p.ws, o); } };

  const pushLobby = (gid) => {
    const G = GAMES[gid], l = lobby[gid];
    l.sec = l.cd ? Math.ceil((l.cd - now()) / 1000) : null;
    bcast({ t: 'lobby', g: gid, n: l.ids.size, min: G.min, max: G.max, cd: l.sec, busy: !!run[gid] });
  };
  function refresh(gid) { // 패드 위 사람 다시 세기
    const G = GAMES[gid], l = lobby[gid];
    l.ids = new Set([...players.values()].filter((p) => p.pad === gid && !p.game && p.seat < 0).map((p) => p.id));
    if (run[gid] || l.ids.size < G.min) l.cd = null; else l.cd ??= now() + COUNTDOWN;
    pushLobby(gid);
  }

  function tp(p, x, z, ry = p.ry) {
    [p.x, p.z] = resolve(x, z); p.ry = ry; p.w = false; p.y = 0; p.dirty = true;
    send(p.ws, { t: 'tp', x: p.x, z: p.z, ry });
  }
  function sendHome(p, i, g) { // 끝난 사람은 패드 가장자리 중 경기장 반대쪽으로 (경기장은 울타리로 막혀 있어서 안쪽에 내리면 못 나옴)
    const dx = g.pad.x - g.cx, dz = g.pad.z - g.cz, l = Math.hypot(dx, dz) || 1, away = Math.atan2(dx / l, dz / l);
    const a = away + ((i % 5) - 2) * 0.6, r = g.pad.r + 1.4 + Math.floor(i / 5) * 1.3;
    p.game = null; p.pad = null;
    tp(p, g.pad.x + Math.sin(a) * r, g.pad.z + Math.cos(a) * r, away);
  }
  const arenaAt = (x, z) => Object.values(GAMES).find((g) => Math.abs(x - g.cx) < g.hw && Math.abs(z - g.cz) < g.hd);

  function start(gid) {
    const G = GAMES[gid], l = lobby[gid];
    const ps = [...l.ids].map(byId).filter(Boolean).slice(0, G.max);
    l.cd = null;
    if (ps.length < G.min) return refresh(gid);
    const t0 = now(), g = { gid, phase: 'ready', readyEnd: t0 + READY, end: t0 + READY + G.dur, parts: new Map(), last: t0, bcastAt: 0 };
    run[gid] = g;
    ps.forEach((p) => { p.game = gid; p.pad = null; });
    if (gid === 'tag') {
      const it = ps[Math.floor(Math.random() * ps.length)], spots = shuffle([...TAG_STARTS]);
      ps.forEach((p, i) => { g.parts.set(p.id, { role: p === it ? 'it' : 'run' }); const [x, z] = p === it ? IT_START : spots[i % spots.length]; tp(p, x, z, p === it ? Math.PI / 2 : Math.PI); });
    } else {
      g.balloons = []; g.nextB = 1;
      const order = shuffle([...ps]), teams = [order.filter((_, i) => i % 2 === 0), order.filter((_, i) => i % 2 === 1)];
      teams.forEach((tm, team) => tm.forEach((p, i) => {
        g.parts.set(p.id, { team, hp: 2, cd: 0, out: false, idx: i });
        tp(p, DODGE.cx + (team === 0 ? -1 : 1) * (3 + Math.floor(i / 3) * 2.4), DODGE.cz - 3.5 + (i % 3) * 3.5, team === 0 ? Math.PI / 2 : -Math.PI / 2);
      }));
    }
    split(g, { t: 'gstart', g: gid, ready: READY, dur: G.dur, parts: partsOf(g) }, { t: 'gstate', g: gid, ph: 'ready', left: g.end - t0, parts: partsOf(g) }); // 구경꾼은 시작 알림 없이 발밑 링만 그림
    pushLobby(gid);
  }

  const partsOf = (g) => [...g.parts].map(([id, v]) => (g.gid === 'tag' ? [id, v.role] : [id, v.team, v.hp, v.out ? 1 : 0]));
  const names = (ids) => ids.map((id) => byId(id)?.nick).filter(Boolean);

  function end(gid, result) {
    const g = run[gid];
    if (!g) return;
    run[gid] = null;
    split(g, { t: 'gend', g: gid, ...result, parts: partsOf(g) }, { t: 'gend', g: gid }); // 누가 이겼는지는 참가자만, 구경꾼은 '끝남'만 (링·물풍선 정리)
    [...g.parts.keys()].map(byId).filter(Boolean).forEach((p, i) => sendHome(p, i, GAMES[gid]));
    for (const id of Object.keys(GAMES)) refresh(id);
  }

  // 술래가 도망자를 잡으면 도망자도 술래가 됨
  function tickTag(g, t) {
    const its = [], runs = [];
    for (const [id, v] of g.parts) { const p = byId(id); if (p) (v.role === 'it' ? its : runs).push([id, p]); }
    for (const [rid, rp] of runs) for (const [iid, ip] of its) {
      if (Math.hypot(rp.x - ip.x, rp.z - ip.z) < TAG_R && Math.abs((rp.y || 0) - (ip.y || 0)) < 0.9) {
        g.parts.get(rid).role = 'it'; split(g, { t: 'gtag', id: rid, by: iid }); break;
      }
    }
    const left = [...g.parts].filter(([, v]) => v.role === 'run').map(([id]) => id);
    if (!left.length) return end('tag', { win: 'it', msg: '전원 술래가 됐어요! 술래 팀 승리', winners: [] });
    if (t >= g.end) end('tag', { win: 'run', msg: `끝까지 도망친 사람 ${left.length}명!`, winners: names(left) });
  }

  function tickDodge(g, t, dt) {
    for (const b of [...g.balloons]) {
      const step = SPEED * dt;
      b.x += b.dx * step; b.z += b.dz * step; b.dist += step;
      let hit = null;
      for (const [id, v] of g.parts) {
        const p = byId(id);
        if (!p || v.out || v.team === b.team) continue;
        if (Math.hypot(p.x - b.x, p.z - b.z) < HIT_R && (p.y || 0) < DODGE_Y) { hit = [id, v]; break; } // 점프하면 피함
      }
      const off = Math.abs(b.x - DODGE.cx) > DODGE.hw + 0.4 || Math.abs(b.z - DODGE.cz) > DODGE.hd + 0.4;
      if (hit || b.dist > RANGE || off) {
        g.balloons.splice(g.balloons.indexOf(b), 1);
        bcast({ t: 'bend', id: b.id, x: +b.x.toFixed(2), z: +b.z.toFixed(2), hit: hit ? hit[0] : 0 });
        if (hit) {
          const [id, v] = hit;
          v.hp = Math.max(0, v.hp - 1);
          if (v.hp === 0) { v.out = true; const p = byId(id); const [x, z] = dodgeOut(v.team, v.idx); tp(p, x, z, v.team === 0 ? Math.PI / 2 : -Math.PI / 2); }
          split(g, { t: 'ghit', id, hp: v.hp, by: b.by });
        }
      }
    }
    const alive = [0, 1].map((tm) => [...g.parts.values()].filter((v) => v.team === tm && !v.out).length);
    const hpSum = [0, 1].map((tm) => [...g.parts.values()].filter((v) => v.team === tm).reduce((s, v) => s + v.hp, 0));
    const teamNames = (tm) => names([...g.parts].filter(([, v]) => v.team === tm).map(([id]) => id));
    const finish = (win, msg) => end('dodge', { win, msg, winners: win === 2 ? [] : teamNames(win) });
    if (!alive[0] || !alive[1]) return finish(alive[0] ? 0 : alive[1] ? 1 : 2, alive[0] ? '파랑 팀 승리!' : alive[1] ? '빨강 팀 승리!' : '무승부');
    if (t >= g.end) finish(hpSum[0] === hpSum[1] ? 2 : hpSum[0] > hpSum[1] ? 0 : 1, hpSum[0] === hpSum[1] ? '시간 종료! 무승부' : `시간 종료! ${hpSum[0] > hpSum[1] ? '파랑' : '빨강'} 팀이 더 많이 남았어요`);
  }

  function tick() {
    const t = now();
    for (const gid of Object.keys(GAMES)) {
      const l = lobby[gid];
      if (l.cd) { if (t >= l.cd) start(gid); else if (Math.ceil((l.cd - t) / 1000) !== l.sec) pushLobby(gid); }
      const g = run[gid];
      if (!g) continue;
      const dt = Math.min(0.1, (t - g.last) / 1000); g.last = t;
      if (g.phase === 'ready' && t >= g.readyEnd) { g.phase = 'play'; bcast({ t: 'gstate', g: gid, ph: 'play', left: g.end - t, parts: partsOf(g) }); }
      if (g.phase !== 'play') continue;
      gid === 'tag' ? tickTag(g, t) : tickDodge(g, t, dt);
      if (run[gid] && t - g.bcastAt > 250) { g.bcastAt = t; bcast({ t: 'gstate', g: gid, ph: 'play', left: g.end - t, parts: partsOf(g) }); }
    }
  }

  return {
    tick,
    onMove(p) { // 패드에 올라섰는지/내려갔는지
      const stuck = !p.game && arenaAt(p.x, p.z); // 게임 중이 아닌데 경기장 안에 갇혔으면 꺼내 줌
      if (stuck) sendHome(p, 0, stuck);
      const pad = p.game ? null : padOf(p.x, p.z);
      if (pad === p.pad) return;
      const old = p.pad; p.pad = pad;
      if (old) refresh(old);
      if (pad) refresh(pad);
    },
    onLeave(p) {
      const old = p.pad; p.pad = null;
      if (old) refresh(old);
      const g = p.game && run[p.game];
      if (!g || !g.parts.delete(p.id)) return;
      if (g.gid === 'tag') {
        const roles = [...g.parts.values()].map((v) => v.role);
        if (g.parts.size < 2) return end('tag', { win: 'none', msg: '인원이 모자라서 끝났어요', winners: [] });
        if (!roles.includes('it')) g.parts.get([...g.parts.keys()][0]).role = 'it'; // 술래가 나가면 한 명이 대신
      } else if (![0, 1].every((tm) => [...g.parts.values()].some((v) => v.team === tm && !v.out))) end('dodge', { win: 2, msg: '상대 팀이 나가서 끝났어요', winners: [] });
    },
    frozen: (p) => !!p.game && run[p.game]?.phase === 'ready',
    info(p) { const g = p.game && run[p.game], v = g?.parts.get(p.id); return v ? { phase: g.phase, role: v.role, team: v.team, out: !!v.out } : null; }, // 봇이 놀 때 보는 내 역할·팀 (화면은 gstate 로 받음)
    busy: (gid) => !!run[gid],
    clamp(p, x, z) {
      const v = p.game === 'dodge' && run.dodge?.parts.get(p.id);
      return v && !v.out ? dodgeClamp(v.team, x, z) : [x, z];
    },
    throwBalloon(p, m) {
      const g = run.dodge, v = p.game === 'dodge' && g?.parts.get(p.id);
      if (!v || v.out || g.phase !== 'play' || now() < v.cd) return;
      let { dx, dz } = m; const l = Math.hypot(dx, dz);
      if (!Number.isFinite(l) || l < 0.01) return;
      dx /= l; dz /= l; v.cd = now() + THROW_CD;
      const b = { id: g.nextB++, by: p.id, team: v.team, x: p.x + dx * 0.7, z: p.z + dz * 0.7, dx, dz, dist: 0 };
      g.balloons.push(b);
      bcast({ t: 'balloon', id: b.id, by: p.id, team: v.team, x: +b.x.toFixed(2), z: +b.z.toFixed(2), dx: +dx.toFixed(3), dz: +dz.toFixed(3), sp: SPEED, max: RANGE });
    },
    snapshot() { // 새로 들어온 사람에게 지금 상황
      const out = Object.keys(GAMES).map((gid) => { const l = lobby[gid], G = GAMES[gid]; return { t: 'lobby', g: gid, n: l.ids.size, min: G.min, max: G.max, cd: l.sec, busy: !!run[gid] }; });
      for (const g of Object.values(run)) if (g) out.push({ t: 'gstate', g: g.gid, ph: g.phase, left: g.end - now(), parts: partsOf(g) });
      return out;
    },
  };
}
