// 연못 낚시: 물고기 표와 거리 규칙 (서버 fishing.js 와 화면 fishing.js 가 같이 씀)
// p = 확률(%) 합 100, min~max = 크기(cm, 0 이면 크기 없음), star = 희귀도(0 = 쓰레기), fx = 아이콘 꾸밈(CSS), rare = 다른 사람에게도 알림
// price = 상점에 파는 값(칩, 카지노와 같은 돈): 물고기 500~5000, 희귀할수록 비쌈, 쓰레기는 0(못 팖). 한 번 낚을 때 평균 약 1,050칩
export const FISH = [
  { k: 'crucian', name: '붕어', icon: '🐟', p: 30, min: 10, max: 30, star: 1, price: 500 },
  { k: 'carp', name: '잉어', icon: '🐠', p: 20, min: 30, max: 70, star: 2, price: 1200 },
  { k: 'gold', name: '금붕어', icon: '🐡', p: 15, min: 5, max: 15, star: 1, price: 800 },
  { k: 'loach', name: '미꾸라지', icon: '🐟', p: 15, min: 8, max: 20, star: 1, price: 700, fx: 'filter:sepia(.9) saturate(.6) brightness(.9);transform:scale(1.5,.55)' },
  { k: 'catfish', name: '메기', icon: '🐟', p: 8, min: 30, max: 80, star: 3, price: 2000, fx: 'filter:grayscale(1) brightness(.75) contrast(1.2)' },
  { k: 'eel', name: '장어', icon: '🐟', p: 5, min: 40, max: 100, star: 4, price: 3500, fx: 'filter:hue-rotate(160deg) brightness(.6) saturate(.8);transform:scale(1.8,.45)', rare: true },
  { k: 'goldcarp', name: '황금 잉어', icon: '🐠', p: 2, min: 40, max: 90, star: 5, price: 5000, fx: 'filter:sepia(1) saturate(4) hue-rotate(-12deg) brightness(1.15) drop-shadow(0 0 6px #ffd43b)', rare: true },
  { k: 'boot', name: '낡은 장화', icon: '👢', p: 3, min: 0, max: 0, star: 0, price: 0 },
  { k: 'can', name: '빈 깡통', icon: '🥫', p: 2, min: 0, max: 0, star: 0, price: 0 },
];
export const FISH_BY = Object.fromEntries(FISH.map((f) => [f.k, f]));
// 낚시할 수 있는 곳: 연못 중심에서 r+0.5 ~ r+2.5 (서버는 조금 더 너그럽게 r+0.2 ~ r+3)
export const FISH_NEAR = 0.5, FISH_FAR = 2.5;
export const REEL_MS = 1400; // 입질 뒤 당길 수 있는 시간
