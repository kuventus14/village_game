# 포근 놀이공원 + 동물원 (2026-11-04 사용자 요청) — 설계 약속

작업 폴더는 **복사본 `~/dev/village-vis`** (실서버 `~/dev/village` 는 건드리지 말 것). 코드 스타일·주석 밀도·이름은 옆 파일(`public/campdata.js`, `public/camp-site.js`, `camp.js`)을 따른다. 설명 글은 한국어.
먼저 읽을 것: `docs/SACRED.md`(3배 확대·충돌 약속), `public/campdata.js` + `public/camp-site.js` + `camp.js`(마을 밖 장소를 붙인 선례: 데이터/렌더링/규칙 분리, 시험).

## 사용자 요청 (원문 요약)
- 포근마을에서 조금 떨어진 곳에 **놀이공원**. 크기는 마을의 **2~3배**(더 커야 하면 더 크게). 아바타가 **실제로 타고 논다**.
- 기구 10종: ①대관람차(파스텔 곤돌라·별 조명, 친구와 함께 타고 마을 전체 구경) ②회전목마(크림 지붕·말/토끼/곰 좌석, 천천히 회전하며 위아래) ③롤러코스터(민트 레일·통통한 기차 차량, 공원 전체를 가로지름) ④바이킹(둥근 해적선·동물 선수상, 여럿이 마주 앉아 크게 흔들림) ⑤범퍼카(사탕색 차·반짝이는 실내 경기장, 직접 운전하고 부딪힘) ⑥회전 찻잔(거대 찻주전자·알록달록 찻잔, 회전 속도 직접 조절) ⑦회전그네(꽃 모양 지붕, 공중 빙글빙글) ⑧드롭타워(별 장식 높고 둥근 탑, 꼭대기에서 멈췄다 급강하) ⑨후룸라이드(통나무 배·작은 폭포·동굴, 경사로 낙하) ⑩꼬마기차(동글동글 증기기관차·작은 역사, 공원을 한 바퀴).
- **동물원도 크게**: 기린·사자·호랑이·레서판다·얼룩말·하마·타조·판다. **종마다 따로 울타리**, 종마다 **최소 4~5마리**.
- **입구부터 웅장**한 느낌.
- 디자인 방향: 이 게임의 파스텔 로우폴리(둥글둥글·귀여움), 글자 적게·구조 명확, 밤엔 조명이 반짝.

## 단계
- **1단계(지금)**: 부지·웅장한 입구·길·동물원 전체(8종)·꼬마기차·회전목마·대관람차·지도/봇 연동·시험·실행 확인.
- **2단계(나중, 한도 보고 결정)**: 나머지 기구 7종(롤러코스터·바이킹·범퍼카·회전찻잔·회전그네·드롭타워·후룸라이드). **그래서 1단계에서 2단계 자리와 탈것 틀을 미리 만들어 둔다.**

## 부지 (권위 있는 숫자, `public/parkdata.js` 에 그대로 옮김)
마을 울타리는 x ±120, z ±44 (면적 약 21,100㎡). 서쪽 대문을 새로 뚫고(동쪽 `GATE` 와 대칭, 성당(z -14.5..24.5)을 피해 **z = -34**) 서쪽으로 길을 내서 놀이공원에 닿는다.
```
PARK = { x0: -532, x1: -232, z0: -144, z1: 96 }   // 300 × 240 = 72,000㎡ (마을의 약 3.4배)
VILLAGE_GATE_W = { x: -120, z: -34, hw: 4.5 }     // 마을 서쪽 대문 (울타리 x=-BX 에 뚫음, town.js 울타리 기둥·울타리 비우기)
PARK_ROAD   : 대문(-120,-34) → 놀이공원 정문(-232,-34), 길이 ~120m, 살짝 굽이진 흙길 + 양옆 벚나무·가로등 (campdata 의 catmull·campNear 방식), 길 반쪽 폭 5
PARK_GATE   = { x: -232, z: -34, hw: 15 }          // 정문 (동쪽 울타리 한가운데 아님: 부지 z0..z1 안, 길 축 z=-34)
```
- 정문 → 서쪽으로 **중앙 대로(PROMENADE)**: 축 z=-34, 반쪽 폭 9, x -268..-500. 서쪽 끝(-496,-34)에 **대관람차**가 랜드마크로 우뚝 서서 정문에서 정면으로 보임.
- **입구 광장(ENTRY_PLAZA)**: x -268..-232, z -34±40: 큰 분수/별 조형·꽃밭·벤치·매표소풍 건물·풍선.
- **동물원 구역 ZOO_ZONE**: x -520..-250, z -142..-68 (270×74). 종별 울타리 8개(2열×4, 열 사이 걷는 길). 동물원 입구는 대로 북쪽에서 이어짐.
- **놀이기구 구역 RIDES_ZONE**: x -520..-250, z -22..94 (270×116). 대로 남쪽.
- 대로와 동물원 사이 띠(z -68..-44): 매점·쉼터·벤치·화장실풍 건물·꽃밭.
- 부지 둘레: 낮은 울타리 + 나무(안쪽은 걷기 영역, 바깥은 `resolve` 의 보이지 않는 벽).

