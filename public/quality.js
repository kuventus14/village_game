// 그래픽 품질 단계: ?q= 쿼리 > 설정 메뉴(localStorage) > 기기 자동 선택. 낮을수록 후처리·그림자·풀·입자를 줄임
export const LEVELS = { high: '높음', normal: '보통', low: '낮음' };
export const KEY = 'village.quality';

export function pickLevel({ param, stored, coarse, memory }) {
  if (Object.hasOwn(LEVELS, param ?? '')) return param;
  if (Object.hasOwn(LEVELS, stored ?? '')) return stored;
  if (coarse) return memory && memory <= 3 ? 'low' : 'normal'; // 폰·태블릿은 보통 이하, 메모리 작은 폰(안드로이드만 알려줌)은 낮음
  return 'high';
}

const TABLE = {
  // 픽셀비 상한, 후처리, MSAA, 블룸 해상도, 그림자맵, 풀 뭉치, 입자 배율, 먼 나무, 꽃 수, 가벼운 모양(잎 면 수·덤불·버섯·언덕 바위 줄임)
  high: { dpr: 2, post: true, samples: 4, bloomScale: 1, shadow: 2048, grass: 6000, fx: 1, farTrees: 320, flowers: 1400, lite: false },
  normal: { dpr: 1.5, post: true, samples: 2, bloomScale: 0.5, shadow: 1024, grass: 3200, fx: 0.6, farTrees: 200, flowers: 950, lite: false },
  low: { dpr: 1, post: false, samples: 0, bloomScale: 0, shadow: 1024, grass: 1200, fx: 0.25, farTrees: 120, flowers: 450, lite: true },
};
export const settings = (level) => ({ level, ...TABLE[level] });

export const Q = typeof window === 'undefined' ? null : (() => {
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch {}
  return settings(pickLevel({
    param: new URLSearchParams(location.search).get('q'),
    stored,
    coarse: matchMedia('(pointer:coarse)').matches,
    memory: navigator.deviceMemory,
  }));
})();
