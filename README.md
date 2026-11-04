# 포근마을

친구들과 걸어 다니며 채팅하고, 3층 카지노(슬롯·홀덤·블랙잭, 가상 칩)에서 놀고, 카페·회사·공원에서 앉아 쉬고, 술래잡기·물풍선 피구를 하는 3인칭 3D 마을. 가입·로그인 후 아바타를 꾸미면 계정에 저장됨.

## 내 컴퓨터에서
```bash
npm install
npm start            # http://localhost:3300  (계정은 ./data/store.json 에 저장)
npm test             # 서버 통합 시험
node tools/bots.mjs tag 1    # 가짜 접속자 (tag | dodge)
```

## 배포 (중요)
이 앱의 이동·채팅·게임은 **계속 켜져 있는 서버(WebSocket)** 가 필요합니다. Vercel 의 서버 기능은 WebSocket 을 유지하지 못해서 **게임 서버는 Render / Fly.io / Railway 같은 곳**에 올려야 합니다.

1. **게임 서버** (Render 예): 이 저장소를 연결 → `render.yaml`/`Dockerfile` 사용. 환경변수:
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — 계정 저장소. (Vercel 대시보드 → Storage → KV/Upstash 에서 만들거나 upstash.com 무료 DB) 없으면 파일에 저장하는데, 무료 서버는 다시 켜질 때 파일이 사라져 계정이 날아감.
   - `ALLOW_ORIGIN` — 화면을 Vercel 에 올릴 때 그 주소.
2. **화면** (선택, Vercel): 이 저장소를 Vercel 에 연결하고 환경변수 `VILLAGE_SERVER=https://내서버.onrender.com` 설정 → `vercel.json` 이 `tools/build-static.mjs` 로 `dist/` 를 만들어 올림.
   - 화면까지 한 서버에서 주고 싶으면 Vercel 은 건너뛰고 1번만 해도 됨.

환경변수 `GAME_COUNTDOWN`(ms, 기본 10000) 등은 시험용.

## 봇 유저 (항상 북적이게)
`npm start`(= `node server.js`)로 켜면 **봇 80명**이 진짜 접속자처럼 마을에 들어와 있음 (`bots.js`). 개수는 환경변수 `BOTS=50`, 끄려면 `BOTS=0`. 시험에서 `listen()` 만 부르면 봇은 꺼져 있음.
- 화면에는 사람과 똑같이 보임(이름표·상태·앉기·말풍선·이모트). 계정·칩·도감·기록은 저장 안 함, 귓속말엔 답하지 않음.
- 1~3분마다 한 명씩 나가고 다른 봇이 들어옴(목표 ±5%). 봇 닉네임(풀 280여 개)은 가입에 못 씀, 이미 가입한 이름은 봇이 안 씀.
- 걷기: 2m 격자 길 찾기 + 곧게 펴기, PC형(8방향 키·Shift 달리기)·폰형(조이스틱) 섞임, 두리번·가만히 서 있기·가끔 점프·인사·같이 걷기.
- 하루 일정(한국 시각, `CAMP_AT`/`RITUAL_AT` 이 있으면 그 시계): 새벽 불멍·예불, 아침 카페→회사, 점심 카페, 저녁 미사·예불, 밤 불멍(가끔 불꽃놀이)·카지노·광장. 놀이터 패드·경기장엔 안 들어감.
- 채팅은 봇 전체 합쳐 30~50초에 한 마디쯤. 시험: `test-bots.mjs`.

## 카지노 (가상 칩 전용 — 실제 돈 없음)
마을 동남쪽 3층 건물. 1층 슬롯 · 2층 텍사스 홀덤(봇이 빈자리를 채움) · 3층 블랙잭. 계단(서 있으면 자동으로 오르내림)과 엘리베이터(층 버튼)로 이동. 칩은 계정에 저장되고, 처음 1,000칩이며 300칩 미만이면 6시간에 한 번 1,000칩으로 채워 줌. 게임 모듈 약속은 `docs/CASINO.md`.
시험: `npm test` (`test-casino.mjs` 통합, `test-blackjack.mjs`·`test-holdem.mjs` 규칙·칩 보존, `test-world.mjs` 모든 자리에 걸어서 갈 수 있는지).

## 구조
`public/world.js` 마을·옵션·충돌 데이터(서버와 브라우저 공용) · `server.js` 접속·채팅·귓속말 · `auth.js`/`store.js` 가입·로그인·저장 · `games.js` 미니게임 심판 · `public/game.js` 화면/조작 · `public/avatar.js` 캐릭터 · `public/minigame.js` 경기장 화면.