## 확정된 배치 방침 (사용자 승인, 배치도 그림 기준)
- 번호는 사용자 목록 순서: 1 대관람차 · 2 회전목마 · 3 롤러코스터 · 4 바이킹 · 5 범퍼카 · 6 회전 찻잔 · 7 회전그네 · 8 드롭타워 · 9 후룸라이드 · 10 꼬마기차.
- 기구 구역 안에 **세로 간선길 1개 + 가로 순환길 1개**를 넣어 모든 기구 발자국이 길에 닿게 한다. 길이 기구 위를 지나가면 안 됨(발자국과 길 사이 4m 이상 간격).
- 순한 기구(2 회전목마·5 범퍼카·6 회전 찻잔·10 꼬마기차역)는 **정문 쪽(동쪽)**, 센 기구(3·9·8·7·4)는 **서쪽 안쪽**. 대관람차는 대로 서쪽 끝 랜드마크(길이 바퀴 아래에서 끝나지 않고 광장처럼 열린 승강장 앞에서 끝남).
- 동물원은 종마다 따로 울타리 8칸(2열×4, 열 사이 걷는 길 10m), 칸마다 사람이 둘러볼 수 있는 관람 길·낮은 울타리 바깥 난간. 동물원 입구는 대로(북쪽)와 이어짐.
- 아래 표의 예시 좌표(배치도의 값)는 **출발점**: 겹침·길 막힘이 있으면 foundation 이 조정해도 되지만 구역(ZOO_ZONE·RIDES_ZONE)·정문·대로·대관람차 위치는 바꾸지 말 것.
  예시 중심 좌표(x,z)와 발자국: ferris(-496,-34) 24×64, carousel(-300,8) 40×40, drop(-352,8) 22×22, teacups(-400,10) 40×40, swing(-448,10) 36×36, coaster(-494,47) 52×94, flume(-420,64) 80×52, viking(-345,68) 32×32, bumper(-290,70) 44×32.
- 동물원 울타리 칸 예시: 윗줄 z -136..-108 / 아랫줄 z -98..-68, x는 -520..-250 을 4칸(칸 폭 88→월드 m 기준 약 62m, 간격 8m). 윗줄 기린·사자·호랑이·레서판다, 아랫줄 얼룩말·하마·타조·판다.

## 기구 자리 (RIDE_SLOTS, 2단계 것도 지금 잡는다) — 발자국 크기(가로x × 세로z, 줄 서는 곳 포함)
꼬마기차는 선로가 따로(아래). 1단계 만들 것 = 표시.
| id | 이름 | 발자국 | 비고 |
|---|---|---|---|
| ferris ★ | 대관람차 | 24 × 64 | 대로 서쪽 끝 중심 (-496,-34), 바퀴 면은 z–y (정문에서 정면), 반지름 28, 축 높이 31 |
| carousel ★ | 회전목마 | 40 × 40 | 대로 남쪽 가까이 |
| train ★ | 꼬마기차 | 선로 | 닫힌 선로 `TRAIN_PATH`: 부지 안쪽을 한 바퀴(동물원 열·기구 구역 둘레), 역 3곳(정문역·동물원역·기구역). 선로는 걸어서 건널 수 있음(충돌 없음) |
| coaster | 롤러코스터 | 100 × 52 | 2단계, 구역 서남쪽 큰 자리 |
| viking | 바이킹 | 32 × 32 | 2단계 |
| bumper | 범퍼카 | 44 × 32 | 2단계, 지붕 있는 실내 경기장 건물 |
| teacups | 회전 찻잔 | 40 × 40 | 2단계 |
| swing | 회전그네 | 36 × 36 | 2단계 |
| drop | 드롭타워 | 22 × 22 | 2단계, 높이 약 50m |
| flume | 후룸라이드 | 80 × 52 | 2단계, 물길·작은 폭포·동굴 |
위치는 foundation 이 정한다 (서로 겹치지 않게, 길로 이어지게, 가장 눈에 띄는 것들을 대로 가까이). 결과는 `RIDE_SLOTS[id] = { x, z, ry, w, d }`.

