// 성당·교회·사찰 실내 — 참고 그림 docs/ref/interior-{1-church,2-cathedral,3-temple}.webp 을 따라 지음.
// 설계도 좌표(1배)로 짓고 sacred.js 가 단지 그룹째 3배로 키움. 사람이 쓰는 물건(의자·방석·촛불대·피아노 등)은 사람 크기 = 설계도의 1/3 (S)
// 위치는 world.js 의 설계도(SACRED_DESIGN)를 그대로 따름 → 충돌·SPOTS·SEATS 와 항상 일치
import * as THREE from 'three';
import { bx, cy, sp, plane, lathe, leaf, hdr, face } from './buildings.js';
import { lancetShape, archShape, lancet, arch, ring, cross, candle, flowers, pewRow, inBands } from './sacred.js';

const PI = Math.PI, S = 1 / 3, GOLD = '#f2c35a';
// 박공 안쪽 삼각 벽 (z 위치, 아래 폭 w, 높이 h, 안쪽을 봄)
const gable = (k, cx, y, z, w, h, inward, color) => k.at(cx, y, z, inward > 0 ? 0 : PI).p('plain', new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)])), [0, 0, 0], color);
const slope = (w, len, th, t = 0) => plane(w, len, t).rotateX(PI / 2).rotateZ(th); // 아래를 보는 경사 천장 판 (z 방향으로 긺, th 만큼 기울임)
// 벽 판 + 뾰족 아치 구멍 (성당 아케이드: 기둥 사이 아치 위 벽)
function archWall(w, h, aw, ah, shape = lancetShape) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath(); const hole = new THREE.Path(); shape(aw, ah, hole); s.holes.push(hole); return new THREE.ShapeGeometry(s, 8); }
// 사슬에 매달린 랜턴 (y = 랜턴 몸 가운데, len = 사슬 길이). s = 크기(설계도 단위 배율)
function lantern(k, x, y, z, s, frame, len) {
  k.at(x, y, z).p('plain', cy(0.012 * s, 0.012 * s, len, 4), [0, 0.3 * s + len / 2, 0], '#4a3b40');
  const fc = frame === 'shine' ? '#c9a066' : '#5a4468'; // 틀은 얇게, 유리는 따뜻하게 환히
  k.p(frame, cy(0.1 * s, 0.17 * s, 0.07 * s, 8), [0, 0.26 * s, 0], fc).p(frame, cy(0.035 * s, 0.035 * s, 0.05 * s, 6), [0, 0.33 * s, 0], fc);
  k.p('glow', cy(0.155 * s, 0.135 * s, 0.4 * s, 8), [0, 0.02 * s, 0], hdr('#ffe38e', 2.6));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; k.p(frame, bx(0.012 * s, 0.4 * s, 0.012 * s), [Math.cos(a) * 0.16 * s, 0.02 * s, Math.sin(a) * 0.16 * s], fc); }
  k.p(frame, cy(0.15 * s, 0.1 * s, 0.05 * s, 8), [0, -0.2 * s, 0], fc);
}
// 벽 등 (벽 face 프레임 안에서)
const sconce = (k, y, c = '#c9a066') => k.p('shine', bx(0.05, 0.16, 0.05), [0, y, 0.04], c).p('glow', cy(0.05, 0.04, 0.12, 8), [0, y + 0.12, 0.09], hdr('#ffd98a', 1.6)).p('shine', cy(0.06, 0.06, 0.02, 8), [0, y + 0.19, 0.09], c);
// 화분 (꽃 덩어리 c) — 사람 크기 배율 s
function potFlower(k, x, y, z, s, c, pot = '#f2e7dc') {
  k.at(x, y, z).p('plain', lathe([[0, 0], [0.18, 0], [0.24, 0.3], [0.27, 0.34], [0, 0.34]].map(([r, h]) => [r * s, h * s]), 10), [0, 0, 0], pot);
  [[0, 0.5, 0, 0.26], [0.16, 0.45, 0.08, 0.18], [-0.15, 0.46, -0.06, 0.19], [0.03, 0.62, -0.1, 0.16]].forEach(([dx, dy, dz, r], i) => k.p('plain', leaf(r * s, i + x), [dx * s, dy * s, dz * s], i === 1 ? '#6cc47b' : c));
}
function topiary(k, x, y, z, s) { k.at(x, y, z).p('plain', lathe([[0, 0], [0.22, 0], [0.26, 0.36], [0, 0.36]].map(([r, h]) => [r * s, h * s]), 10), [0, 0, 0], '#efe4da').p('wood', cy(0.03 * s, 0.04 * s, 0.6 * s, 6), [0, 0.6 * s, 0], '#8a5a3c').p('plain', leaf(0.42 * s, x), [0, 1.15 * s, 0], '#5bb86c'); }

