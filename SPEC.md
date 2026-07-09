# PIXEL DINER — SPEC.md

엔티티·상태 머신·이벤트·수치에 대한 권위 있는 명세. 수치는
`src/sim/constants.js`에 있고, 이 문서는 그것을 설명한다. 튜닝된 값과 근거는
BALANCE.md 참고.

## 0. 아키텍처 계약

```
 src/core/*   순수 헬퍼   (rng, iso, math, events)      브라우저 의존성 없음
 src/sim/*    순수 로직   (상태 머신, step())            브라우저 의존성 없음  ← Node 실행 가능
 src/render/* 캔버스      (palette, sprites, camera, renderer, hud, fx, touch)
 src/audio/*  Web Audio   (절차적 합성)
 src/input/*  DOM 입력    (키보드 + 터치)
 src/save/*   localStorage
 src/main.js  배선: 고정 스텝 루프 → step(state) → render/audio가 state.fx를 구독
```

`src/sim`은 오직 `src/core`만 import 한다. `window`, `document`, `canvas`,
`Audio` 그 무엇도 건드리지 않는다. 바깥과는 **매 스텝마다 `state.fx`에 순수
데이터 이벤트를 append** 하는 것으로 소통하고, render/audio 계층이 그 큐를
비운다. 바로 이것이 `sim/balance-sim.js`가 게임 전체를 Node에서 헤드리스로
돌릴 수 있게 하는 메커니즘이다.

## 1. 시뮬레이션 클럭

- 고정 타임스텝: `TICK_HZ = 20` → `DT = 0.05초`. `step(state, intent, rng)`는
  틱마다 한 번 실행되며 프레임률과 무관하다.
- 렌더는 디스플레이 주사율로 돌고, 각 엔티티를 `(px,py)`(직전 틱 이전 위치)와
  `(x,y)` 사이에서 `alpha`로 **보간**한다.
- 오프라인/비활성: 로드 시 `elapsed = now - savedAt`을 계산해 `OFFLINE_CAP_SEC`
  (8시간)로 상한을 두고, 빈 플레이어 intent로 `elapsed/DT` 스텝을 몰아서 정산한 뒤
  (직원만 행동) 요약을 보여준다.

## 2. 월드 / 좌표

- 아이소메트릭 2:1 다이메트릭, `TILE_W=32, TILE_H=16`. `tileToScreen`,
  `screenToTile`, `depth = tx+ty`는 `src/core/iso.js`에 있다.
- 그리드 `11 × 9`. 문은 타일 `(5,8)`. 주방 행은 `ty=1`(스토브), 패스(픽업
  카운터)는 `(5,1)`. 테이블은 다이닝 행에 배치.
- 깊이 정렬 키 = `tx + ty` (+ 타입별 작은 바이어스). 캐릭터가 테이블과 y-정렬되어
  뒤로 지나갈 수 있다.

## 3. 엔티티

### 플레이어  (`state.player`)
`{x,y,px,py,vx,vy,facing, carry:[접시들…], actTimer}`
- 가속 기반 이동(가속/마찰), 최대 속도 `PLAYER_SPEED`.
- 코요테 타임 수준의 관용: 상호작용에 단일 타일이 아니라 넉넉한 반경 사용.
- 최대 `PLAYER_CARRY`개의 접시를 든다. 너무 빠르게 이동하다 장애물 근처에서
  놓으면 접시가 깨질 수 있다(`BREAK_CHANCE`) — 슬픈 사운드가 붙는 실제 실패.
- 행동 버튼 없음: 작업 반경 안에 있기만 하면 가장 관련 있는 작업이 자동 수행됨(§10).

### 손님  (`state.customers[]`)
`{id, tableId, dish, x,y,px,py, state, timer, patience, sat}`
상태 머신:
```
ENTER ─도착→ (테이블 없음? QUEUE) ─빈 테이블→ WALK_SEAT ─도착→ SEATED
SEATED ─menuTime→ WANT_ORDER ──주문 접수──→ WAIT_FOOD ──서빙──→ EATING
EATING ─eatTime→ WANT_BILL ──수금──→ LEAVING ─문 도착→ (소멸)
WANT_ORDER / WAIT_FOOD / WANT_BILL: 인내심 카운트다운; 0 도달 → RAGE_LEAVE
```
- `sat`(0..1)은 1에서 시작해, 한 단계의 `timer`가 유예 창을 넘기면 감소한다.
- RAGE_LEAVE: 결제 없음, 평판 −, 붉은 연기, 쿵쿵대며 문으로.
- 말풍선: `?`=주문 원함, `steam`=음식 대기, `coin`=계산 원함, `!!`=화남.

### 테이블  (`state.tables[]`)
`{id, tx,ty, state, customerId}` — `FREE | OCCUPIED | DIRTY`. `DIRTY`는 청소
전까지 착석을 막는다. 처음 `unlockedTables`개만 바닥에 존재.