## 파일 분담 (서로 부르는 순서 때문에 새 파일은 world.js 를 import 하지 않는 데이터 파일 + 렌더링 파일로 나눔, campdata 선례)
- `public/parkdata.js` (**foundation**): PARK, 대문·길·정문·대로·광장·구역 사각형, RIDE_SLOTS, TRAIN_PATH(+역), `parkNear`, `parkWalk(x,z)` (걸을 수 있는 땅: 부지 사각형 ∪ 대문~길), `inPark`, `parkDist`, 충돌(PARK_RECTS/PARK_CIRCLES), 벤치·가로등 목록, 지도용 `PARK` 내보내기. world.js 가 `export * from './parkdata.js'` 하고 `resolve` 의 `walkable` 에 `parkWalk` 를 끼움, `placeOf` 가 'park'(`PLACE.park = ['🎡','놀이공원']`) · 동물원은 'zoo'(`['🦒','동물원']`) 를 돌려줌, `RECTS`·`CIRCLES` 에 충돌 추가.
- `public/park-site.js` (**foundation**): 땅·길·정문(웅장)·광장·대로·울타리·꽃·나무·가로등·벤치·표지판·건물풍 장식·대문 렌더링. `createParkSite(scene, Q)` → `{ update(dt, camera) }`.
- `public/zoodata.js` + `public/zoo.js` (**zoo 에이전트**): 울타리·동물 데이터·충돌 + 렌더링·동물 애니메이션. foundation 은 빈 자리 파일(껍데기)만 둠.
- `public/ridesdata.js` + `public/rides.js` + `rides.js`(서버 규칙) (**rides 에이전트**): 탈것 틀 + 1단계 3종(+2단계가 쉽게 붙게 레지스트리). foundation 은 껍데기만.
- 건드리는 공유 파일(최소로): `public/world.js`, `public/town.js`(서쪽 대문), `public/nature.js`·`public/gfx.js`·`public/atmosphere.js`(땅 평탄화·나무 비우기·구름/나비 비우기), `public/minimap.js`, `public/game.js`(create 호출 줄), `server.js`(메시지 줄), `bots.js`(공원 가기), `Dockerfile` 는 `COPY *.js` 이미 있음, `package.json` test 체인 끝에 새 시험 추가.

## 공통 규칙
- **성능**: 8GB 맥·폰. 새 장식은 재질별로 지오메트리를 합쳐서(BufferGeometryUtils 의 mergeGeometries 또는 `public/gfx.js` 의 kit 방식) 그리기 호출을 줄인다. 공원 전체는 카메라가 부지 중심에서 멀면(약 330m 밖) 통째로 `visible=false`, 구역별(동물원·기구)로도 거리 숨김(camp-site 의 `lodKit` 선례). 동물 한 마리 = 합친 메시 몇 개. 품질 `Q.level`(high/normal/low)·`Q.lite` 존중.
- **밤·노을**: 창·조명·별 장식은 `nightGlow`(sacred.js 가 쓰는 방식, atmosphere 상태 night)로 반짝.
- **시계·난수**: 서버 규칙은 camp.js 처럼 `ctx.now()`·주입 난수만 써서 가짜 시계로 시험.
- **자리·충돌**: 서버·브라우저·시험이 같이 쓰는 데이터는 world.js 를 import 하지 않는 파일에. 걷기 반지름 0.4. 아바타가 갇히면 안 됨: 모든 자리는 대로·길에서 걸어서 닿아야 하고(시험), 울타리 안 동물 공간에는 사람이 못 들어감.
- **시험**: `test-park.mjs`(foundation: 대문→길→정문→대로→기구 구역·동물원 길까지 걸어 닿음, 가둠 없음, 기구 자리 안 겹침, 동물원 울타리 안은 못 들어감), zoo/rides 도 자기 시험. `npm test` 체인 전체가 통과해야 함. 화면은 꼭 실행해서(헤드리스 크롬 스크린샷) 눈으로 확인 — 테스트 통과 ≠ 보이는 것.
- 범위 밖 건드리지 말기(기존 기능 동작 유지). 가져온 외부 에셋·파일 없음(전부 절차적 지오메트리·캔버스 텍스처·WebAudio).