/* ───── 성당 (그림 interior-2): 보라 리브 볼트 + 크림 기둥 다발 아케이드 + 트리포리움 + 높은 창 + 장미창 + 십자고상 + 성모상·촛불 + 십자가의 길 ───── */
const CREAM = '#f7e6d6', CREAM2 = '#eed6c2', VIOLET = '#9a62b8', PINKFLOOR = '#f2cdc6';
export function cathedralIn(k, b, C) {
  const F = b.fy, H = b.h, cx = b.cx, x0 = b.cx - b.w / 2 + 0.2, x1 = b.cx + b.w / 2 - 0.2, z0 = b.cz - b.d / 2 + 0.2, z1 = b.cz + b.d / 2 - 0.2;
  const PX = 3.4, SPRING = F + 3.6, APEX = F + 5.0, TRI = F + 5.25, CLER = F + 6.1, AISLE = F + 4.6;
  const pz = [...new Set(C.piers.map((p) => p.z))].sort((a, b) => a - b), bays = [z0, ...pz, z1];
  // 바닥: 분홍 둥근 돌 + 제단 구역 한 단 + 앞 계단
  k.at(cx, F + 0.004, b.cz).p('paver', plane(b.w - 0.4, b.d - 0.4, 0.55), [0, 0, 0], PINKFLOOR, [-PI / 2, 0, 0]);
  k.at(cx, F, (z0 + C.sanctuary) / 2).p('paver', bx(x1 - x0, 0.1, C.sanctuary - z0, 0.55), [0, 0.05, 0], '#f0c8c0').p('plain', bx(5.6, 0.05, 0.25), [0, 0.025, (C.sanctuary - z0) / 2 + 0.12], '#f3d8cc');
  // 벽: 크림 돌 + 측랑 높이 아래 판넬 띠
  inBands(k, b, F, H - 0.05, 'plain', '#f6e0d4', F + 2.9);
  inBands(k, b, F, F + 0.25, 'plain', CREAM2, F + 2.9);
  // 신자석과 측랑을 나누는 기둥 다발 + 기둥 사이 뾰족 아치 벽(아케이드) + 트리포리움(작은 아치 줄) + 높은 스테인드글라스 창 (양쪽 면)
  for (const p of C.piers) {
    k.at(p.x, F, p.z).p('plain', cy(p.r, p.r + 0.04, SPRING - F, 14), [0, (SPRING - F) / 2, 0], CREAM).p('plain', bx(p.r * 2 + 0.2, 0.2, p.r * 2 + 0.2), [0, 0.1, 0], CREAM2);
    for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; k.p('plain', cy(0.09, 0.09, H - 1.2 - F, 6), [Math.cos(a) * p.r, (H - 1.2 - F) / 2, Math.sin(a) * p.r], '#fbeadc'); } // 천장까지 오르는 가는 기둥
    k.p('plain', bx(p.r * 2 + 0.3, 0.24, p.r * 2 + 0.3), [0, SPRING - F, 0], CREAM2);
    k.at(p.x, F, p.z, p.x < cx ? PI / 2 : -PI / 2).sub(0, 0, 0.32); sconce(k, 2.1 * S + 0.4, '#c9a066'); // 기둥 벽 등 (측랑 쪽)
  }
  for (const s of [-1, 1]) for (let i = 0; i < bays.length - 1; i++) {
    const za = bays[i], zb = bays[i + 1], w = zb - za, zm = (za + zb) / 2, open = i > 0;
    for (const side of [0, PI]) {
      k.at(cx + s * PX, F, zm, PI / 2 + side);
      k.p('plain', open ? archWall(w, H - 0.6 - F, w - 0.7, APEX - F) : new THREE.PlaneGeometry(w, H - 0.6 - F).translate(0, (H - 0.6 - F) / 2, 0), [0, 0, 0.01], '#f4dccd');
      if (open) k.p('plain', ring(lancetShape, w - 0.45, APEX - F + 0.12, w - 0.7, APEX - F), [0, 0, 0.02], '#fbeadc');
      for (let j = 0; j < 4; j++) k.p('plain', ring(lancetShape, w / 4 - 0.06, 0.62, w / 4 - 0.18, 0.52), [-w / 2 + (j + 0.5) * w / 4, TRI - F, 0.03], '#e8cfb9').p('plain', lancet(w / 4 - 0.18, 0.52), [-w / 2 + (j + 0.5) * w / 4, TRI - F, 0.015], '#b9a3c4'); // 트리포리움
      k.p('plain', bx(w, 0.12, 0.12), [0, TRI - F - 0.08, 0.05], '#fbeadc').p('plain', bx(w, 0.1, 0.1), [0, CLER - F - 0.2, 0.05], '#fbeadc');
      for (const dx of [-0.35, 0.35]) k.p('stained', lancet(0.5, 1.8), [dx * (w > 1.6 ? 1 : 0.6), CLER - F, 0.02], '#ffffff').p('plain', ring(lancetShape, 0.62, 1.9, 0.5, 1.8), [dx * (w > 1.6 ? 1 : 0.6), CLER - F - 0.05, 0.03], '#f3decb'); // 높은 창
    }
  }
  // 신자석 천장: 보라 뾰족 볼트 (두 경사면) + 가로 리브(뾰족 아치) + 대각선 리브 + 용마루 리브 / 측랑 천장: 보라 평판 + 반 아치 리브
  const VH = H - 0.6, VA = H + 1.5, sl = Math.hypot(PX, VA - VH), tilt = Math.atan2(VA - VH, PX);
  for (const s of [-1, 1]) k.at(cx + s * PX / 2, (VH + VA) / 2, b.cz).p('plain', slope(sl, b.d - 0.4, -s * tilt), [0, 0, 0], VIOLET);
  for (const z of [z0 + 0.05, ...pz]) { k.at(cx, VH - 3.7, z).p('plain', ring(lancetShape, PX * 2 + 0.35, VA - VH + 3.95, PX * 2 - 0.05, VA - VH + 3.7), [0, 0, 0], '#fff0e2'); } // 뾰족 아치는 높이 ≥ 폭×0.8 이어야 모양이 안 꼬임 // 크림 리브 아치 (굵게)
  for (let i = 0; i < pz.length - 1; i++) { const za = pz[i], zb = pz[i + 1], d = Math.hypot(PX * 2, zb - za); for (const s of [-1, 1]) k.at(cx, VH + 0.6, (za + zb) / 2, s * Math.atan2(PX * 2, zb - za)).p('plain', new THREE.TorusGeometry(d / 2, 0.06, 5, 16, PI), [0, -0.6, 0], '#efdcc9', [0, PI / 2, 0]); }
  k.at(cx, VA - 0.05, b.cz).p('plain', bx(0.14, 0.1, b.d - 0.4), [0, 0, 0], '#efdcc9');
  gable(k, cx, VH - 0.6, z0 + 0.01, PX * 2 + 0.4, VA - VH + 0.7, 1, '#f4dccd'); gable(k, cx, VH - 0.6, z1 - 0.01, PX * 2 + 0.4, VA - VH + 0.7, -1, '#f4dccd'); // 신자석 천장 양 끝 벽
  for (const z of [z0 + 0.01, z1 - 0.01]) k.at(cx, (H - 0.05 + VH) / 2, z, z < b.cz ? 0 : PI).p('plain', plane(b.w - 0.4, VH - H + 0.6), [0, 0, 0], '#f4dccd');
  for (const s of [-1, 1]) { const ax = cx + s * (PX + (b.w / 2 - 0.2 - PX) / 2); k.at(ax, AISLE + 0.6, b.cz).p('plain', plane(b.w / 2 - 0.2 - PX, b.d - 0.4), [0, 0, 0], '#83599a', [PI / 2, 0, 0]); for (const z of pz) k.at(ax, AISLE - 0.4, z).p('plain', new THREE.TorusGeometry((b.w / 2 - 0.2 - PX) / 2, 0.05, 5, 12, PI), [0, 0, 0], '#efdcc9'); }
  // 제대 뒤 벽: 큰 장미창 + 뾰족 창 넷 + 뾰족 아치 감실(제대 뒤 장식벽) + 십자고상
  k.at(cx, F, z0);
  k.p('rose', fitShape2(new THREE.CircleGeometry(1.45, 36)), [0, 7.1, 0.03], '#ffffff').p('plain', new THREE.TorusGeometry(1.5, 0.14, 6, 36), [0, 7.1, 0.05], '#fbeadc');
  for (const [x, y, w, h] of [[-2.1, 3.4, 0.75, 2.9], [2.1, 3.4, 0.75, 2.9], [-4.4, 1.5, 0.7, 2.4], [4.4, 1.5, 0.7, 2.4]]) k.p('stained', lancet(w, h), [x, y, 0.03], '#ffffff').p('plain', ring(lancetShape, w + 0.16, h + 0.12, w, h), [x, y - 0.06, 0.05], '#fbeadc');
  k.p('plain', ring(lancetShape, 3.0, 5.7, 2.3, 5.2), [0, 0.1, 0.06], '#fbeadc').p('plain', fitShape(lancetShape(2.3, 5.2)), [0, 0.1, 0.04], '#efd5c4'); // 감실
  for (const s of [-1, 1]) k.p('plain', bx(0.24, 4.4, 0.24), [s * 1.5, 2.3, 0.15], CREAM).p('plain', new THREE.ConeGeometry(0.17, 1.0, 4).rotateY(PI / 4), [s * 1.5, 5.0, 0.15], '#fbeadc');
  k.p('wood', bx(0.22, 2.6, 0.12), [0, 2.95, 0.12], '#7a4a2e').p('wood', bx(1.25, 0.2, 0.12), [0, 3.65, 0.12], '#7a4a2e'); // 십자가
  k.p('plain', new THREE.CapsuleGeometry(0.1, 0.55, 3, 8), [0, 3.25, 0.22], '#f3d6c0').p('plain', sp(0.09, 8, 6), [0, 3.72, 0.22], '#f3d6c0').p('plain', new THREE.CapsuleGeometry(0.04, 0.95, 3, 6), [0, 3.62, 0.22], '#f3d6c0', [0, 0, PI / 2]).p('plain', bx(0.24, 0.16, 0.08), [0, 2.95, 0.22], '#ffffff'); // 예수상
  k.p('shine', bx(0.3, 0.12, 0.04), [0, 4.18, 0.2], hdr(GOLD, 1));
  // 제대: 흰 제단보 + 금 촛대 6 (높이) + 분홍 수국 화분 + 독서대 + 행렬 십자가 (사람 크기)
  const [ax0, az0, ax1, az1] = C.altar, acx = (ax0 + ax1) / 2, acz = (az0 + az1) / 2, AF = F + 0.1;
  k.at(acx, AF, acz).p('stone', bx(ax1 - ax0, 0.95, az1 - az0, 0.8), [0, 0.47, 0], '#f6ece2').p('plain', bx(ax1 - ax0 + 0.08, 0.04, az1 - az0 + 0.08), [0, 0.96, 0], '#ffffff').p('plain', bx(ax1 - ax0 + 0.06, 0.4, 0.02), [0, 0.78, (az1 - az0) / 2 + 0.05], '#ffffff');
  k.p('shine', bx(0.12, 0.3, 0.02), [0, 0.6, (az1 - az0) / 2 + 0.065], hdr(GOLD, 1)).p('shine', bx(0.3, 0.1, 0.02), [0, 0.65, (az1 - az0) / 2 + 0.065], hdr(GOLD, 1));
  for (const x of [-0.95, -0.7, -0.45, 0.45, 0.7, 0.95]) { k.p('shine', cy(0.02, 0.04, 0.32, 6), [x, 1.12, -0.1], hdr(GOLD, 1)); candle(k, x, 1.28, -0.1, 0.12); }
  for (const s of [-1, 1]) potFlower(k, acx + s * 1.6, AF, acz + 0.2, 0.9, '#ff9fc4');
  k.at(acx - 2.1, AF, acz + 0.3).p('wood', bx(0.22, 0.38, 0.12), [0, 0.19, 0], '#9a6440').p('wood', bx(0.26, 0.03, 0.18), [0, 0.39, 0], '#8a5234', [-0.3, 0, 0]); cross(k, 'shine', 0.12, 0.12, GOLD); // 독서대
  k.at(acx + 2.2, AF, acz + 0.2).p('shine', cy(0.012, 0.012, 0.75, 5), [0, 0.37, 0], hdr(GOLD, 1)); cross(k, 'shine', 0.72, 0.2, hdr(GOLD, 1.05)); // 행렬 십자가
  for (const s of [-1, 1]) potFlower(k, cx + s * 2.45, F + 0.1, C.sanctuary - 0.3, 0.75, '#ff9fc4'); // 계단 옆 수국
  // 신자석: 가운데 통로 붉은 깔개 + 사람 크기 나무 긴 의자 (끝판 보라 갈색)
  for (const p of C.pews) { pewRow(k, p, F, '#c88a4e'); for (const s of [-1, 1]) k.at(p.x + s * p.w / 2, F, p.z).p('plain', bx(0.03, 0.34, 0.2), [0, 0.17, 0.05], '#7d4a5c'); }
  // 왼쪽 측랑: 후광 성모상 + 받침 + 촛불대 / 오른쪽 측랑: 성체 현시대 상 + 십자가의 길 판
  { const m = C.maryIn; k.at(m.x, F, m.z, PI / 2); k.f.multiply(new THREE.Matrix4().makeScale(1.35, 1.35, 1.35)); // 성모상: 받침 포함 사람 키의 2배 안팎
    k.p('stone', bx(0.5, 0.4, 0.5), [0, 0.2, 0], '#f6ece2').p('stone', bx(0.56, 0.06, 0.56), [0, 0.42, 0], '#efdfd0');
    k.p('plain', lathe([[0.17, 0], [0.16, 0.3], [0.12, 0.62], [0.08, 0.72], [0, 0.74]], 12), [0, 0.45, 0], '#f8f6f2').p('plain', lathe([[0.19, 0.01], [0.18, 0.25], [0.13, 0.6], [0.09, 0.75], [0, 0.78]], 12), [0, 0.45, -0.03], '#7d9ee0');
    k.p('plain', sp(0.075, 10, 8), [0, 1.3, 0.02], '#ffe1cf').p('plain', new THREE.SphereGeometry(0.09, 10, 8, 0, PI * 2, 0, PI * 0.6), [0, 1.31, -0.005], '#ffffff').p('plain', sp(0.04, 8, 6), [0, 1.05, 0.12], '#ffe1cf', undefined, [0.8, 1.4, 0.6]);
    k.p('shine', new THREE.TorusGeometry(0.13, 0.014, 6, 24), [0, 1.36, -0.07], hdr(GOLD, 1.2)).p('glow', new THREE.CircleGeometry(0.12, 20), [0, 1.36, -0.08], hdr('#ffe2a0', 0.9)); }
  { const [m0, mz0, m1, mz1] = C.monstrance, mcx = (m0 + m1) / 2, mcz = (mz0 + mz1) / 2; k.at(mcx, F, mcz).p('stone', bx(m1 - m0, 0.32, mz1 - mz0, 0.6), [0, 0.16, 0], '#f6ece2').p('plain', bx(m1 - m0 + 0.04, 0.02, mz1 - mz0 + 0.04), [0, 0.33, 0], '#ffffff');
    k.p('shine', cy(0.015, 0.03, 0.18, 6), [0, 0.42, 0], hdr(GOLD, 1)); for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; k.p('shine', bx(0.012, 0.09, 0.01), [0, 0.6 + Math.sin(a) * 0.06, Math.cos(a) * 0.06], hdr(GOLD, 1.15), [a, 0, 0]); }
    k.p('glow', new THREE.CircleGeometry(0.035, 12), [-0.02, 0.6, 0], hdr('#fff6e0', 1.3), [0, -PI / 2, 0]);
    for (const dz of [-0.15, 0.15]) candle(k, 0, 0.34, dz, 0.1 * 1.5, S * 1.5); }
  if (0) for (let i = 0; i < 7; i++) { const z = -9.6 + i * 1.0; face(k, b, '+x', z, F + 0.62, false).p('wood', bx(0.32, 0.4, 0.04), [0, 0, 0.03], '#8a5a3c').p('plain', plane(0.26, 0.34), [0, 0, 0.052], '#dcbc8c').p('wood', bx(0.035, 0.22, 0.02), [0.03, 0.01, 0.06], '#6a4a2e').p('wood', bx(0.14, 0.035, 0.02), [0.03, 0.06, 0.06], '#6a4a2e').p('plain', new THREE.CapsuleGeometry(0.022, 0.09, 2, 6), [-0.05, -0.04, 0.062], '#7a5a3e', [0, 0, 0.5]); } // 십자가의 길 14처 중 7처 (오른쪽 벽)
  // 십자가의 길: 측랑 벽에 큰 액자 하나 (십자가 진 예수 부조) — 그림 오른쪽
  face(k, b, '+x', -10.7, F + 1.0, false).p('wood', bx(0.62, 0.82, 0.05), [0, 0, 0.03], '#8a5a3c').p('plain', plane(0.5, 0.7), [0, 0, 0.06], '#d9b98c');
  k.p('wood', bx(0.06, 0.5, 0.03), [0.07, 0.04, 0.075], '#6a4a2e', [0, 0, -0.5]).p('wood', bx(0.28, 0.06, 0.03), [0.02, 0.16, 0.075], '#6a4a2e', [0, 0, -0.5]).p('plain', new THREE.CapsuleGeometry(0.05, 0.22, 3, 8), [-0.06, -0.06, 0.08], '#8a6440', [0, 0, 0.35]).p('plain', sp(0.045, 8, 6), [-0.02, 0.1, 0.08], '#8a6440');
  cross(k, 'wood', 0.42, 0.18, '#6a4a2e');
  // 수국 화분 더: 기둥 밑·측랑
  for (const p of C.piers) if (p.z > -12) potFlower(k, p.x + Math.sign(p.x - cx) * 0.45, F, p.z + 0.4, 0.75, '#ff9fc4');
  // 촛불대 (사람 크기): 성모상 앞·현시대 앞
  for (const [cx0, cz0] of C.candles) {
    k.at(cx0, F, cz0).p('shine', cy(0.05 * S, 0.08 * S, 1.0 * S, 8), [0, 0.5 * S, 0], '#c9a066');
    [[0.3, 1.0, 7], [0.16, 1.18, 4]].forEach(([r, y, n]) => { k.p('shine', cy((r + 0.05) * S, (r + 0.05) * S, 0.04 * S, 12), [0, y * S, 0], '#c9a066'); for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2; candle(k, Math.cos(a) * r * S, (y + 0.02) * S, Math.sin(a) * r * S, 0.12 * S, S); } });
  }
  // 고해실 (사람 크기, 측랑 벽): 나무 상자 + 커튼 + 지붕 장식 / 성수대 2
  for (const [bx0, bz0, bx1, bz1] of C.booths) {
    const bw = bx1 - bx0, bd = bz1 - bz0, left = bx0 < cx;
    k.at((bx0 + bx1) / 2, F, (bz0 + bz1) / 2, left ? -PI / 2 : PI / 2).p('wood', bx(bd, 2.4 * S, bw), [0, 1.2 * S, 0], '#9a6440').p('wood', bx(bd + 0.06, 0.16 * S, bw + 0.06), [0, 2.45 * S, 0], '#7d4f33');
    k.p('plain', bx(bd * 0.62, 1.8 * S, 0.01), [0, 0.95 * S, -bw / 2 - 0.006], '#7d4a7c'); cross(k, 'shine', 2.5 * S, 0.3 * S, GOLD);
  }
  for (const [fx, fz] of C.fonts) k.at(fx, F, fz).p('stone', lathe([[0, 0], [0.25, 0], [0.12, 0.1], [0.1, 0.75], [0.32, 0.9], [0.34, 1.0], [0, 1.0]].map(([r, y]) => [r * S, y * S]), 14), [0, 0, 0], '#f1e6d8').p('plain', cy(0.28 * S, 0.28 * S, 0.01, 14), [0, 0.98 * S, 0], '#9fd8ea');
  // 매달린 금빛 랜턴 (기둥 사이 신자석 가장자리) + 측랑 랜턴
  for (const z of pz.slice(0, -1).map((z, i) => (z + pz[i + 1]) / 2)) for (const s of [-1, 1]) { lantern(k, cx + s * (PX - 0.6), F + 6.0, z, 1.6, 'shine', VH - F - 6.3); lantern(k, cx + s * (PX + 1.3), F + 3.8, z, 1.2, 'shine', AISLE - F - 3.9); }
  // 스테인드글라스 빛 무늬: 분홍·노랑 빛이 돌바닥에 떨어짐 (가산 블렌딩)
  for (let i = 0; i < 11; i++) { const z = -11.2 + i * 0.85, x = cx + Math.sin(i * 1.7) * 0.3; k.at(x, F + 0.012, z).p('floorLight', plane(0.8, 0.6), [0, 0, 0], '#ffffff', [-PI / 2, 0, 0.3 + i * 0.4]); }
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) k.at(cx + s * (1.6 + (i % 2) * 2.4), F + 0.012, -10.5 + i * 1.8).p('floorLight', plane(0.8, 0.5), [0, 0, 0], '#ffffff', [-PI / 2, 0, s * 0.5]);
  // 창으로 드는 빛줄기 (측랑 창)
  for (const s of ['-x', '+x']) for (let z = b.cz - b.d / 2 + 2.25; z < b.cz + b.d / 2 - 1.5; z += 2.5) face(k, b, s, z, F + 4.3, false).p('ray', new THREE.CylinderGeometry(1.0, 0.45, 5.2, 10, 1, true), [0, -1.55, 2.05], '#ffffff', [2.21, 0, 0]);
  // 앞쪽(문 쪽) 기둥 밑 수국 화분
  for (const s of [-1, 1]) potFlower(k, cx + s * PX, F, pz.at(-1) + 0.45, 0.85, '#ff9fc4');
}
const fitShape = (s) => new THREE.ShapeGeometry(s, 8);
const fitShape2 = (g) => { g.computeBoundingBox(); const bb = g.boundingBox, uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y)); return g; };

