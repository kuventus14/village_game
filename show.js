// 불꽃놀이 시간 운영 (서버가 심판): 쇼 단계는 public/showdata.js 의 순수 함수(showAt). 단계가 바뀔 때 모두에게 알리고,
// 놀이공원 안 사람(봇 포함)을 정문 밖으로 내보내고(자동 걷기 → 게이트가 닫힐 때 남은 사람은 다리 앞으로 옮김), 정문 게이트를 닫고 열고(충돌 벽), 놀이기구 새 손님을 막음
// 시간은 ctx.now() 로만 읽음 → 가짜 시계로 시험. 서버의 SHOW_AT=HH:MM[:SS] 는 이 시계를 그 한국 시각부터 흐르게 함
// 메시지 (서버 → 모두) { t:'show', ph, until(쇼 시작까지 남은 ms, 지났으면 음수, 쇼 없는 단계는 null), gate(닫힘 여부), n }  · (서버 → 놀이공원 안 본인) { t:'evac', x, z } 정문 밖으로 걸어 나가기
//        welcome 에는 snapshot() 이 들어감
import { inPark, resolve, setGateClosed, PARK_GATE, BRIDGE, parkRoadAt } from './public/world.js';
import { showAt } from './public/showdata.js';

export const OUT = { x0: -222, x1: -212, hz: 8 }; // 정문 밖(다리 쪽) 모이는 자리: 정문에서 10~20m 동쪽, 길 가운데 ±8m
const inside = (p) => inPark(p.x, p.z) || (p.x < PARK_GATE.x + 2.5 && Math.abs(p.z - PARK_GATE.z) < PARK_GATE.hw + 1); // 부지 안 + 게이트가 닫히는 자리
const rr = (a, b, rand) => a + rand() * (b - a);

/* ctx: { now(), rand(), players (Map), send(p, o), bcast(o), stand(p), rides?, bots?, info?(p) } */
export function createShow(ctx) {
  let cur = showAt(ctx.now());
  setGateClosed(cur.gate);
  const snapshot = () => { const s = showAt(ctx.now()); return { ph: s.ph, until: s.until, gate: s.gate, n: s.n }; };
  const target = () => resolve(rr(OUT.x0, OUT.x1, ctx.rand), PARK_GATE.z + rr(-OUT.hz, OUT.hz, ctx.rand));
  const BMID = (BRIDGE.s0 + BRIDGE.s1) / 2;
  const spot = () => { const [x, z, tx, tz, hw] = parkRoadAt(rr(BMID - 16, BMID + 16, ctx.rand)), o = rr(-1, 1, ctx.rand) * (hw - 1.4); return resolve(x - tz * o, z + tx * o); }; // 다리 가운데 전망 광장 자리
  const humans = () => [...ctx.players.values()].filter((p) => p.ws);
  function evac() { // 안에 있는 사람에게 걸어 나가라고 알림, 봇은 스스로 나감
    for (const p of humans()) if (inPark(p.x, p.z)) { if (p.seat >= 0) ctx.stand(p); const [x, z] = target(); ctx.send(p, { t: 'evac', x, z }); }
    ctx.bots?.evac?.(() => target());
    ctx.bots?.gather?.(spot); // 구경하러 다리 위로
  }
  function sweep() { // 게이트가 닫히기 전 마지막 확인: 아직 안(또는 문 자리)에 있으면 다리 앞으로
    for (const p of ctx.players.values()) {
      if (!inside(p)) continue;
      if (p.seat >= 0) ctx.stand(p);
      ctx.rides?.evict(p);
      const [x, z] = target(); Object.assign(p, { x, z, ry: Math.PI / 2, w: false, dirty: true });
      if (p.ws) ctx.send(p, { t: 'tp', x, z, ry: Math.PI / 2 }); else ctx.bots?.reset?.(p);
      ctx.info?.(p);
    }
  }
  return {
    snapshot,
    closed: () => showAt(ctx.now()).ph !== 'open', // 놀이기구 영업 중단 (안내 단계부터 쇼 끝까지)
    tick() {
      const s = showAt(ctx.now());
      if (s.ph === cur.ph) return;
      const prev = cur.ph; cur = s;
      if (s.ph === 'evac') evac();
      if (s.ph === 'closed') { sweep(); setGateClosed(true); }
      if (s.ph === 'open') setGateClosed(false);
      ctx.bcast({ t: 'show', ph: s.ph, until: s.until, gate: s.gate, n: s.n, from: prev });
    },
    sweep, evac, // 시험·시연용
  };
}
