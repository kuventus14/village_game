// 불꽃놀이 시간표 (서버·브라우저·시험이 같이 씀, 순수 계산): 매일 한국 시각 19:00 · 22:00 에 3분 쇼, 그 앞뒤로 놀이공원이 영업을 임시 중단하고 정문 게이트가 닫힘
// 쇼 시작을 0 으로 잰 시각(delta, ms)에 따라 단계가 바뀜:
//   open    평소 (정문 게이트 양옆으로 열림)
//   warn    -5분 ~ -3분  "곧 시작" 알림 · 놀이기구는 새 손님을 안 받음 (타고 있던 사람은 이번 회차를 끝까지)
//   evac    -3분 ~ -1분  놀이공원 안 사람들이 정문 밖 다리 쪽으로 자동으로 걸어 나감
//   closed  -1분 ~ 0     정문 게이트가 닫힘 (남아 있던 사람은 다리 앞으로 옮겨짐)
//   show    0 ~ +3분     불꽃놀이
//   after   +3분 ~ +3분30초  끝 인사 (게이트는 아직 닫혀 있음)
//   → 다시 open: 게이트가 열리고 영업 재개
import { KST } from './daycycle.js';

const H = 3.6e6, DAY = 864e5;
export const SHOW_HOURS = [19, 22]; // 한국 시각 정각
export const SHOW_LEN = 180e3;
export const T = { warn: -300e3, evac: -180e3, closed: -60e3, show: 0, after: SHOW_LEN, reopen: SHOW_LEN + 30e3 };
export const PHASES = ['warn', 'evac', 'closed', 'show', 'after']; // open 은 그 사이 빈 시간
export const dayMs = (ms) => (((ms + KST) % DAY) + DAY) % DAY; // 한국 시간 0시부터 지난 ms

// 지금(ms)이 어느 단계인지: { ph, n(오늘 몇 번째 쇼, -1 이면 쇼 없음), delta(쇼 시작 기준 ms, 쇼 없으면 null), until(쇼 시작까지 남은 ms, 지났으면 음수), next(다음 단계까지 ms), park(영업 중), gate(게이트 닫힘) }
export function showAt(ms) {
  const d = dayMs(ms);
  for (let n = 0; n < SHOW_HOURS.length; n++) {
    const delta = d - SHOW_HOURS[n] * H;
    if (delta < T.warn || delta >= T.reopen) continue;
    const ph = delta < T.evac ? 'warn' : delta < T.closed ? 'evac' : delta < T.show ? 'closed' : delta < T.after ? 'show' : 'after';
    const edges = { warn: T.evac, evac: T.closed, closed: T.show, show: T.after, after: T.reopen };
    return { ph, n, delta, until: -delta, next: edges[ph] - delta, park: false, gate: ph === 'closed' || ph === 'show' || ph === 'after' };
  }
  // 쇼 없는 시간: 다음 쇼 알림(-5분)까지
  let next = Infinity;
  for (const h of SHOW_HOURS) { const w = h * H + T.warn - d; next = Math.min(next, w > 0 ? w : w + DAY); }
  return { ph: 'open', n: -1, delta: null, until: null, next, park: true, gate: false };
}
// 문 닫힘 모션 길이(ms)
export const GATE_MS = 6000;
// 안내 문구 (화면에 띄움, 한 줄씩)
export const SHOW_TEXT = {
  warn: ['🎆 불꽃놀이가 곧 시작됩니다!', '불꽃놀이 시간에는 놀이공원은 영업을 임시 중단합니다. 놀이기구는 새 손님을 받지 않아요.'],
  evac: ['🎆 놀이공원 안에 계신 분은 정문 밖 다리 위로 나와 주세요', '자동으로 걸어 나가요 · 영업을 임시 중단합니다.'],
  closed: ['🚪 정문 게이트가 닫힙니다', '불꽃놀이가 곧 시작돼요. 다리 위에서 즐겨 주세요.'],
  show: ['🎆 불꽃놀이 시작!', ''],
  after: ['✨ 오늘도 포근했어요', '곧 정문 게이트가 다시 열려요.'],
  open: ['🎡 놀이공원 영업을 다시 시작합니다', '게이트가 열렸어요. 즐거운 시간 보내세요!'],
};
