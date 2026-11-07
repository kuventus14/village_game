// 물고기 가게 설계도 (서버·브라우저·시험이 같이 씀): 자리·판매 거리·하루 판매 한도. 값(가격)은 fishdata.js 의 price
// 가게는 연못 북쪽 빈 땅 (낚시 자리(연못 중심에서 5.5~7.5m)와 안내 거리가 겹치지 않게 12m 넘게 떨어짐)
import { FISH_BY } from './fishdata.js';
import { KST } from './daycycle.js';

export const FISH_STALL = { x: 23, z: 8.5, ry: -0.09, r: 2.2 }; // 가게 자리(연못 북쪽 12.5m, 남쪽 연못을 바라봄) · r = 충돌 원 반지름
export const SELL_RANGE = 6;  // 서버가 파는 걸 받아 주는 거리(m)
export const NEAR_RANGE = 4.8; // 안내 카드가 뜨는 거리(m)
export const DAILY_CAP = 30;  // 하루(한국 시간 0시 기준)에 팔 수 있는 물고기 수 — 낚시 수입이 카지노보다 너무 커지지 않게
export const priceOf = (k) => FISH_BY[k]?.price || 0;
export const sellable = (k) => priceOf(k) > 0;
export const dayIndex = (ms) => Math.floor((ms + KST) / 864e5); // 한국 날짜 번호