/* ───── 교회 (그림 interior-1): 크림 벽 + 굵은 나무 트러스 + 사슬 랜턴 + 큰 아치창 + 양옆 2층 발코니(흰 기둥·나무 난간·보라 의자) + 벽돌 아치 십자가 + 단 위 강대상·꽃·피아노·합창 의자 ───── */
const WARM = '#fdf0e2', WOOD = '#c98c4e', DARKW = '#9a6236', BRK = '#e3967c', PURPLE = '#8e6aa8';
export function churchIn(k, b, C) {
  const F = b.fy, H = b.h, cx = b.cx, x0 = b.cx - b.w / 2 + 0.2, x1 = b.cx + b.w / 2 - 0.2, z0 = b.cz - b.d / 2 + 0.2, z1 = b.cz + b.d / 2 - 0.2;
  const BAL = F + 2.4, colX = 2.7, cols = [...new Set(C.cols.map((c) => c.z))], [g0, gz0, g1, gz1] = C.stage;
  // 바닥: 분홍 둥근 돌 (무대는 나무)
  k.at(cx, F + 0.004, b.cz).p('paver', plane(b.w - 0.4, b.d - 0.4, 0.55), [0, 0, 0], '#f3cdc7', [-PI / 2, 0, 0]);
  // 벽: 따뜻한 크림 + 아래 띠
  inBands(k, b, F, H - 0.05, 'plain', WARM, F + 2.9);
  inBands(k, b, F, F + 0.22, 'wood', '#e8c49a', F + 2.9);
  // 나무 트러스 지붕: 경사 천장 판 + 트러스(서까래·평보·왕대공·빗대)마다 + 도리
  const RH = 2.7, half = b.w / 2 - 0.2, sl = Math.hypot(half, RH), tilt = Math.atan2(RH, half);
  for (const s of [-1, 1]) k.at(cx + s * half / 2, H + RH / 2, b.cz).p('wood', slope(sl, b.d - 0.4, -s * tilt, 0.9), [0, 0, 0], '#dcae7a');
  for (let z = z0 + 0.6; z < z1; z += 2.4) {
    k.at(cx, H, z);
    for (const s of [-1, 1]) { k.p('wood', bx(sl + 0.2, 0.3, 0.26, 0.8), [s * half / 2, RH / 2 - 0.12, 0], WOOD, [0, 0, -s * tilt]); k.p('wood', bx(0.22, Math.hypot(half / 2, RH / 2) + 0.1, 0.2, 0.8), [s * half * 0.32, RH * 0.28 - 0.1, 0], DARKW, [0, 0, s * 0.95]); k.p('wood', bx(0.3, 1.2, 0.3, 0.8), [s * (half - 0.15), -0.55, 0], WOOD); }
    k.p('wood', bx(half * 2, 0.32, 0.28, 0.8), [0, -0.05, 0], WOOD).p('wood', bx(0.26, RH - 0.2, 0.24, 0.8), [0, RH / 2 - 0.05, 0], DARKW).p('wood', bx(half * 1.1, 0.24, 0.24, 0.8), [0, RH * 0.55, 0], WOOD);
  }
  for (const t of [0.35, 0.7]) for (const s of [-1, 1]) k.at(cx + s * half * (1 - t), H + RH * t - 0.15, b.cz).p('wood', bx(0.22, 0.22, b.d - 0.4, 0.8), [0, 0, 0], DARKW);
  k.at(cx, H + RH - 0.12, b.cz).p('wood', bx(0.3, 0.26, b.d - 0.4, 0.8), [0, 0, 0], DARKW);
  gable(k, cx, H - 0.06, z0 + 0.01, half * 2, RH + 0.06, 1, WARM); gable(k, cx, H - 0.06, z1 - 0.01, half * 2, RH + 0.06, -1, WARM); // 박공 안쪽 벽
  // 2층 발코니: 흰 기둥(아래·위) + 바닥 판 + 나무 난간 + 보라 방석 의자 두 줄 + 아래 천장 등
  for (const s of [-1, 1]) {
    const ex = cx + s * colX, bw = half - colX + 0.15, bmx = cx + s * (colX + bw / 2 - 0.15), bz0 = gz1 + 0.2;
    for (const c of C.cols.filter((c) => Math.sign(c.x - cx) === s)) { k.at(c.x, F, c.z).p('plain', cy(c.r, c.r + 0.03, BAL - F, 12), [0, (BAL - F) / 2, 0], '#fffaf2').p('plain', bx(c.r * 2 + 0.12, 0.16, c.r * 2 + 0.12), [0, BAL - F - 0.12, 0], '#fffaf2').p('plain', bx(c.r * 2 + 0.1, 0.12, c.r * 2 + 0.1), [0, 0.06, 0], '#f3e6d6');
      k.p('plain', cy(c.r * 0.85, c.r * 0.9, H - BAL - 0.4, 10), [0, (H + BAL) / 2 - F + 0.15, 0], '#fffaf2'); k.at(c.x, F, c.z, -s * PI / 2).sub(0, 0, c.r); sconce(k, 1.75, '#4a3a55'); }
    k.at(bmx, BAL, (bz0 + z1) / 2).p('plain', bx(bw, 0.18, z1 - bz0), [0, 0, 0], '#fbefe2').p('wood', bx(bw, 0.04, z1 - bz0), [0, 0.11, 0], '#d9a46a');
    k.at(ex - s * 0.02, BAL, (bz0 + z1) / 2).p('wood', bx(0.06, 0.06, z1 - bz0), [0, 0.42, 0], DARKW).p('wood', bx(0.08, 0.05, z1 - bz0), [0, 0.15, 0], DARKW);
    for (let z = bz0 + 0.1; z < z1; z += 0.18) k.at(ex - s * 0.02, BAL, z).p('wood', bx(0.035, 0.3, 0.035), [0, 0.28, 0], WOOD);
    for (let z = bz0 + 0.25; z < z1 - 0.1; z += 0.3) for (const r of [0.38, 0.85]) k.at(ex + s * r, BAL + 0.1, z, s > 0 ? -PI / 2 : PI / 2).p('plain', bx(0.24, 0.07, 0.22), [0, 0.17, 0], PURPLE).p('plain', bx(0.24, 0.26, 0.05), [0, 0.32, -0.1], PURPLE).p('wood', bx(0.26, 0.04, 0.24), [0, 0.12, 0], DARKW).p('wood', bx(0.03, 0.14, 0.03), [0.1, 0.06, 0.08], DARKW).p('wood', bx(0.03, 0.14, 0.03), [-0.1, 0.06, 0.08], DARKW); // 발코니 보라 방석 의자
    for (const z of cols) k.at(bmx, BAL - 0.1, z + 1.2).p('glow', cy(0.1, 0.1, 0.02, 10), [0, 0, 0], hdr('#fff0c8', 1.6)); // 발코니 밑 천장 등
    // 위층 큰 아치창 (분홍 노을) + 아래층 안락의자·탁자 램프·화분
    for (let z = z0 + 2.2; z < z1 - 1.4; z += 2.8) { face(k, b, s < 0 ? '-x' : '+x', z, BAL + 0.6, false).p('winIn', arch(1.1, 2.9), [0, 0, 0.03], hdr('#ffd1d6', 1.05)).p('plain', ring(archShape, 1.35, 3.1, 1.1, 2.9), [0, -0.1, 0.04], '#fffaf2').p('plain', bx(0.05, 2.8, 0.03), [0, 1.4, 0.05], '#fffaf2').p('plain', bx(1.1, 0.05, 0.03), [0, 1.6, 0.05], '#fffaf2'); }
    for (const z of [-12.4, -10, -7.6, -5.2, -2.8, -0.9].filter((z) => z < z1 - 0.3)) { // 옆 통로 안락의자·탁자 램프·화분
      const wx = x0 + (s > 0 ? b.w - 0.4 : 0) - s * 0.25;
      k.at(wx, F, z, s > 0 ? -PI / 2 : PI / 2).p('plain', bx(0.24, 0.12, 0.22), [0, 0.12, 0], PURPLE).p('plain', bx(0.24, 0.22, 0.05), [0, 0.24, -0.09], PURPLE).p('wood', bx(0.04, 0.16, 0.22), [0.12, 0.13, 0], DARKW).p('wood', bx(0.04, 0.16, 0.22), [-0.12, 0.13, 0], DARKW);
      k.at(wx, F, z + 0.38).p('wood', cy(0.09, 0.09, 0.02, 10), [0, 0.2, 0], DARKW).p('wood', cy(0.015, 0.015, 0.2, 5), [0, 0.1, 0], DARKW).p('plain', cy(0.02, 0.03, 0.08, 6), [0, 0.25, 0], '#6a4a5c').p('glow', cy(0.04, 0.07, 0.07, 8), [0, 0.32, 0], hdr('#ffe6b0', 1.4));
      potFlower(k, wx, F, z - 0.4, 0.75, '#ffffff');
    }
  }
  // 뒷벽(십자가 쪽): 붉은 벽돌 기둥 + 벽돌 아치 틀 + 크림 판 + 큰 나무 십자가 + 양옆 키 큰 아치창 + 벽 등
  k.at(cx, F + 0.1, z0);
  for (const s of [-1, 1]) k.p('brick', bx(0.5, 4.6, 0.12, 0.5), [s * 1.45, 2.3, 0.06], BRK).p('brick', bx(1.0, 2.2, 0.1, 0.5), [s * 3.6, 1.1, 0.05], BRK).p('plain', bx(0.6, 0.12, 0.16), [s * 1.45, 4.66, 0.08], '#fffaf2');
  k.p('brick', ring(archShape, 3.4, 6.3, 2.4, 5.8), [0, 0, 0.07], BRK).p('plain', fitShapeA(archShape(2.4, 5.8)), [0, 0, 0.04], '#fff6ea').p('plain', ring(archShape, 3.8, 6.55, 3.4, 6.3), [0, 0, 0.065], '#fffaf2');
  k.p('wood', bx(0.32, 3.4, 0.16, 0.6), [0, 3.0, 0.14], '#a86a3a').p('wood', bx(1.7, 0.3, 0.16, 0.6), [0, 3.75, 0.14], '#a86a3a');
  for (const s of [-1, 1]) { k.p('winIn', arch(1.0, 3.2), [s * 2.6, 1.7, 0.03], hdr('#ffd1d6', 1.05)).p('plain', ring(archShape, 1.22, 3.35, 1.0, 3.2), [s * 2.6, 1.6, 0.05], '#fffaf2').p('plain', bx(0.05, 3.1, 0.03), [s * 2.6, 3.25, 0.06], '#fffaf2'); k.at(cx + s * 1.95, F + 0.1, z0 + 0.02); sconce(k, 1.5, '#4a3a55'); k.at(cx, F + 0.1, z0); }
  // 무대: 나무 단 + 앞 계단 + 카펫 / 강대상(마이크) / 하얀 꽃 화분 / 둥근 화분 나무 / 피아노(+의자) / 합창 의자 두 줄
  k.at((g0 + g1) / 2, F, (gz0 + gz1) / 2).p('wood', bx(g1 - g0 - 0.4, 0.1, gz1 - gz0, 1), [0, 0.05, 0], '#d4a06a');
  for (let i = 0; i < 2; i++) k.at(cx, F, gz1 + 0.12 + i * 0.12).p('wood', bx(3.4, 0.07 - i * 0.03, 0.14, 1), [0, (0.07 - i * 0.03) / 2, 0], '#cf9a62');
  const [p0, pz0, p1, pz1] = C.pulpit;
  k.at((p0 + p1) / 2, F + 0.1, (pz0 + pz1) / 2).p('wood', bx(p1 - p0, 1.05 * S, pz1 - pz0), [0, 0.52 * S, 0], '#b8763f').p('wood', bx(p1 - p0 + 0.03, 0.06 * S, pz1 - pz0 + 0.06), [0, 1.08 * S, -0.02], '#8a5234', [-0.25, 0, 0]);
  k.p('plain', cy(0.004, 0.004, 0.12, 4), [0.03, 0.42, -0.02], '#222222', [0.4, 0, 0]).p('plain', sp(0.012, 6, 4), [0.03, 0.48, 0.0], '#222222'); // 마이크
  for (const s of [-1, 1]) potFlower(k, cx + s * 0.75, F + 0.1, pz1 - 0.05, 1.0, '#ffffff');
  for (const s of [-1, 1]) topiary(k, cx + s * 3.7, F + 0.1, gz1 - 0.35, 1.2);
  const [q0, qz0, q1, qz1] = C.piano;
  { const qw = q1 - q0, qd = qz1 - qz0; // 업라이트 피아노(갈색) + 의자 (piano 자리 = 의자, 앉는 면 0.45m)
    k.at((q0 + q1) / 2, F + 0.1, (qz0 + qz1) / 2).p('wood', bx(qw, 1.3 * S, qd), [0, 0.65 * S, 0], '#7a3f2a').p('wood', bx(qw, 0.08 * S, 0.5 * S), [0, 0.78 * S, qd / 2 + 0.25 * S], '#6a3422');
    k.p('plain', bx(qw - 0.06, 0.02 * S, 0.18 * S), [0, 0.83 * S, qd / 2 + 0.3 * S], '#ffffff');
    for (let i = 0; i < 10; i++) k.p('plain', bx(0.04 * S, 0.025 * S, 0.1 * S), [-qw / 2 + 0.06 + i * (qw - 0.12) / 9, 0.845 * S, qd / 2 + 0.26 * S], '#222222');
    k.at((q0 + q1) / 2, F + 0.1, qz1 + 0.3).p('wood', bx(0.9 * S, 0.06 * S, 0.35 * S), [0, 0.43 * S, 0], '#6a3422').p('plain', bx(0.85 * S, 0.03 * S, 0.3 * S), [0, 0.47 * S, 0], PURPLE).p('wood', bx(0.06 * S, 0.43 * S, 0.3 * S), [0, 0.21 * S, 0], '#6a3422'); }
  for (const z of [-14.6, -15.2]) for (let i = 0; i < 5; i++) k.at(33.15 + i * 0.55, F + 0.1, z + 0.12).p('plain', bx(0.17, 0.05, 0.16), [0, 0.15, 0], PURPLE).p('wood', bx(0.17, 0.2, 0.03), [0, 0.26, 0.08], DARKW).p('wood', bx(0.15, 0.15, 0.14), [0, 0.06, 0], DARKW); // 합창 의자
  // 사슬에 매달린 큰 랜턴 두 줄 + 신자석 (보라 방석 띠 나무 긴 의자) + 입구 벽돌 화단
  for (const z of [-11.5, -7.2, -2.9]) for (const s of [-1, 1]) lantern(k, cx + s * 1.5, F + 4.9, z, 1.8, 'plain', H + RH * 0.45 - F - 5.4);
  for (const p of C.pews) { pewRow(k, p, F, WOOD); k.at(p.x, F, p.z).p('plain', bx(p.w - 0.02, 0.05 * S, 0.42 * S), [0, 0.505 * S, 0], PURPLE).p('plain', bx(p.w - 0.02, 0.2 * S, 0.03 * S), [0, 0.8 * S, 0.16], PURPLE, [-0.1, 0, 0]); } // 보라 방석·등받이 띠
  for (const [a0, c0, a1, c1] of C.planters) { k.at((a0 + a1) / 2, F, (c0 + c1) / 2).p('brick', bx(a1 - a0, 0.32, c1 - c0, 0.5), [0, 0.16, 0], BRK).p('plain', bx(a1 - a0 + 0.04, 0.03, c1 - c0 + 0.04), [0, 0.33, 0], '#fff3e6'); flowers(k, a0 + 0.08, c0 + 0.08, a1 - 0.08, c1 - 0.08, 0.32, 18, a0); }
  // 창으로 드는 빛줄기 (아래층 창)
  for (const s of ['-x', '+x']) for (let z = b.cz - b.d / 2 + 2.2; z < b.cz + b.d / 2 - 1.4; z += 2.8) face(k, b, s, z, F + 2.2, false).p('ray', new THREE.CylinderGeometry(0.8, 0.4, 3.4, 10, 1, true), [0, -0.9, 1.4], '#ffffff', [2.21, 0, 0]);
}
const fitShapeA = (s) => new THREE.ShapeGeometry(s, 10);

