// 카메라 놓기 (game.js·fireworks.js·시험이 같이 씀, DOM·three 없음)
// pitch: 위에서 내려다보는 각(PMIN 0.12 ~ 1.25). 마우스·오른쪽 손가락을 위로 더 끌어 PMIN 아래로 내려가면 그만큼 올려다봄 (최대 TILT):
// 카메라는 아바타 뒤 낮은 곳(땅 위 0.45m, 0.4m 아래로는 안 감)으로 내려오고 시선만 위로 듦 → 끝까지 들면 시선 73°, 하늘 천정(수직 위)이 화면 위쪽 안에 들어옴
// 아바타는 늘 화면 아래 끝에 머리 윗부분이 걸리게: 시선이 높을수록 카메라가 아바타 쪽으로 다가옴 (머리 꼭대기가 화면 아래 끝 위 14° → 3°, 카메라는 1m 안으로는 안 옴 — 더 붙으면 머리·포니테일이 화면을 덮음)
export const PMIN = 0.12, PMAX = 1.25, TILT = 1.3, LOOK_MAX = 1.27, CAM_FLOOR = 0.4;
const LOW = 0.45, HEAD = 0.52; // 다 올려다볼 때 카메라 높이(땅 위), 머리 꼭대기 = 따라가는 점(가슴) + 0.52

// t = 카메라가 따라가는 점 [x, y, z] (아바타 가슴, 땅 + 1.2), groundAt(x, z) = 그 자리 땅 높이, half = 화면 세로 시야 절반(라디안)
// 반환: pos (카메라), look (바라보는 점), tilt (0 = 평소 · 1 = 끝까지 올려다봄). tilt 0 이면 예전과 똑같이 t 를 봄
export function camRig(t, yaw, pitch, dist, groundAt = () => t[1] - 1.2, half = 0.4363) {
  const s = Math.min(1, Math.max(0, (PMIN - pitch) / TILT)), p = Math.max(pitch, PMIN), sy = Math.sin(yaw), cy = Math.cos(yaw), h0 = Math.cos(p) * dist, y0 = t[1] + Math.sin(p) * dist;
  const at = (h, y) => { const x = t[0] + sy * h, z = t[2] + cy * h; return [x, Math.max(y, groundAt(x, z) + CAM_FLOOR), z]; };
  if (!s) { const pos = at(h0, y0); return { pos, look: [t[0], t[1], t[2]], tilt: 0 }; }
  const m = Math.min(1, s * 2.5), e = m * m * (3 - 2 * m), g = groundAt(t[0] + sy * h0, t[2] + cy * h0); // 카메라 높이는 처음 40% 안에 다 내려옴
  const y = y0 + (g + LOW - y0) * e, el0 = Math.atan2(t[1] - y0, h0), el = el0 + (LOOK_MAX - el0) * s; // 시선 높이각: 아바타를 보던 각 → 73°
  const top = el - half + 0.24 - 0.19 * s; // 머리 꼭대기가 놓일 높이각 (화면 아래 끝 + 14° → 3°)
  const h = top > 0.05 ? Math.max(1, Math.min(h0, (t[1] + HEAD - y) / Math.tan(top))) : h0, pos = at(h, y);
  const L = Math.hypot(t[0] - pos[0], t[1] - pos[1], t[2] - pos[2]);
  return { pos, look: [pos[0] - sy * Math.cos(el) * L, pos[1] + Math.sin(el) * L, pos[2] - cy * Math.cos(el) * L], tilt: s };
}

// 그리는 동안 시점 (fireworks.js 가 게임 카메라 위에 덮어씀). me = { x, z, gy }, pl = 서버가 정한 평면
// 하늘 불꽃놀이: 아바타 뒤 낮은 곳에서 평면 가운데를 화면 한가운데로 올려다봄 (아바타 머리는 화면 아래쪽)
// 불꽃 스틱: 아바타 뒤 3.7m·높이 2.1m, 스틱 든 손 쪽으로 3.1m 비켜서(큰 머리에 들어 올린 팔이 안 가리게) → 아바타(온몸, 화면 오른쪽 아래)와 앞 허공 평면(가운데)이 한 화면에
export function drawView(kind, me, pl, aspect = 16 / 9) {
  const fx = Math.sin(pl.ry), fz = Math.cos(pl.ry), rx = -fz, rz = fx, g = me.gy || 0;
  if (kind === 'stick') {
    const b = aspect < 1 ? 7.5 : 3.7, sd = aspect < 1 ? -1.2 : -3.1; // 스틱 든 손 쪽 뒤에서 (세로 폰은 평면 폭이 들어오게 더 뒤로)
    return { eye: [me.x - fx * b + rx * sd, g + 2.1, me.z - fz * b + rz * sd], look: [pl.x, g + 2.0, pl.z] };
  }
  return { eye: [me.x - fx * 3.6, g + 0.7, me.z - fz * 3.6], look: [pl.x, pl.y, pl.z] };
}
