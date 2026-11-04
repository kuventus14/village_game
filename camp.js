// 불멍 캠프 여는 시간 (서버가 심판): 매일 한국 시간 19:00 ~ 다음 날 06:00. 닫히는 순간 불멍 벤치에 앉은 사람은 일어나고, 열리고 닫힐 때 모두에게 알림
// 시간은 ctx.now() 로만 읽음 → 가짜 시계로 시험. 서버의 CAMP_AT=HH:MM 은 이 시계를 그 한국 시각부터 흐르게 함
import { SEATS } from './public/world.js';
import { KST } from './public/daycycle.js';

export const OPEN_H = 19, CLOSE_H = 6, DAY = 864e5, H = 3.6e6;
export const CLOSED_MSG = '지금은 불이 꺼져 있어요 · 매일 오후 7시~오전 6시에 열려요';
const dayMs = (ms) => (((ms + KST) % DAY) + DAY) % DAY; // 한국 시간 0시부터 지난 ms
export const campOpen = (ms) => { const d = dayMs(ms); return d >= OPEN_H * H || d < CLOSE_H * H; };
export function nextChange(ms) { // 다음에 열리거나 닫히기까지 남은 ms
  const d = dayMs(ms);
  return d < CLOSE_H * H ? CLOSE_H * H - d : d < OPEN_H * H ? OPEN_H * H - d : DAY - d + CLOSE_H * H;
}
// 'HH:MM' → 실제 시계에 더할 ms (그 한국 시각부터 흐르게)
export const atOffset = (hm, now = Date.now()) => { const [h, mi, sec = 0] = String(hm).split(':').map(Number); return ((((h * H + mi * 6e4 + sec * 1e3 - dayMs(now)) % DAY) + DAY) % DAY); };

/* ctx: { now(), bcast(o), players (Map), stand(p) } */
export function createCamp(ctx) {
  let open = campOpen(ctx.now());
  const snapshot = () => { const now = ctx.now(); return { open: campOpen(now), next: nextChange(now) }; };
  return {
    open: () => campOpen(ctx.now()),
    snapshot,
    tick() {
      const now = campOpen(ctx.now());
      if (now === open) return;
      open = now;
      if (!open) for (const p of ctx.players.values()) if (SEATS[p.seat]?.kind === 'fire') ctx.stand(p); // 불이 꺼지면 벤치에서 일어남
      ctx.bcast({ t: 'camp', ...snapshot() });
    },
  };
}