/* ───── 사찰 법당 (그림 interior-3): 붉은 기둥 두 줄(금띠) + 초록·금 단청 보·공포·꽃 문양 + 붉은 서까래 천장 + 분홍 연꽃 등 + 서 있는 등롱 + 옆 꽃살창 + 윤나는 마루 + 색 방석 격자 ───── */
const RED = '#b8392b', GREEN = '#3f8f73', GREEN2 = '#2f7a62', ORANGE = '#e8913a';
const CUSH = ['#ef8a62', '#9caa62', '#f39a86', '#f2c158', '#e9915a', '#aab86c']; // 그림처럼 파스텔 주황·올리브·연어·노랑
export function templeIn(k, b, T) {
  const F = b.fy, cx = b.cx, PH = 4.0, x0 = b.cx - b.w / 2 + 0.2, x1 = b.cx + b.w / 2 - 0.2, z0 = b.cz - b.d / 2 + 0.2, z1 = b.cz + b.d / 2 - 0.2;
  const BEAM = F + PH + 0.1, CEIL = F + PH + 1.7, colZ = [...new Set(T.inCols.map((c) => c.z))];
  // 마루: 윤나는 나무 (발 높이와 같은 높이)
  k.at(cx, F + 0.012, b.cz).p('hallFloor', plane(b.w - 0.4, b.d - 0.4, 1.0), [0, 0, 0], '#d9a070', [-PI / 2, 0, 0]); // 축대 돌바닥(F+0.006) 위 (깊이 우선 재질)
  // 벽: 아래 붉은 띠 + 크림 회벽 / 옆벽 꽃살창 (밖이 분홍 노을처럼 빛남)
  inBands(k, b, F, F + 0.6, 'wood', '#8e3a2a', F + PH);
  inBands(k, b, F + 0.6, F + PH, 'plain', '#9a3a2c', F + PH); // 그림처럼 꽃살창 사이는 붉은 벽
  inBands(k, b, F + PH, CEIL + 0.05, 'plain', GREEN2, F + PH); // 벽 위~천장 사이 (초록 단청 벽)
  for (const s of ['-x', '+x']) for (const z of [-125.2, -123.1, -121, -118.9, -116.8]) face(k, b, s, z, F + 0.6, false).p('sunset', plane(1.9, 2.8), [0, 1.4, 0.02], '#ffffff').p('latticeOpen', plane(1.9, 2.8), [0, 1.4, 0.035], '#ffffff').p('plain', bx(1.7, 0.12, 0.08), [0, 2.55, 0.05], RED).p('plain', bx(0.12, 2.7, 0.08), [0.85, 1.25, 0.05], RED).p('plain', bx(0.12, 2.7, 0.08), [-0.85, 1.25, 0.05], RED);
  // 안쪽 기둥 두 줄: 굵은 붉은 기둥 + 금띠 + 크림 주춧돌 + 두툼한 공포(초록·주홍·금)
  for (const c of T.inCols) {
    k.at(c.x, F, c.z).p('plain', cy(c.r, c.r + 0.03, BEAM - F, 14), [0, (BEAM - F) / 2, 0], RED).p('stone', cy(c.r + 0.12, c.r + 0.18, 0.35, 10), [0, 0.17, 0], '#efe2cf');
    for (const y of [0.45, BEAM - F - 0.35]) k.p('shine', cy(c.r + 0.02, c.r + 0.02, 0.12, 14), [0, y, 0], hdr('#e8b84a', 1));
    k.p('plain', bx(0.9, 0.35, 0.9), [0, BEAM - F + 0.25, 0], GREEN).p('plain', bx(1.2, 0.2, 0.5), [0, BEAM - F + 0.5, 0], ORANGE).p('plain', bx(0.5, 0.2, 1.2), [0, BEAM - F + 0.5, 0], GREEN2).p('plain', bx(1.0, 0.25, 1.0), [0, BEAM - F + 0.75, 0], GREEN);
    for (const [dx, dz] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) k.p('plain', bx(0.18, 0.18, 0.18), [dx, BEAM - F + 0.5, dz], '#ffd25e');
  }
  // 단청 보: 기둥 줄 따라(앞뒤) + 기둥 사이 가로(좌우) — 초록 바탕 + 단청 무늬 띠 + 금 꽃 문양
  const ROS = (x, y, z, ry) => { k.at(x, y, z, ry).p('shine', new THREE.CircleGeometry(0.28, 10), [0, 0, 0.01], hdr('#ffd25e', 1)).p('plain', new THREE.CircleGeometry(0.15, 10), [0, 0, 0.02], '#e2553f').p('plain', new THREE.CircleGeometry(0.06, 8), [0, 0, 0.03], '#ffd25e'); };
  for (const s of [-1, 1]) { const x = cx + s * 4.2; k.at(x, BEAM + 1.0, b.cz).p('plain', bx(0.5, 0.55, b.d - 0.4), [0, 0, 0], GREEN); for (const side of [-1, 1]) k.at(x + side * 0.26, BEAM + 1.0, b.cz, side * PI / 2).p('dan', plane(b.d - 0.4, 0.5, 0, [0, 0, (b.d - 0.4) / 3, 1]), [0, 0, 0], '#ffffff'); }
  for (const [zi, z] of colZ.entries()) { k.at(cx, BEAM + 1.05, z).p('plain', bx(b.w - 0.4, 0.6, 0.55), [0, 0, 0], zi % 2 ? '#2f6c8f' : GREEN).p('plain', bx(b.w - 0.4, 0.08, 0.6), [0, -0.32, 0], zi % 2 ? ORANGE : '#c64b36'); for (const side of [-1, 1]) k.at(cx, BEAM + 1.05, z + side * 0.28, side > 0 ? 0 : PI).p('dan', plane(b.w - 0.4, 0.55, 0, [0, 0, (b.w - 0.4) / 3, 1]), [0, 0, 0], '#ffffff'); for (const side of [-1, 1]) for (const dx of zi % 2 ? [-3.2, 3.2] : [0, -6.5, 6.5]) ROS(cx + dx, BEAM + 1.05, z + side * 0.29, side > 0 ? 0 : PI); } // 보마다 색·꽃 문양 배치를 바꿔 반복을 줄임
  // 천장: 붉은 서까래 (사선 판 + 줄무늬 각재) — 가운데가 높은 박공 모양
  const half = b.w / 2 - 0.2, rise = 1.4, sl = Math.hypot(half, rise), tilt = Math.atan2(rise, half);
  for (const s of [-1, 1]) {
    k.at(cx + s * half / 2, CEIL + rise / 2, b.cz).p('plain', slope(sl, b.d - 0.4, -s * tilt), [0, 0, 0], '#7a2a22');
    for (let z = z0 + 0.2; z < z1; z += 0.55) k.at(cx + s * half / 2, CEIL + rise / 2 - 0.1, z).p('plain', bx(sl, 0.14, 0.16), [0, 0, 0], '#a83a2a', [0, 0, -s * tilt]);
  }
  gable(k, cx, CEIL, z0 + 0.01, half * 2, rise, 1, '#7a2a22'); gable(k, cx, CEIL, z1 - 0.01, half * 2, rise, -1, '#7a2a22');
  // 불단 뒤: 감실(둥근 아치 금빛 판) + 양옆 붉은 기둥 + 단청 테
  k.at(cx, F, z0);
  k.p('plain', fitShapeA(archShape(4.4, 4.6)), [0, 0.6, 0.04], '#c98a3a').p('shine', ring(archShape, 4.8, 4.9, 4.4, 4.6), [0, 0.55, 0.06], hdr('#e8b84a', 1)).p('plain', bx(6.0, 0.6, 0.1), [0, 5.3, 0.05], GREEN);
  for (const s of [-1, 1]) k.p('plain', cy(0.3, 0.32, PH, 12), [s * 2.9, PH / 2, 0.35], RED).p('plain', bx(1.6, 3.2, 0.06), [s * 4.3, 2.2, 0.03], '#d9a24a').p('dan', plane(1.4, 3.0, 0, [0, 0, 1, 1]), [s * 4.3, 2.2, 0.07], '#ffffff');
  // 분홍 연꽃 등: 큰 것(양옆 위) + 작은 것 여럿 (빛남) + 금 술
  const LOT = (x, y, z, s) => { k.at(x, y, z).p('plain', cy(0.012, 0.012, CEIL - y, 4), [0, (CEIL - y) / 2 + 0.4 * s, 0], '#7a2a22'); for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2; k.p('lotus', sp(0.24 * s, 8, 6), [Math.cos(a) * 0.3 * s, 0.05 * s, Math.sin(a) * 0.3 * s], hdr(i % 2 ? '#ffc6d6' : '#ffb0c8', 1.1), [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], [0.55, 1.2, 0.35]); } k.p('lotus', sp(0.22 * s, 10, 8), [0, 0.1 * s, 0], hdr('#fff0c8', 1.5)).p('plain', cy(0.1 * s, 0.14 * s, 0.1 * s, 8), [0, -0.22 * s, 0], GREEN).p('shine', cy(0.03 * s, 0.07 * s, 0.4 * s, 6), [0, -0.5 * s, 0], hdr('#f2c35a', 1)); };
  for (const s of [-1, 1]) { LOT(cx + s * 5.4, F + 3.4, -117.2, 2.2); for (const [z, sc, y] of [[-119.8, 1.4, 3.3], [-122.4, 1.1, 3.2], [-124.6, 0.8, 3.1]]) LOT(cx + s * 4.6, F + y, z, sc); } // 그림처럼 큰 연꽃 등이 앞에서 뒤로 작아지며 늘어섬
  // 서 있는 나무 등롱 (빛남)
  for (const [x, z] of T.standLamps) { k.at(x, F, z).p('wood', cy(0.04, 0.06, 1.5, 6), [0, 0.75, 0], '#4a2f2a').p('wood', bx(0.36, 0.06, 0.36), [0, 1.5, 0], '#4a2f2a').p('glow', bx(0.28, 0.36, 0.28), [0, 1.72, 0], hdr('#ffd98a', 1.5)).p('wood', new THREE.ConeGeometry(0.28, 0.2, 4).rotateY(PI / 4), [0, 2.0, 0], '#4a2f2a').p('wood', bx(0.4, 0.05, 0.4), [0, 1.53, 0], '#4a2f2a'); for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.p('wood', bx(0.03, 0.4, 0.03), [dx * 0.15, 1.72, dz * 0.15], '#4a2f2a'); }
  // 방석 격자 (사람 크기, 색이 섞임: 주황·올리브·연어·노랑) + 염주 자리 방석
  let ci = 0;
  for (const [x, z] of T.cushions) k.at(x, F + 0.012, z).p('plain', bx(1.05 * S, 0.24 * S, 0.8 * S), [0, 0.12 * S, 0], CUSH[(((ci++ * 7 + Math.round(z * 3)) % CUSH.length) + CUSH.length) % CUSH.length]);
  for (const [x, z] of T.beads) k.at(x, F + 0.012, z).p('plain', bx(1.05 * S, 0.24 * S, 0.8 * S), [0, 0.12 * S, 0], '#8e6aa8').p('plain', new THREE.TorusGeometry(0.08 * S, 0.015 * S, 4, 12), [0, 0.25 * S, 0], '#6a3422', [PI / 2, 0, 0]);
  // 문으로 드는 빛줄기
  for (const s of [-1, 1]) k.at(cx + s * 4.5, F + 3.4, z1 - 0.2).p('ray', new THREE.CylinderGeometry(1.2, 0.6, 5.2, 10, 1, true), [0, -1.55, -2.1], '#ffffff', [-2.21, 0, 0]);
}
// 불상 앞 공양: 계단식 단 + 귤 공양 상 2 + 향로 + 연꽃 화병 + 촛불 등 — 마당에서 문으로 보이게 겉(ex)에 둠
export function templeAltar(ex, b, T) {
  { const [u0, uz0, u1, uz1] = T.buddha, G = hdr('#f4c45c', 1.12); // 웃는 얼굴 + 들어 올린 오른손(시무외인)
    ex.at((u0 + u1) / 2, b.fy, (uz0 + uz1) / 2); ex.f.multiply(new THREE.Matrix4().makeScale(1.35, 1.35, 1.35)); // 불상 1.35배 (그림처럼 크게)
    ex.p('shine', new THREE.CapsuleGeometry(0.08, 0.32, 3, 8), [-0.56, 2.45, 0.22], G, [0.25, 0, 0.15]).p('shine', sp(0.11, 8, 6), [-0.6, 2.75, 0.3], G, undefined, [0.9, 1.3, 0.5]);
    for (const s of [-1, 1]) ex.p('plain', new THREE.TorusGeometry(0.06, 0.014, 4, 10, PI), [s * 0.13, 2.9, 0.33], '#7a4a1e');
    ex.p('plain', new THREE.TorusGeometry(0.08, 0.014, 4, 10, PI), [0, 2.74, 0.34], '#a04a2a', [0, 0, PI]);
    ex.p('shine', sp(0.17, 10, 8), [0.5, 1.55, 0.35], G, undefined, [1.1, 0.6, 0.9]); // 무릎 위 왼손
    for (const [y, r] of [[2.35, 0.55], [2.05, 0.62], [1.75, 0.66]]) ex.p('shine', new THREE.TorusGeometry(r, 0.035, 5, 18, PI * 0.9), [0.08, y, 0.12], hdr('#e0a83c', 1.05), [0.15, 0, -0.9]); // 가사 주름 (어깨에서 비스듬히)
    for (const s of [-1, 1]) ex.p('shine', new THREE.CapsuleGeometry(0.05, 0.22, 3, 6), [s * 0.37, 2.82, 0], G); // 긴 귀
    ex.p('shine', sp(0.37, 14, 10), [0, 2.86, 0], G, undefined, [1, 1.05, 1]).p('shine', sp(0.24, 10, 8), [0, 3.2, -0.03], G).p('plain', sp(0.03, 6, 4), [0, 2.98, 0.35], '#ffe6a0'); } // 둥근 머리 + 육계 + 백호
  const F = b.fy, [d0, dz0, d1, dz1] = T.dais, dcx = (d0 + d1) / 2, [t0, tz0, t1, tz1] = T.altar, tcx = (t0 + t1) / 2;
  for (let i = 0; i < 3; i++) ex.at(dcx, F, (dz0 + dz1) / 2 - i * 0.12).p('stone', bx(d1 - d0 - i * 0.6, 0.08 * (i + 1), dz1 - dz0 - i * 0.24, 1), [0, 0.04 * (i + 1), 0], i % 2 ? '#ead9c6' : '#e2cdb6'); // 3단 불단
  ex.at(tcx, F, (tz0 + tz1) / 2).p('plain', bx(t1 - t0, 0.95, tz1 - tz0), [0, 0.47, 0], '#9c2f25').p('shine', bx(t1 - t0 + 0.08, 0.06, tz1 - tz0 + 0.08), [0, 0.97, 0], hdr('#e8b84a', 1));
  ex.p('shine', lathe([[0, 0], [0.22, 0], [0.3, 0.15], [0.22, 0.28], [0, 0.28]], 12), [0, 1.0, 0.1], '#9a7a50'); for (const dx of [-0.06, 0, 0.06]) ex.p('plain', cy(0.008, 0.008, 0.3, 4), [dx, 1.42, 0.1], '#8a6a4a');
  for (const s of [-1, 1]) {
    ex.at(tcx + s * 2.6, F, dz1 + 0.35).p('plain', bx(1.5, 0.6, 0.55), [0, 0.3, 0], '#8e2a22').p('plain', bx(1.6, 0.05, 0.62), [0, 0.62, 0], '#b8392b');
    for (let i = 0; i < 5; i++) ex.p('plain', sp(0.08, 8, 6), [-0.35 + (i % 3) * 0.12 + (i > 2 ? 0.06 : 0), 0.7 + (i > 2 ? 0.1 : 0), (i % 2) * 0.08 - 0.04], '#f28a1e');
    ex.p('plain', cy(0.07, 0.1, 0.22, 10), [0.4, 0.75, 0], '#f2e7dc'); for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; ex.p('lotus', sp(0.08, 8, 6), [0.4 + Math.cos(a) * 0.08, 0.96, Math.sin(a) * 0.08], hdr('#ffc0d4', 1.05), undefined, [0.6, 1.2, 0.4]); }
    ex.at(tcx + s * 1.5, F + 0.3, dz0 + 0.8).p('wood', cy(0.04, 0.05, 0.9, 6), [0, 0.45, 0], '#4a2f2a').p('glow', bx(0.26, 0.32, 0.26), [0, 1.05, 0], hdr('#ffd98a', 1.6)).p('wood', new THREE.ConeGeometry(0.24, 0.18, 4).rotateY(PI / 4), [0, 1.3, 0], '#4a2f2a');
    ex.at(tcx + s * 4.2, F, dz1 + 0.4).p('stone', bx(0.6, 0.6, 0.6), [0, 0.3, 0], '#efe2cf'); for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; ex.p('lotus', sp(0.18, 8, 6), [Math.cos(a) * 0.22, 0.75, Math.sin(a) * 0.22], hdr('#ffd6e2', 1.05), [Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55], [0.55, 1.25, 0.32]); } ex.p('lotus', sp(0.12, 10, 8), [0, 0.8, 0], hdr('#ffe9a8', 1.5)); // 연꽃 등대
  }
}
