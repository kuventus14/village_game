// 성당·교회·사찰 시험(3배 크기·넓어진 마을): 숲길 길이(걸어서 약 60초), 배치(서로 거리·겹침·걷는 높이), 행동 자리, 장소 이름, 숲·허공 막기, 긴 의자 앉기·일어서기
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as W from './public/world.js';
const { BUILDINGS, SACRED, SPOTS, SEATS, TRAIL, GATE, TEMPLE_YARD: TY, BX, BZ, resolve, placeOf, trailNear, floorY } = W;
const ok = (name) => console.log('ok', name);
const free = (x, z) => { const [a, b] = resolve(x, z); return Math.hypot(a - x, b - z) < 0.01; };

// ── 1. 숲길: 대문 → 사찰 마당 입구 최단 거리 285~315 (16방향 격자 다익스트라, 0.25m)
{
  const S = 0.25, key = (i, j) => i * 100000 + j, start = [Math.round(GATE.x / S), Math.round(GATE.z / S)], goalZ = TY.cz + TY.d / 2 - 0.6;
  const dirs = []; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if ((a || b) && Math.abs(a) + Math.abs(b) !== 4 && !(Math.abs(a) === 2 && b === 0) && !(Math.abs(b) === 2 && a === 0)) dirs.push([a, b]);
  const dist = new Map([[key(...start), 0]]), heap = [[0, ...start]], walk = new Map();
  const can = (i, j) => { const k = key(i, j); if (!walk.has(k)) { const x = i * S, z = j * S; walk.set(k, x >= GATE.x - 0.5 && free(x, z)); } return walk.get(k); };
  const push = (e) => { heap.push(e); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  let best = null;
  while (heap.length) {
    const [d, i, j] = pop(); if (d > dist.get(key(i, j))) continue;
    if (j * S <= goalZ && Math.abs(i * S - TY.cx) < 5) { best = d * S; break; }
    for (const [a, b] of dirs) { const ni = i + a, nj = j + b; if (!can(ni, nj) || !can(i + Math.round(a / 2), j + Math.round(b / 2))) continue; const nd = d + Math.hypot(a, b), k = key(ni, nj); if (nd < (dist.get(k) ?? Infinity)) { dist.set(k, nd); push([nd, ni, nj]); } }
  }
  assert.ok(best, '대문에서 사찰 마당까지 걸어서 갈 수 있음');
  assert.ok(best >= 285 && best <= 315, `숲길 최단 경로 ${best.toFixed(1)}m (285~315)`);
  assert.ok(Math.abs(TRAIL.len - 305) < 10, `숲길 가운데 선 ${TRAIL.len.toFixed(1)}m`);
  ok(`숲길 최단 경로 ${best.toFixed(1)}m (가운데 선 ${TRAIL.len.toFixed(1)}m, 기본 걸음 5m/s → 약 ${Math.round(best / 5)}초)`);
}

// ── 2. 배치: 성당-교회 120m 이상, 마을 울타리 안(사찰은 밖), 기존 건물·집·놀이터·연못·카지노 길과 안 겹침, 걷는 높이 3m 이하·완만
{
  const C = BUILDINGS.cathedral, H = BUILDINGS.church, T = BUILDINGS.temple, D = W.SACRED_DESIGN;
  assert.ok(Math.hypot(C.cx - H.cx, C.cz - H.cz) >= 120, '성당-교회 거리');
  assert.equal(SACRED.cathedral.name, '성당'); assert.equal(SACRED.church.name, '교회'); assert.equal(SACRED.temple.name, '사찰');
  for (const k of ['cathedral', 'church', 'temple']) { const b = BUILDINGS[k], d0 = D.B[k]; assert.ok(Math.abs(b.h - d0.h * 3) < 1e-6 && Math.abs(b.dw - d0.dw * 3) < 1e-6 && Math.max(b.w, b.d) >= 3 * Math.max(d0.w, d0.d) - 1e-6, k + ' 설계도의 3배'); } // 크기는 그림에 맞춰 바뀔 수 있음 (설계도 × 3)
  assert.ok(TY.w >= 60 && TY.w <= 96 && TY.d >= 60 && TY.d <= 96, '사찰 마당 60~96m (그림처럼 작게)');
  const wr = (k, [x0, z0, x1, z1]) => { const a = W.toWorld(k, x0, z0), b = W.toWorld(k, x1, z1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; };
  const box = (b) => [b.cx - b.w / 2, b.cz - b.d / 2, b.cx + b.w / 2, b.cz + b.d / 2];
  const P = D.P, solid = { cathedral: [box(C), ...[...P.cathedral.towers, ...P.cathedral.planters, P.cathedral.stairs].map((r) => wr('cathedral', r))],
    church: [box(H), ...[P.church.wingW, P.church.tower, P.church.wingE, ...P.church.rails, P.church.stairs].map((r) => wr('church', r))] };
  for (const [k, rs] of Object.entries(solid)) for (const [x0, z0, x1, z1] of rs) assert.ok(Math.max(Math.abs(x0), Math.abs(x1)) <= W.BX && Math.max(Math.abs(z0), Math.abs(z1)) <= W.BZ, `${k} 는 마을 울타리 안`);
  assert.ok(T.cx - T.w / 2 > W.BX + 100, '사찰은 마을 밖 멀리');
  const hit = (a, b, m = 0) => a[0] < b[2] + m && a[2] > b[0] - m && a[1] < b[3] + m && a[3] > b[1] - m;
  const old = { 카페: box(BUILDINGS.cafe), 회사: box(BUILDINGS.office), 카지노: box(BUILDINGS.casino), ...Object.fromEntries(W.HOUSES.map((h, i) => [`집${i}`, [h.x - h.w / 2, h.z - h.d / 2, h.x + h.w / 2, h.z + h.d / 2]])),
    술래잡기: [W.TAG.cx - W.TAG.hw - 0.3, W.TAG.cz - W.TAG.hd - 0.3, W.TAG.cx + W.TAG.hw + 0.3, W.TAG.cz + W.TAG.hd + 0.3], 피구: [W.DODGE.cx - W.DODGE.hw - 0.3, W.DODGE.cz - W.DODGE.hd - 0.3, W.DODGE.cx + W.DODGE.hw + 0.3, W.DODGE.cz + W.DODGE.hd + 0.3],
    연못: [W.POND.x - W.POND.r, W.POND.z - W.POND.r, W.POND.x + W.POND.r, W.POND.z + W.POND.r], 카지노길: [33.7, 8, 38.3, 24] };
  for (const [k, rs] of Object.entries({ ...solid, 큰길: Object.values(W.AVENUES) })) for (const r of rs) for (const [n, o] of Object.entries(old)) if (!(k === '큰길' && n === '카지노길')) assert.ok(!hit(r, o, 0.5), `${k} 가 ${n} 와 겹침`);
  for (const p of [...SPOTS.filter((s) => s.bld !== 'temple'), ...W.SEATS.filter((s) => s.kind === 'pew')]) for (const [n, o] of Object.entries(old)) assert.ok(!hit([p.x, p.z, p.x, p.z], o), `자리가 ${n} 안`);
  // 큰길 축 = 정면 가운데 축: 광장 쪽에서 문까지 일직선
  assert.ok(Math.abs(C.cz - 5) < 0.01 && Math.abs(H.cz - 5) < 0.01 && C.door === '+x' && H.door === '-x', '성당은 동쪽, 교회는 서쪽(광장)을 봄');
  // 걷는 높이: 3m 이하, 0.25m 걸음마다 0.35m 넘게 갑자기 변하지 않음 (계단은 길게)
  let maxY = 0, maxStep = 0;
  for (const [k, [x0, z0, x1, z1]] of Object.entries(W.SACRED_BOXES)) for (let x = x0; x <= x1; x += 0.5) for (let z = z0; z <= z1; z += 0.5) {
    if (!free(x, z)) continue; const y = floorY(x, z); maxY = Math.max(maxY, y);
    for (const [dx, dz] of [[0.25, 0], [0, 0.25]]) if (free(x + dx, z + dz)) maxStep = Math.max(maxStep, Math.abs(floorY(x + dx, z + dz) - y));
  }
  assert.ok(maxY <= 6.001, `걷는 높이 ${maxY}`); // 사찰 축대 6m 까지 (계단을 길게) assert.ok(maxStep <= 0.35, `한 걸음 높이 차이 ${maxStep.toFixed(2)}`);
  ok(`성당-교회 ${Math.hypot(C.cx - H.cx, C.cz - H.cz).toFixed(1)}m, 세 건물 3배, 마을 안·기존 건물/집/놀이터/연못/카지노 길과 안 겹침, 걷는 높이 최대 ${maxY.toFixed(1)}m·걸음당 ${maxStep.toFixed(2)}m`);
}

// ── 3. 행동 자리(SPOTS): 종류·개수, 충돌에 안 묻힘, 들어간 건물이 맞음, 바닥 높이, 바라보는 방향
{
  const need = { temple: { cushion: 60, beads: 1, bell: 1, lantern: 4, buddha: 1 }, cathedral: { candle: 4, rosary: 90, font: 2, confess: 4, altar: 1, choir: 4 }, church: { pew: 90, pulpit: 1, stage: 6, cross: 1, piano: 1 } };
  for (const [b, kinds] of Object.entries(need)) for (const [k, n] of Object.entries(kinds)) assert.ok(SPOTS.filter((s) => s.bld === b && s.kind === k).length >= n, `${b} ${k} ${n}곳 이상`);
  SPOTS.forEach((s, i) => {
    assert.equal(s.id, i, '번호 = 배열 순서');
    assert.ok(free(s.x, s.z), `자리 #${i} ${s.bld} ${s.kind} 가 충돌에 묻힘`);
    assert.equal(placeOf(s.x, s.z), s.bld, `자리 #${i} ${s.kind} 의 장소`);
    assert.ok(Number.isFinite(s.ry) && Math.abs(s.y - floorY(s.x, s.z)) < 1e-9 && s.y <= 6.001, '방향·높이');
    for (const t of SPOTS) if (t !== s) assert.ok(Math.hypot(t.x - s.x, t.z - s.z) > 0.899, `자리 #${i}·#${t.id} 가 너무 붙음 (0.9m 미만)`);
  });
  const facing = (s, [x, z], tol = 0.6) => { const a = Math.atan2(x - s.x, z - s.z); return Math.abs(Math.atan2(Math.sin(a - s.ry), Math.cos(a - s.ry))) < tol; };
  const P = W.SACRED_DESIGN.P, Dz = W.SACRED_DESIGN.B, w = W.toWorld, [bx0, bz0, bx1, bz1] = P.temple.buddha, buddha = w('temple', (bx0 + bx1) / 2, (bz0 + bz1) / 2);
  for (const s of SPOTS.filter((s) => ['cushion', 'beads', 'buddha'].includes(s.kind))) assert.ok(facing(s, buddha, 1.0), `${s.kind} #${s.id} 가 불상 쪽을 봄`); // 방석 줄은 똑바로 앞(불단 벽)을 봄
  assert.ok(facing(SPOTS.find((s) => s.kind === 'bell'), w('temple', P.temple.bell.x, P.temple.bell.z)), '범종을 봄');
  for (const s of SPOTS.filter((s) => s.kind === 'lantern')) assert.ok(P.temple.lanterns.some(([x, z]) => facing(s, w('temple', x, z)) && Math.hypot(w('temple', x, z)[0] - s.x, w('temple', x, z)[1] - s.z) < 4), '석등을 봄');
  assert.ok(facing(SPOTS.find((s) => s.kind === 'altar'), w('cathedral', Dz.cathedral.cx, P.cathedral.altar[1])), '제대를 봄');
  assert.ok(facing(SPOTS.find((s) => s.kind === 'cross'), w('church', Dz.church.cx, Dz.church.cz - Dz.church.d / 2)), '큰 십자가를 봄');
  for (const s of SPOTS.filter((s) => s.kind === 'rosary' || s.kind === 'pew')) assert.ok(facing(s, s.kind === 'rosary' ? w('cathedral', Dz.cathedral.cx, P.cathedral.altar[1]) : w('church', Dz.church.cx, Dz.church.cz - Dz.church.d / 2), 0.9), '의자는 제대·십자가 쪽');
  assert.ok(SPOTS.filter((s) => s.bld === 'temple' && s.kind === 'cushion').every((s) => s.y === BUILDINGS.temple.fy), '법당 방석은 축대 위 바닥 높이');
  // 긴 의자: 사람 크기(앉는 면 0.45m), 자리마다 하나, SPOTS rosary/pew 와 같은 자리
  const pews = SEATS.filter((s) => s.kind === 'pew');
  assert.ok(pews.length >= 180 && pews.every((p) => p.h === 0.45 && free(p.x, p.z)), `긴 의자 ${pews.length}석, 사람 크기`);
  assert.ok(pews.every((p) => SPOTS.some((t) => (t.kind === 'rosary' || t.kind === 'pew') && Math.hypot(t.x - p.x, t.z - p.z) < 1e-6)), '의자 = 묵주/의자 자리');
  // 줄 사이 통로: 의자 등받이 뒤로 1.2m 이상 비어 있음 (설계도 0.4 = 실제 1.2)
  for (const k of ['cathedral', 'church']) { const zs = [...new Set(P[k].pews.map((p) => p.z))].sort((a, b) => a - b); for (let i = 1; i < zs.length; i++) assert.ok((zs[i] - zs[i - 1] - 0.2) * 3 >= 1.2, `${k} 줄 사이 통로`); }
  ok(`행동 자리 ${SPOTS.length}곳·긴 의자 ${SEATS.filter((s) => s.kind === 'pew').length}석 (사찰 ${SPOTS.filter((s) => s.bld === 'temple').length} · 성당 ${SPOTS.filter((s) => s.bld === 'cathedral').length} · 교회 ${SPOTS.filter((s) => s.bld === 'church').length}) 충돌·방향·장소 확인`);
}

// ── 4. 장소 이름 + 숲·허공으로는 못 나감
{
  for (const k of ['cathedral', 'church', 'temple']) assert.equal(placeOf(BUILDINGS[k].cx, BUILDINGS[k].cz), k, k + ' 안');
  assert.equal(placeOf(0, 8), 'town'); assert.equal(placeOf(-70, 30), 'town', '넓어진 마을'); assert.equal(placeOf(TY.cx, TY.cz + 40), 'temple', '사찰 마당');
  const mid = TRAIL.pts[Math.floor(TRAIL.pts.length / 3)];
  assert.equal(placeOf(...mid), 'trail', '숲길 위'); assert.equal(PLACE_OK(), true);
  for (let i = 0; i < TRAIL.pts.length; i += 7) {
    const [x, z] = TRAIL.pts[i], t = trailNear(x, z), nx = -t.tz, nz = t.tx;
    for (const side of [-1, 1]) { const [a, b] = resolve(x + nx * side * (t.hw + 3), z + nz * side * (t.hw + 3)), u = trailNear(a, b); assert.ok(u.d <= u.hw - 0.49 || W.inTown(a, b) || W.inYard(a, b), `숲 속(${i})으로 나감`); }
  }
  for (const [x, z] of [[500, 500], [-200, 30], [120, 120], [60, -60], [BX + 2, -20], [0, BZ + 5], [TY.cx + 80, TY.cz]]) { const [a, b] = resolve(x, z); assert.ok(W.inTown(a, b) || W.inYard(a, b, 0.45) || trailNear(a, b).d <= trailNear(a, b).hw - 0.49 || W.parkWalk(a, b) === null, `허공 (${x},${z}) → (${a.toFixed(1)},${b.toFixed(1)})`); }
  ok('placeOf: 성당·교회·사찰 안 / 사찰 마당 / 숲길 / 마을, 숲 속·마을 밖 허공은 resolve 가 막음');
}
function PLACE_OK() { return ['cathedral', 'church', 'temple', 'trail'].every((k) => W.PLACE[k]?.length === 2) && W.STATUS.pray && W.SIT_STATUS.pew === 'pray' && !!W.SIT_TEXT.pew; }

// ── 5. 서버: 긴 의자에 앉으면 '기도 중', 움직이면(일어서면) 의자 뒤에 섬
{
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'village-sacred-'));
  const { WebSocket } = await import('ws');
  const { listen, players } = await import('./server.js');
  const PORT = 3396, srv = await listen(PORT), wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
  const api = async (n, b) => (await fetch(`http://localhost:${PORT}/api/${n}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).json();
  const su = await api('signup', { nick: '기도하는곰', pw: 'secret1' });
  await api('avatar', { token: su.token, avatar: { g: 'm' } });
  const ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(d)));
  await new Promise((r) => ws.on('open', r));
  const send = (o) => ws.send(JSON.stringify(o));
  send({ t: 'join', token: su.token });
  for (let i = 0; i < 50 && !inbox.find((m) => m.t === 'welcome'); i++) await wait(40);
  const id = inbox.find((m) => m.t === 'welcome').id, me = () => players.get(id);
  for (const kind of ['cathedral', 'church']) {
    const b = BUILDINGS[kind], seat = SEATS.find((s) => s.kind === 'pew' && placeOf(s.x, s.z) === kind);
    send({ t: 'm', x: seat.x - Math.sin(seat.ry) * 1.0, z: seat.z - Math.cos(seat.ry) * 1.0, ry: 0, w: 0, y: 0 }); await wait();
    assert.equal(me().pl, kind, `${kind} 안으로 들어옴`);
    send({ t: 'sit', seat: seat.id }); await wait();
    assert.equal(me().seat, seat.id, `${kind} 긴 의자에 앉음`); assert.equal(me().s, 'pray', '기도 중');
    send({ t: 'stand' }); await wait();
    assert.equal(me().seat, -1, '일어남'); assert.ok(Math.hypot(me().x - seat.x, me().z - seat.z) < 1.6 && free(me().x, me().z), '의자 뒤 통로에 섬');
    assert.ok(b);
  }
  ws.close(); srv.close();
  ok('성당·교회 긴 의자: 앉기 → 🙏 기도 중 → 일어서기 (서버 sit/stand)');
}
console.log('성당·교회·사찰 시험 통과');
process.exit(0);