## 연결 약속 (foundation 이 깔아 둔 것 — zoo/rides 에이전트는 **자기 파일만** 채우면 됨)

### 1. 데이터 (`public/parkdata.js`, world.js 가 `export *` — 서버·브라우저·시험 모두 `./public/world.js` 에서 꺼내 씀)
| 이름 | 뜻 |
|---|---|
| `PARK` {x0 -532, x1 -232, z0 -144, z1 96} · `PARK_CENTER` · `PARK_FAR` 330 | 부지, 카메라가 가운데에서 330m 밖이면 공원을 통째로 숨김 |
| `VILLAGE_GATE_W` (-120,-34, hw 4.5) · `PARK_TOWN_PATH` | 마을 서쪽 대문, 마을 안 흙길 |
| `PARK_ROAD` {pts, s, len ≈115, hw[]} · `parkRoadNear(x,z)` · `parkRoadAt(s)` · `ROAD_LAMPS` · `ROAD_TREES` | 대문→정문 벚꽃길 (반쪽 폭 5, 정문 앞 22m 동안 14 로 넓어져 앞마당) |
| `PARK_GATE` (-232,-34, hw 15) · `GATE_TOWERS` [z -53.4/-14.6, r 4.4] | 정문 (열린 폭 30m) |
| `PROMENADE` {x0 -500, x1 -268, z -34, hw 9} · `ENTRY_PLAZA` {-268..-232, -74..6} · `PLAZA_FOUNTAIN` (-250,-34, r 6) | 대로·광장·별 분수 |
| `ZOO_ZONE` · `RIDES_ZONE` · `inPark(x,z,m)` · `inZoo(x,z)` · `parkDist(x,z)` · `parkWalk(x,z)` | 구역, 부지·길에서 잰 거리, 걷는 땅 |
| `PARK_PATHS` [{id, kind 'promenade'/'ride'/'zoo', a, b, hw}] · `parkPathNear(x,z,kinds)` | 공원 길 (기구: 세로 간선길 x -366, 가로 순환길 z 27 / 동물원: 들어가는 길 x -398, 줄 사이 길 z -103, 칸 사이 x -460·-336, 띠 길 z -66) |
| `RIDE_SLOTS[id]` {id, name, stage, x, z, ry 0, w, d, entry[x,z]} · `slotRect(s)` | 기구 자리 10종 (아래 표). 발자국은 줄 서는 곳 포함, 길과 4m 띄우고 entry 는 길에서 정확히 4m |
| `TRAIN_PATH` {pts, s, len ≈950, closed, gauge 1.2} · `trainAt(s)` → [x,z,tx,tz] · `trainNear(x,z)` · `TRAIN_STATIONS` | 닫힌 선로 (모서리 둥근 네모 x -527..-270, z -139..91, r 14), 역 3곳 |
| `ZOO_PENS` [{id, name, x0,z0,x1,z1}] 8칸 · `ZOO_ARCH` (-398,-46) | 동물원 칸 계획 (52×26m, 칸 사이·줄 사이 10m) |
| `PARK_SHOPS` · `PARK_BENCHES`(앉을 수 있음, SEATS 'park' 맨 뒤) · `PARK_LAMPS` · `PARK_TREES` · `BALLOON_CARTS` · `PARK_SIGNS` | 장식 (충돌은 `PARK_RECTS`·`PARK_CIRCLES`) |

