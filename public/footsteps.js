// 발소리: 아바타 다리 그림(걷기 위상)과 같은 박자로, 바닥 재질(surfaceAt)마다 다른 소리. 좌우 발 번갈아 음높이·팬이 살짝 다름
// 내 아바타 + 8m 안에서 걷는 가장 가까운 3명만 (봇이 많아도 시끄럽지 않게, 훨씬 작게). 점프 '흡'·착지 '탁'·앉기/일어나기 옷깃·나무 의자 삐걱
import { fx } from './fx.js';
import { surfaceAt, stepCount, footOf, nearestN } from './audiodata.js';
import { SEATS } from './world.js';

const WOODEN = new Set(['cafe', 'office', 'park', 'pew', 'fire']); // 나무 의자·벤치
export function createFootsteps({ players, getMe }) {
  const ph = new WeakMap(), pos = new WeakMap();
  let jy = 0, sit = -1, pose = '';
  function feet(p, dt, g, isMe) {
    const a = p.av?.phase ?? 0, last = ph.get(p) ?? a, lp = pos.get(p) ?? [p.x, p.z];
    ph.set(p, a); pos.set(p, [p.x, p.z]);
    const sp = Math.hypot(p.x - lp[0], p.z - lp[1]) / Math.max(dt, 1e-3);
    if (!p.walking || p.jy > 0.05 || p.ride || p.sit >= 0 || p.transit || stepCount(last, a) < 1) return;
    fx.play('step', { x: p.x, z: p.z, range: 10, g, floor: isMe ? 1 : 0, pan: isMe ? (footOf(a) ? 0.08 : -0.08) : 0, surf: surfaceAt(p.x, p.z), foot: footOf(a), run: sp > 6.5, dur: 0.25 });
  }
  return {
    update(dt) {
      const me = getMe(); if (!me) return;
      feet(me, dt, 1, true);
      const near = nearestN([...players.values()].filter((p) => p !== me && p.walking), me.x, me.z, 3, 8);
      for (const p of players.values()) if (p !== me && !near.includes(p)) { if (p.av) ph.set(p, p.av.phase); } // 멀리 있는 사람은 위상만 따라가 둠 (가까워질 때 한꺼번에 울리지 않게)
      for (const p of near) feet(p, dt, 0.32, false);
      if (jy === 0 && me.vy > 0) fx.play('breath', { dur: 0.2 }); // 점프
      if (jy > 0.05 && me.jy === 0 && !me.ride) fx.play('land', { surf: surfaceAt(me.x, me.z), dur: 0.3 }); // 착지
      jy = me.jy;
      if (me.sit !== sit) { // 앉기·일어나기
        const k = SEATS[me.sit >= 0 ? me.sit : sit]?.kind;
        fx.play('cloth', { dur: 0.3 }); if (WOODEN.has(k)) fx.play('chair', { delay: 0.1, dur: 0.4 });
        sit = me.sit;
      }
      if ((me.pose || '') !== pose) { // 바닥에 앉기·눕기·일어나기도 같은 옷깃 소리
        if (['sit', 'lie'].includes(me.pose) || ['sit', 'lie'].includes(pose)) fx.play('cloth', { dur: 0.3 });
        pose = me.pose || '';
      }
    },
  };
}
