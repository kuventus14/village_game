# 카지노 모듈 약속 (서버 ↔ 화면)

마을(`~/dev/village`) 안 3층 카지노: 1층 슬롯 / 2층 텍사스 홀덤 / 3층 블랙잭. **가상 칩만** 사용 (실제 돈 정산·입출금 없음).
플레이어는 마을의 '앉기' 기능으로 카지노 자리(seat)에 앉으면 해당 게임 화면(오버레이)이 열리고, 일어나면 닫힘.

## 공통
- 칩은 정수. 계정마다 `p.chips` 를 가지고 있고, 변경은 반드시 `ctx.wallet` 으로만 함 (저장·알림은 지갑이 처리).
- 게임 모듈은 서버에서 **순수 로직 + 시계 주입**으로 만든다: 시간은 `ctx.now()` 로만 읽고, 타이머는 `tick()` 에서 확인 (setTimeout/Date.now 직접 사용 금지) → 가짜 시계로 시험 가능.
- 자리 정보 `seat`(world.js 의 SEATS 항목): `{ id, kind:'poker'|'bj'|'slot', tbl, chair, x, z, ry, fl }`
  - `tbl` = 같은 종류 안의 테이블 번호 (포커·블랙잭은 지금 0 하나, 나중에 늘릴 수 있게 `tbl` 별로 독립된 테이블을 관리할 것)
  - `chair` = 테이블 둘레 자리 번호 (포커 0~7, 블랙잭 0~4)

## 서버 모듈 인터페이스
```js
export function createXxx(ctx) -> {
  join(p, seat)   // 앉았을 때. 바이인/자리 배정, 초기 상태를 p 에게 보냄. 거절하려면 { ok:false, error:'한글 사유' } 반환 (그러면 서버가 바로 일으켜 세움). 성공은 { ok:true }.
  leave(p)        // 일어났거나 접속이 끊김. 남은 칩 정산(지갑으로 환급)하고 진행 중이면 포기 처리. 여러 번 불려도 안전해야 함.
  act(p, msg)     // 화면이 보낸 { t:'cz', g, a:'동작', ... } 의 msg 전체. 잘못된 입력은 조용히 무시하거나 p 에게 { error } 를 보냄.
  tick()          // 50ms 마다. 타이머(베팅 마감, 차례 제한시간, 다음 판 시작 등)는 여기서 ctx.now() 로 확인.
}
```
`ctx` 는 서버가 넣어 줌:
- `ctx.now()` → ms
- `ctx.wallet.chips(p)` → 현재 칩 / `ctx.wallet.add(p, delta)` → 성공 true (결과가 음수가 되면 false 이고 변화 없음). 변경 때마다 지갑이 `{t:'wallet', chips}` 를 p 에게 알림.
- `ctx.toPlayer(p, payload)` → p 에게 `{ t:'cz', g:<게임id>, ...payload }` 전송 (게임id 는 모듈이 createXxx 로 만들어질 때 서버가 붙임)
- `ctx.players` → Map(id → p). p 는 `{ id, nick, chips, seat, ... }` (seat 는 앉은 자리 번호, 안 앉았으면 -1)
- 한 플레이어는 한 시점에 한 자리에만 앉음. 화면→서버 메시지는 `{ t:'cz', g:'poker'|'bj'|'slot', a:'동작', ... }` 이고 서버가 "그 게임 자리에 앉은 사람"일 때만 `act` 로 전달함.

## 화면 모듈 인터페이스 (브라우저, ES module)
```js
export function createXxxUI(ctx) -> {
  open(seat)   // 앉았을 때: 오버레이를 보여 줌 (이미 열려 있으면 갱신)
  close()      // 일어났을 때: 숨기고 타이머 정리
  onMsg(m)     // 서버가 보낸 { t:'cz', g, ... } 
}
```
`ctx`: `{ root, send(payload), chips(), onChips(fn), nick, toast(text), stand() }`
- `root` = 화면 전체를 덮는 오버레이 컨테이너(`position:fixed; inset:0; pointer-events:none`). 안에 자기 패널을 만들고 **패널에만 `pointer-events:auto`**.
- `send(payload)` → 서버로 `{ t:'cz', g:<게임id>, ...payload }` 전송.
- `ctx.stand()` → 일어나기 요청(패널에 항상 '나가기' 버튼을 둘 것).
- CSS 는 JS 가 `<style>` 로 직접 주입 (index.html 을 고치지 말 것). 클래스는 겹치지 않게 접두사(`pk-`, `bj-`)를 붙일 것. 마을 화면의 이름표(`.tag`)·`.panel`·`.chip` 클래스와 겹치면 안 됨.
- 폰 가로 화면(740×360)에서도 쓸 수 있어야 함: 패널은 화면 아래쪽이나 가운데 위에 컴팩트하게, 터치 버튼은 최소 40px. 한글 UI. 글자 적게·구조 명확하게.
- 폰트: 마을은 `Jua`(제목)/`Apple SD Gothic Neo` 를 씀. 카드는 DOM/CSS(또는 인라인 SVG)로 그림 — 이미지 파일 없음.

## 파일 소유 (겹쳐 쓰지 말 것)
- 홀덤: `holdem.js`, `public/ui-poker.js`, `vendor/ah/*`, `test-holdem.mjs`
- 블랙잭: `blackjack.js`, `public/ui-blackjack.js`, `test-blackjack.mjs`
- 슬롯·지갑·건물·서버 연결·`server.js`/`world.js`/`game.js`/`index.html` 은 메인 담당이 고침 → 건드리지 말고, 필요한 변경이 있으면 보고서에 적을 것.
- 시험은 가짜 `ctx`(가짜 시계·가짜 지갑·메시지 수집)로 `node test-xxx.mjs` 하나로 돌아야 함. UI 는 `/tmp` 아닌 **작업 폴더 밖 임시 폴더**에 독립 시험 페이지를 만들어 확인(마을 서버 3300/3301 포트와 겹치지 말 것).