기구 자리 (가운데 x,z · 발자국 w×d · 입구):
| id | 이름 | 단계 | 가운데 | 발자국 | 입구(entry) | 닿는 길 |
|---|---|---|---|---|---|---|
| ferris | 대관람차 | 1 | (-496,-34) | 24×64 | (-484,-34) | 대로 끝 승강장 (바퀴 면 z–y, r 28, 축 31) |
| carousel | 회전목마 | 1 | (-295,-1) | 40×40 | (-295,-21) | 대로 |
| teacups | 회전 찻잔 | 2 | (-338,-1) | 40×40 | (-338,-21) | 대로 |
| swing | 회전그네 | 2 | (-392,-3) | 36×36 | (-392,-21) | 대로 |
| viking | 바이킹 | 2 | (-429,-5) | 32×32 | (-429,-21) | 대로 |
| drop | 드롭타워 | 2 | (-459,-10) | 22×22 | (-459,-21) | 대로 (높이 50) |
| bumper | 범퍼카 | 2 | (-297,51) | 44×32 | (-297,35) | 가로 순환길 |
| flume | 후룸라이드 | 2 | (-362,61) | 80×52 | (-362,35) | 가로 순환길 |
| coaster | 롤러코스터 | 2 | (-455,61) | 100×52 | (-455,35) | 가로 순환길 |
| train | 꼬마기차 | 1 | 정문역 (-263,-59) 10×14 | — | (-263,-52) | 광장 |

꼬마기차 역: 정문역 (-270,-59) s≈88 · 기구역 (-527,12) s≈562 · 동물원역 (-398,-139) s≈836 (s 가 늘면 지도(북쪽 위)에서 시계 방향, s 0 = 북동쪽 모서리). 역사 발자국은 `TRAIN_STATIONS[i].rect`.
동물원 칸: 윗줄 z -134..-108 = 기린 x -517..-465 · 사자 -455..-403 · 호랑이 -393..-341 · 레서판다 -331..-279 / 아랫줄 z -98..-72 = 얼룩말 · 하마 · 타조 · 판다 (같은 x).

### 2. 동물원 (`public/zoodata.js` + `public/zoo.js`) — 지금은 빈 껍데기
- `zoodata.js` (world.js 를 import 하지 말 것, `./parkdata.js` 는 됨): `ZOO_RECTS` [[x0,z0,x1,z1]], `ZOO_CIRCLES` [{x,z,r}], `ENCLOSURES` [{id,name,x0,z0,x1,z1}] (사람이 못 들어가는 동물 공간 — `test-park.mjs` 가 '걸어서 못 들어감'·'갇힌 빈 땅 없음'(ENCLOSURES 안은 빼고)을 자동 확인), `ZOO_ANIMALS` (형식 자유). 배열은 **다시 대입하지 말고 채우기**(선언 그대로 두거나 push) — world.js 가 배열 자체를 가리킴.
- `zoo.js`: `createZoo(scene, Q)` → `{ update(dt, camera) }`. game.js 가 한 번 만들고 매 프레임 부름. 땅·길·입구 아치는 park-site.js 가 이미 그림.
- 이름 규칙: zoodata 의 export 는 `ZOO_`·`zoo`·`ENCLOSURES` 로 시작하되 parkdata 이름(`ZOO_ZONE`, `ZOO_PENS`, `ZOO_ARCH`, `ZOO_AVE_X`, `ZOO_ROW_Z`, `ZOO_BAND_Z`)과 겹치면 안 됨 (`export *` 가 겹친 이름을 조용히 버림).

### 3. 놀이기구 (`public/ridesdata.js` + `public/rides.js` + 서버 `rides.js`) — 1단계 3종 완료(2026-11-04), 새 기구 붙이는 법은 `docs/RIDES.md`
- `ridesdata.js` (world.js import 금지): `RIDES` {id → 정보} — 여기 **id 가 들어가면 park-site.js 가 그 자리의 '준비 중' 꽃울타리·안내판을 안 그림**. `RIDE_RECTS`·`RIDE_CIRCLES` (충돌, 배열 채우기), `RIDE_STATUS` {키: ['🎡','타는 중']} → world.js 가 `STATUS`·`ACT_STATUS` 에 넣음. 이름은 `RIDE`/`RIDES`/`ride` 로 시작하되 `RIDE_SLOTS`·`RIDE_SPINE_X`·`RIDE_LOOP_Z` 는 parkdata 것.
- `public/rides.js`: `createRides({ scene, camera, Q, players, getMe, send, toast, bubble, host })` → `{ handle(m) → bool, key(e) → bool, update(dt), busy() → bool }`. game.js: 서버 메시지마다 handle (welcome 엔 `m.rides` = 서버 snapshot), 키마다 key, 매 프레임 update, busy() 면 걷기·점프 입력을 막음.
- 서버 `rides.js`: `createRidesServer(ctx)`, ctx = `{ now(), rand(), players, send(p,o), bcast(o), info(p), stand(p) }` → `{ act(p, m), tick(), snapshot(), leave(p), frozen(p) }`. server.js: `{ t: 'ride', … }` → act, 50ms 마다 tick, 나갈 때 leave, welcome 에 `rides: snapshot()`, frozen(p) 가 true 면 'm'(걷기) 무시.
- 꼬마기차 레일·역사는 rides 가 그림(`TRAIN_PATH`), 선로는 걸어서 건넘(충돌 없음).