### 스토브  (`state.stoves[]`)
`{id, tx,ty, ticket, cookT}` — 조리 중인 티켓을 최대 1개 보유. 처음
`unlockedStoves`개만 존재. 병렬성 = 스토브 수, 작업자 = 그것을 조작하는 자.

### 티켓 / 접시 (`state.tickets[]`, `state.pass[]`)
- 티켓 `{id, tableId, dish, stoveId?}`은 주문 접수 시 생성되고 빈 스토브에 배정.
- 조리 완료 시 티켓은 패스 위의 접시가 됨:
  `state.pass.push({tableId, dish})`.

### 직원  (`state.staff[]`)
`{id, role, x,y,px,py, task, carry, actTimer, speed}`
- `role`: `COOK`(스토브 조작 → 접시 생산) 또는 `WAITER`(홀: 주문 받기, 접시
  나르기, 계산 수금, 테이블 청소).
- 유휴 직원은 매 틱 자기 역할이 허용하는 가장 가까운 미점유 작업을 클레임하고,
  그곳으로 걸어가, 수행한다(일부 작업은 소요 시간 있음). `task.targetId`를 통한
  클레임이 이중 배정을 막는다.
- 할 작업이 없는 직원은 **회색으로 멍하니** 서 있다(과잉 구매가 눈에 보임).

## 4. 작업 타입 (플레이어 & 직원 공용)

| 작업        | 전제 조건                                  | 효과                                       |
|-------------|-------------------------------------------|--------------------------------------------|
| TAKE_ORDER  | WANT_ORDER 손님, 아직 티켓 없음            | → WAIT_FOOD, 티켓 생성, 스토브 배정         |
| COOK        | 스토브에 티켓 있음, 아직 조리 안 됨         | cookT 후 → 접시 패스로, 스토브 해제         |
| CARRY       | OCCUPIED 테이블과 매칭되는 패스 위 접시     | 배달 → 손님 EATING                          |
| COLLECT     | WANT_BILL 손님                             | 돈 결제(+팁), → LEAVING                     |
| CLEAN       | DIRTY 테이블                               | → FREE                                      |

플레이어는 버튼 입력 없이, 작업 반경 안에 있는 매 틱마다 자신에게 가장 가까운
자격 있는 작업을 자동 수행한다(§10). **수동 보너스:** 플레이어 작업 타이머는
`MANUAL_SPEEDUP`(×0.7) 짧고 이동 속도도 더 빨라서, 손으로 하는 것이 직원을
기다리는 것을 이긴다.

## 5. 경제

- 단일 화폐: **코인**. COLLECT 시 결제:
  `pay = dishPrice × (0.55 + 0.65·sat) × starMult`, 팁 파티클은 sat에 비례.
- 평판 `rep`(0..∞, 소프트): 만족 결제 시 +, 분노 시 −. 스폰 간격과 최대 대기줄
  길이를 좌우.
- 스폰: `interval = SPAWN_BASE / (1 + rep·REP_SPAWN + marketing·MKT_SPAWN)`,
  ±20% 지터.
- 업그레이드(`src/sim/upgrades.js`), 비용 `base·growth^level`:
  `hireCook, hireWaiter, addTable, addStove, priceTier, staffSpeed, marketing`.
  각각 `recommend(state)` 가중치를 노출해 상점이 현재 병목의 답을 강조할 수 있다.
- 프레스티지 **프렌차이즈**: 순자산 임계치를 넘으면 가능, 바닥과 업그레이드를
  리셋하고 영구 `starMult += f(lifetimeEarnings)` 부여.

## 6. 이벤트 / 피드백 (`state.fx[]`, 바깥 계층이 소비)

각각은 순수 데이터 `{t, x, y, …}`; sim은 절대 렌더하지 않는다. 타입:
`money(+amount,sat)`, `plate`, `cook`, `clean`, `rage`, `seat`, `spawn`,
`break`, `unlock`, `levelup`, `prestige`. 렌더러는 팝업/파티클/셰이크로,
오디오는 절차적 음성으로 매핑한다.

## 7. 저장 (`src/save/save.js`)

localStorage에 `{version, savedAt, state}`. `state.rngState`가 PRNG를 유지.
`migrate(save)` 체인이 `version`을 키로 v1부터 존재해 스키마를 진화시킬 수 있다.
로드 시: 역직렬화 → 오프라인 정산 → 루프에 전달.

## 8. 렌더링 세부

- 논리 해상도 `512 × 288`, 창에 맞춰 정수배 확대(모바일은 화면에 맞춰 분수배),
  `imageSmoothingEnabled=false`.
- 팔레트: `src/render/palette.js`의 고정 28색(색상의 단일 출처).
- 스프라이트: 픽셀 매트릭스/절차적 드로우로 정의, 오프스크린 캔버스에 **1회**
  래스터라이즈 후 키로 캐싱(`sprites.js`).
