// 옷 가게 설계도 (서버·브라우저·시험이 같이 씀): 파는 옷·꾸미기 가격, 가게 자리, 소유 규칙. 값 단위는 칩(카지노·물고기 가게와 같은 돈)
// 옷 번호는 world.js OPT 와 같음: os(옷 스타일) 0 티셔츠 · 1 후드티 · 2 원피스 · 3 셔츠·넥타이 · 4 멜빵바지 / ac(악세서리) 0 없음 · 1 동그란 안경 · 2 선글라스 · 3 비니 · 4 야구모자 · 5 곰돌이 띠
// 티셔츠·원피스(기본 옷)와 옷 색·바지 색·머리·얼굴은 처음부터 무료. 나머지는 가게에서 한 번 사면 계정에 영원히 남음. 지금 입고 있는 옷은 그대로 계속 입을 수 있음(예전 계정 보호)
export const CLOSET_STALL = { x: -8.7, z: -9.7, ry: 0.73, r: 2.2 }; // 광장 남서쪽, 분수를 바라봄
export const BUY_RANGE = 6, NEAR_RANGE = 4.8;
export const CLOSET = [['os', 1, 2000], ['os', 3, 3000], ['os', 4, 2500], ['ac', 1, 1500], ['ac', 2, 2000], ['ac', 3, 2500], ['ac', 4, 2500], ['ac', 5, 3000]]; // [종류, 번호, 값]
export const PRICE = Object.fromEntries(CLOSET.map(([k, i, p]) => [k + i, p]));
export const priceOfItem = (key) => PRICE[key] || 0;
export const itemsOf = (a) => ['os', 'ac'].map((k) => k + a?.[k]).filter((k) => PRICE[k]); // 입고 있는 유료 아이템
export const ownedWith = (list, avatar) => [...new Set([...(Array.isArray(list) ? list.filter((k) => PRICE[k]) : []), ...itemsOf(avatar)])]; // 산 것 + 지금 입고 있는 것
export const wearable = (avatar, owned) => itemsOf(avatar).every((k) => owned.includes(k));
// 안 산 유료 아이템을 fallback 아바타의 무료 것으로 되돌림 (편집기 '랜덤'·성별 바꾸기용)
export function lockFix(avatar, owned, fallback) { const o = { ...avatar }; for (const k of ['os', 'ac']) if (PRICE[k + o[k]] && !owned.includes(k + o[k])) o[k] = fallback[k]; return o; }