### 4. 충돌·걷기 (world.js)
- `resolve(x,z)` 는 x < -121.5 (마을 서쪽 밖) 이면 **공원 목록만** 봄: `[PARK_RECTS, PARK_CIRCLES]`, `[ZOO_RECTS, ZOO_CIRCLES]`, `[RIDE_RECTS, RIDE_CIRCLES]` (배열을 그대로 가리켜서 나중에 채워도 반영). 마을 쪽 RECTS/CIRCLES 에는 안 넣음 → 마을 걷기 계산은 그대로 빠름 (공원 resolve ≈ 2.6µs, 마을 ≈ 10µs).
- 걷는 땅 = 마을 ∪ 사찰 마당 ∪ **놀이공원 부지(울타리 안쪽 0.6m)·대문~정문 길** ∪ 캠프 ∪ 숲길. 부지 울타리·길 밖은 보이지 않는 벽.
- `placeOf`: 부지 안 'park' (ZOO_ZONE 안은 'zoo'), 가는 길도 'park'. `PLACE.park = ['🎡','놀이공원']`, `PLACE.zoo = ['🦒','동물원']`.

### 5. 나머지 연결
- 땅: `gfx.js` groundH 가 부지·길 둘레 25m 를 평평하게(60m 까지 서서히), `nature.js`·`atmosphere.js` 가 길·부지 위 풀·바위·먼 숲을 비우고 먼 산을 공원 뒤로 물림, `world.js` 가 울타리 밖 풍경 나무를 길·부지 밖으로 옮김(지우지 않음), 마을 안 서쪽 길 위 나무는 비켜 줌.
- `town.js`: 서쪽 울타리 대문 자리(z -34±4.5) 난간·기둥 비움. 대문 장식·간판은 park-site.js.
- `minimap.js`: 부지·구역·길·광장·기구 자리·동물원 칸·선로(점선)·정문 + 이름표(놀이공원·동물원·정문·기구 9곳).
- `bots.js`: 걷기 격자 서쪽 확장(GX0 -536, NX 475 → 서쪽 대문으로 이어짐), 활동 'fun'(놀이공원: 광장·대로·기구 길 어슬렁, 가끔 공원 벤치) · 'zoo'(동물원 길), 정원 fun 20 · zoo 12, 시간표 가중치(낮에 많고 밤 동물원 0). 기존 'park' 는 마을 벤치 그대로. 새벽 회사 가중치 0.04 를 적음(난수 순서가 바뀌어 시험이 흔들려서).
- 시험: `test-park.mjs` (npm test 맨 끝). 기존 시험 세 곳만 고침: test-bots(서쪽 대문을 대문 목록에, 장소 목록에 park·zoo), test-sacred('허공' 이 놀이공원 땅으로 와도 됨), test-camp(불멍 자리 뒤에 놀이공원 벤치 자리 허용).
- 화면: `docs/visual/park-a-village-gate.png`(서쪽 대문·벚꽃길), `park-b-gate-front.png`(정문 정면), `park-c-plaza.png`·`park-c2-promenade.png`(광장·대로), `park-d-aerial.png`(전경, 안개 끄고), `park-e-night-gate.png`·`park-e2-night-plaza.png`(밤), `park-f-map.png`(큰 지도). 1280×720 높음 60fps, 정문 앞 33만 삼각형·157콜, 마을 서쪽 대문 50만·176콜.