- 드로우 순서: 바닥 타일 → 깊이 정렬된 엔티티 리스트(테이블, 스토브, 캐릭터,
  말풍선) → 떠다니는 fx(코인/퍼프) → 터치 컨트롤 → 크리스프 오버레이(팝업+HUD).

### 8.1 이중 캔버스 — 텍스트 선명도

`#game`(픽셀아트 월드, `image-rendering:pixelated`로 근접 이웃 확대)과
`#hud`(같은 화면 위치에 겹친 오버레이, 스케일 없이 **실제 디스플레이 해상도**로
백업)를 분리한다. 하나의 저해상도 캔버스에 안티에일리어싱된 글자를 그리고
CSS로 블록 확대하면 글자가 뭉개지므로, 텍스트는 전부 `#hud`에 그린다:
- `#hud`는 `hctx.setTransform(scale·dpr,0,0,scale·dpr,0,0)`로 논리 좌표
  (0..512,0..288)를 자신의 네이티브 픽셀에 매핑 — `hud.js`/`drawPopups`는
  좌표를 그대로 쓰면 되고, 결과만 선명해진다.
- `drawHud`(패널 전체)와 `drawPopups`(월드 위 숫자 팝업)는 `#hud`로.
- `drawFx`(동전·퍼프)와 `drawWorld`/`drawHints`/`drawTouch`는 픽셀아트 룩이
  의도된 부분이라 `#game`에 그대로 남는다.
- 말풍선 글리프(`sprites.js`의 `outlinedText`)는 세계 캔버스 위에 남지만,
  1px 외곽선으로 대비를 확보해 작은 크기에서도 읽힌다.

### 8.2 오브젝트/음식 아이콘 크기

테이블·스토브·패스 카운터·접시 아이콘은 시인성을 위해 원래보다 크게
그려진다(`sprites.js`의 `drawTable`/`drawStove`/`drawPlate`). 이에 맞춰
`TABLE_SLOTS`(2행×4열 균등 격자, 최소 43px 간격)와 `STOVE_SLOTS`(패스 기준
좌우 대칭 3개씩, 최소 23px 간격)를 재배치해, 8테이블/6스토브가 전부 언락된
상태에서도 스프라이트끼리 겹치지 않는다(`node sim/balance-sim.js`로 여행
거리 변화가 밸런스에 미치는 영향을 재검증함).

`WAIT_FOOD` 말풍선은 고정된 플레이스홀더가 아니라 손님이 실제로 주문한
`dish`(`{color, label}`)를 보여준다: 접시 아이콘(`drawPlate`)은 가격 티어에
따라 덩어리 개수/모양이 달라져(예: Fries=1덩이, Feast=3덩이 콤보) 색만으로
구분하지 않아도 되고, 그 아래에 `dish.label`(짧은 한글 요리명, 예: "라멘")을
`outlinedText`로 함께 표시해 무엇을 기다리는지 텍스트로도 확정 가능하다.
말풍선 자체도 음식용(`kind==='food'`)일 때 더 크게(40×30) 그려 시인성을
높였다(그 외 글리프 말풍선은 26×22). 모든 `TABLE_SLOTS` 좌표에서 말풍선이
HUD 상단바(28px)나 좌우 화면 경계를 침범하지 않음을 좌표 계산으로 검증했다.

## 9. 성능

- 엔티티 상한 목표: 동시 500+(손님 + 코인 + 팝업) @ 60fps.
- 파티클 풀링; 팝업 상한; 스프라이트 캐시로 프레임마다 재래스터라이즈 방지.
- Sim 비용은 O(손님 + 직원 + 테이블); 배정은 최근접 스캔(작은 N).

## 10. 입력 (`src/input/input.js`, `src/render/touch.js`)

행동 버튼이 없다. **배치(위치)가 곧 입력**이다 — `state.player`가 작업 반경
(`REACH_RADIUS`) 안에 있으면 매 틱 자동으로 그 작업이 수행된다
(`src/sim/game.js`의 `playerAutoServe` / `playerAutoWork`, §3 참고). 그래서
입력은 순수하게 **이동**만 담당한다:
- 데스크톱: WASD/방향키 이동, 마우스 클릭은 상점으로.
- 모바일/터치: 화면 아무 데나 드래그하는 가상 조이스틱 하나(왼쪽 영역),
  상점 패널(`SHOP_X` 우측)은 탭으로 구매. 버튼을 누를 필요가 없으므로
  터치 UI는 조이스틱뿐이다.
- 순간적 작업(서빙/픽업/주문/수금)은 반경에 들어온 즉시 처리되고, 지속적 작업
  (조리/청소)은 스토브/테이블 자체에 저장된 진행도(`stove.progress`,
  `table.cleanProg`)에 머무는 동안 누적된다 — 자리를 떴다 돌아오면 이어서
  진행된다.
