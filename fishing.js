// 연못 낚시 규칙 (서버가 심판): 던지기 검사·찌 위치·입질 시각·당기기 판정·물고기 뽑기·도감.
// 카지노 모듈처럼 시간은 ctx.now() 로만 읽고 타이머는 tick() 에서 확인 → 가짜 시계로 시험 가능.
import { POND } from './public/world.js';
import { FISH, REEL_MS } from './public/fishdata.js';

// 확률표에서 하나 뽑기 (r = 0~1 난수)
export function pickFish(r) {
  let a = r * 100;
  for (const f of FISH) if ((a -= f.p) < 0) return f;
  return FISH[FISH.length - 1];
}
// 크기(cm): 작은 쪽이 더 흔함. 쓰레기는 0
export const fishSize = (f, r) => (f.max ? Math.round((f.min + (f.max - f.min) * r ** 1.6) * 10) / 10 : 0);

/* ctx: { now(), rand(), send(p, o), bcast(o), info(p) (상태 알림), save(p) (도감 저장), onCatch?(p, fish) (가방에 담기), opts: { bite:[최소,최대]ms, win, slack, minReact, cd } } */
export function createFishing(ctx) {
  const o = { bite: [2500, 7000], win: REEL_MS, slack: 300, minReact: 80, cd: 800, ...ctx.opts };
  const fishers = new Set();
  const r2 = (n) => Math.round(n * 100) / 100;

  function end(p, r, extra = {}) {
    const f = p.fish;
    fishers.delete(p); p.fish = null; p.fishAt = ctx.now();
    if (p.s === 'fish') Object.assign(p, f.prev); // 낚시 전 상태로 (그 사이 직접 바꿨으면 그대로)
    ctx.bcast({ t: 'fish', a: 'end', id: p.id, r, s: p.s, ...extra });
    ctx.info(p);
  }
  function cast(p) {
    const now = ctx.now(), d = Math.hypot(p.x - POND.x, p.z - POND.z);
    if (p.fish || now - (p.fishAt || 0) < o.cd) return; // 이미 낚시 중이거나 너무 자주 던지면 조용히 무시
    const err = p.seat >= 0 || p.game || p.transit || p.fl ? '지금은 낚시할 수 없어요'
      : d < POND.r + 0.2 || d > POND.r + 3 ? '연못 가까이 가서 던져 주세요' : '';
    if (err) return ctx.send(p, { t: 'fish', a: 'no', error: err });
    // 찌: 서 있는 곳에서 연못 쪽으로 2.2~3.6m, 좌우로 조금 흔들림 (연못 가장자리 안쪽)
    const a = Math.atan2(POND.x - p.x, POND.z - p.z) + (ctx.rand() - 0.5) * 0.6, L = 2.2 + ctx.rand() * 1.4;
    let bx = p.x + Math.sin(a) * L, bz = p.z + Math.cos(a) * L;
    const k = Math.hypot(bx - POND.x, bz - POND.z) / (POND.r - 0.6);
    if (k > 1) { bx = POND.x + (bx - POND.x) / k; bz = POND.z + (bz - POND.z) / k; }
    p.fish = { prev: { s: p.s, auto: p.auto }, st: 'wait', bx: r2(bx), bz: r2(bz), biteAt: now + o.bite[0] + ctx.rand() * (o.bite[1] - o.bite[0]) };
    p.ry = r2(Math.atan2(bx - p.x, bz - p.z)); p.w = false; p.dirty = true;
    fishers.add(p);
    ctx.bcast({ t: 'fish', a: 'cast', id: p.id, bx: p.fish.bx, bz: p.fish.bz, ry: p.ry }); // 상태 알림보다 먼저 → 화면이 '바뀌었어요' 알림을 안 띄움
    p.s = 'fish'; p.auto = false; ctx.info(p);
  }
  function reel(p) {
    const f = p.fish, now = ctx.now();
    if (!f) return;
    if (f.st === 'wait') return end(p, 'early'); // 입질 전에 당기면 물고기가 도망감
    const dt = now - f.biteAt;
    if (dt < o.minReact) return; // 사람이 누를 수 없을 만큼 빠르면 무시
    if (dt > o.win + o.slack) return end(p, 'miss');
    const fish = pickFish(ctx.rand()), cm = fishSize(fish, ctx.rand());
    const was = p.dex[fish.k], e = (p.dex[fish.k] = { n: (was?.n || 0) + 1, best: Math.max(was?.best || 0, cm) });
    ctx.save(p); ctx.onCatch?.(p, fish); // 가방에 담기(물고기 가게)
    ctx.send(p, { t: 'fish', a: 'catch', k: fish.k, cm, first: !was, record: !!was && cm > was.best, e });
    end(p, 'catch', { k: fish.k, cm });
  }
  return {
    act(p, m) { if (m.a === 'cast') cast(p); else if (m.a === 'reel') reel(p); else if (m.a === 'stop' && p.fish) end(p, 'cancel'); },
    stop: (p) => p.fish && end(p, 'cancel'),
    leave(p) { fishers.delete(p); p.fish = null; }, // 접속이 끊김: 화면들은 'leave' 로 찌를 지움
    tick() {
      const now = ctx.now();
      for (const p of fishers) {
        const f = p.fish;
        if (f.st === 'wait' && now >= f.biteAt) { f.st = 'bite'; f.biteAt = now; ctx.bcast({ t: 'fish', a: 'bite', id: p.id }); }
        else if (f.st === 'bite' && now - f.biteAt > o.win + o.slack) end(p, 'miss');
      }
    },
    snapshot: () => [...fishers].map((p) => ({ id: p.id, bx: p.fish.bx, bz: p.fish.bz, bite: p.fish.st === 'bite' })),
  };
}