## 호수와 아치 다리 (마을 대문 → 정문 길, 불꽃놀이 관람석)
- 데이터(`parkdata.js`): `LAKE`(호수 길이·폭·수면 높이), `BRIDGE`(다리 구간·높이), `bridgeH(s)`(걷는 바닥 높이), `lakeEdge`·`lakeD`·`lakeDepth`(호수 가장자리·바닥 깊이). s = 마을 대문부터 길을 따라 잰 거리.
- 다리는 호수보다 양쪽 땅에서 8~9m 먼저 오르막으로 시작하고, 가운데 6.5m 까지 솟음(경사 최대 12.7°). 가운데는 폭 17m 전망 광장(`PARK_ROAD.hw` 가 넓어짐).
- 걷는 높이는 `world.js floorY` 가 길 위에서 `bridgeH` 를 돌려줌(카메라·다른 사람 높이도 같음). 호수 물속은 길 밖이라 `parkWalk` 가 길 위로 되돌림 → 물에 못 들어감.
- 땅은 `gfx.js groundH` 가 `lakeDepth` 만큼 파냄. 그림은 `bridge.js`(물 셰이더·다리 바닥·난간·가로등·교각·갈대). 길가 가로등·나무는 물속에 없게 `parkdata.js` 에서 걸러 냄. 시험: `test-bridge.mjs`.
- 다음 단계: 정문 게이트 닫힘(2단계), 정문 위 불꽃놀이(3단계). 불꽃은 다리 위에서 서쪽(정문)을 보고 올려다봄.

## 불꽃놀이 시간 운영과 정문 게이트 (2단계)
- 시간표(`public/showdata.js`, 순수): 한국 시각 19:00·22:00 쇼. 쇼 시작 기준 -5분 `warn`(안내·놀이기구 새 손님 마감) → -3분 `evac`(안에 있는 사람이 정문 밖 다리 쪽으로 자동 걸음) → -1분 `closed`(게이트 닫힘, 남은 사람은 다리 앞으로 옮김) → `show` 3분 → `after` 30초 → `open`(게이트 열림·영업 재개). 문구는 `SHOW_TEXT`.
- 서버(`show.js`): 단계가 바뀔 때 `{t:'show', ph, until, gate}` 방송, `evac`·`closed` 때 사람·봇 처리, 놀이기구는 `rides.js` 의 `ctx.closed()` 로 새 손님 거절(타던 사람은 회차 끝까지, 문 닫힐 때 `evict`). `welcome.show` 로 중간에 들어온 사람도 상태를 받음. 시험·시연용 시계: `SHOW_AT=HH:MM[:SS]`.
- 게이트 문: 정문은 처음부터 문이 달려 있음(`park-site.js`, 접이문 2장×양쪽). 평소엔 탑 옆으로 접혀 열려 있고 닫히면 가운데로 펼쳐지며 "영업 임시 중단" 간판이 보임(6초 모션, `GATE_MS`). 걷는 벽은 `parkdata.js` 의 `GATE_WALL`(닫힐 때만 한 칸) — 서버·화면이 각자 `setGateClosed` 로 맞추고, 서버는 `crossesGate` 로 큰 걸음이 벽을 건너뛰는 것도 막음.
- 화면(`game.js`): 안내 띠 `#showBar`(단계 문구 + 쇼까지 남은 시간), `evac` 받으면 자동 걸음, 닫힌 시간엔 놀이공원 안으로 가는 자동 걸음 거절. 시험: `test-show.mjs`.
- 알려진 한계: 게이트가 열려 있는 `evac` 단계에 새로 들어가는 사람은 막지 않음(`closed` 에서 다리 앞으로 옮김). 열린 문짝(접힌 상태)에는 충돌이 없음.

## 불꽃놀이 쇼 (3단계: 3D 불꽃 · 음악 · 효과음)
- 대본(`public/showscript.js`, 순수): 쇼 시작 0초 기준 3분, 분당 96박·한 마디 2.5초, 터짐 186번(13종)·지상 분수/하늘 폭포 37개. 막 경계 0·25·65·110·150초는 마디 경계, 마지막 한 방(giant)은 180초 = 마지막 큰 화음. 시험 `test-showscript.mjs`.
- 3D(`public/parkshow.js`): 정문 뒤(x −240) 하늘 85~130m 에서 터짐. 다리(동쪽)에서 올려다보게 모양 불꽃(하트·별·웃는 얼굴·원)은 (옆 z · 높이 y) 판 위에 그림. 입자는 camp 불꽃과 같은 빛 점(glowPoints)·가산·블룸, 터질 때마다 점광원 하나(쇼 앞뒤 30초만 씬에 둠) + 호수 번쩍임(`U.flash`). 쇼 시계 t = (지금 − 서버가 알려 준 쇼 시작) → 중간에 들어와도 지금 장면부터(진행 중인 분수·폭포 이어서). 품질별 입자 수.
- 소리(`public/showaudio.js`): 3분 음악(막마다 악기가 늘고 4막·5막 장조 상승)과 효과음을 전부 코드로 만들어 `audio.js` 공용 출력에 연결, 설정의 배경음악·효과음 크기를 따름. 쇼 시계에 맞춰 0.4초 앞서 예약, 정문에서 멀수록 작아지고(130~420m) 폭발음은 거리/340초 늦게, 쇼가 들릴 땐 마을 배경음악을 줄임(`bgm.js` duck).
- 봇: 쇼 3분 전부터 일부(기본 55%)가 다리 가운데 광장으로 걸어가 서서 구경(`bots.gather`, 서 있는 시간 `SHOW_HOLD_S` 초로 시연용 조절).
- 영상 찍기(개발용): `window.__village.stepFrame(dt)`(프레임을 정해진 간격으로 하나씩) · `setCamHook` · `setShowT` · `applyShow`, 소리는 `renderShowAudio()` 로 한꺼번에 가상 렌더링. 3분 영상(16:9)과 1분 스토리(9:16)를 이 방식으로 찍음.

## 물고기 가게 (집·경제 1단계: 돈 흐름의 시작)
- 낚은 물고기는 가방(`p.bag`)에 쌓이고(쓰레기는 안 담김), 연못 북쪽 가게(`public/shopdata.js` FISH_STALL, 6m 안)에서 칩으로 바꿈 — 칩은 카지노와 같은 돈(분리 안 함, 사용자 결정). 값은 `fishdata.js` 의 price(붕어 500 ~ 황금 잉어 5000, 한 번 낚을 때 평균 약 1,050칩).
- 하루(한국 0시 기준) `DAILY_CAP` = 30마리까지 팖(낚시 수입이 카지노 판돈보다 너무 커지지 않게. 값은 `shopdata.js` 에서 바꿈). 가방·오늘 판 수는 계정에 저장(`auth.saveShop`), 손님은 접속 동안만.
- 서버 `shop.js`(규칙·검사·저장), 화면 `public/shop.js`(가게 모양·안내 카드·판매 창). 메시지 `{t:'shop', a:'sell'|'sellall'|'open'}`. 시험 `test-shop.mjs`.
- 다음: 옷 가게(아바타 꾸미기 일부를 유료로, 계정별 소유 목록), 그 뒤 내 집·가구.

## 옷 가게 (집·경제 1단계 마무리)
- 마을 광장 남서쪽 가게(`public/closet.js` CLOSET_STALL, 6m 안). 유료 8종: 옷 스타일 후드티 2,000 · 셔츠·넥타이 3,000 · 멜빵바지 2,500, 꾸미기 동그란 안경 1,500 · 선글라스 2,000 · 비니 2,500 · 야구모자 2,500 · 곰돌이 띠 3,000(칩, 카지노·물고기 가게와 같은 돈). 티셔츠·원피스(기본 옷)와 옷 색·바지 색·머리·얼굴은 무료.
- 한 번 사면 계정에 영원히 남음(`u.closet`, `auth.saveCloset`). 지금 입고 있는 유료 옷은 가진 것으로 침(예전 계정 보호, `ownedWith`). 로그인한 계정만 살 수 있고 손님은 불가.
- 입는 건 아바타 꾸미기: 안 산 옷은 🔒 와 값이 보이고, 서버 `avatar` API 도 안 산 옷은 거절. '랜덤'은 산 옷·무료 옷만 고름.
- 서버 `closet.js`(거리·칩·중복·로그인 검사), 화면 `public/clothshop.js`(가게·구매 창, 가게 모양은 `shop.js` 의 buildStall 을 물고기 가게와 같이 씀), 시험 `test-closet.mjs`.
- 다음: 2단계 내 집(주택 단지·집터·방·기본 가구) → 3단계 가구 백화점·꾸미기.
