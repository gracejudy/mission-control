# 미션보드 — Projects 탭 구현
_Issued by 아가씨 | 2026-04-17_
_선행 조건: MISSION_BOARD_FORK_TASK.md 완료 후 진행_

> Fork 완료 + submodule 등록 후 Windows에서 코드를 직접 편집한다.
> 완료 후 commit + push → judy가 Mac mini에서 pull + 서버 재시작.

---

## 목적

미션보드 사이드바에 **Projects 탭**을 추가한다.
각 프로젝트의 작업 현황과 생성된 콘텐츠를 한 화면에서 확인할 수 있게 한다.

주요 니즈:
- personal-brand에서 매일 09:30 생성된 콘텐츠 아이디어/씨앗을 미션보드에서 확인
- 프로젝트별 현황을 폴더 탭처럼 전환하며 볼 수 있게

---

## UI 설계

### 사이드바

기존 Mission 탭 옆에 Projects 탭 추가.

```
사이드바 순서:
  Dashboard
  Mission        ← 기존
  Projects       ← 신규 추가
  System
  ...
```

### Projects 페이지 레이아웃

```
┌─────────────────────────────────────────────┐
│  [crawler-pipeline]  [judy-ops]  [personal-brand]  ← 탭 (종이 화일 탭 스타일)
├─────────────────────────────────────────────┤
│                                             │
│  선택된 프로젝트 대시보드                     │
│                                             │
└─────────────────────────────────────────────┘
```

탭 스타일: 선택된 탭은 흰 배경 + 아래 테두리 없음 (종이 탭처럼). 미선택은 회색.

---

## 프로젝트별 탭 콘텐츠

### [crawler-pipeline] 탭

| 섹션 | 데이터 소스 | 표시 내용 |
|------|-----------|---------|
| 현재 설정값 | config 시트 (또는 COLLECT_LIMIT_TEST_TASK.md) | MAX_COLLECT_PER_SESSION / MAX_COLLECT_PER_DAY / MAX_DAILY_REGISTER |
| 오늘 실행 현황 | pipeline-ops/REPORT.md | 수집 건수 / 등록 건수 / 성공률 |
| 500개 달성률 | judy-ops/PROJECT_CONTEXT.md | (LIVE + REGISTERED) / 500 진행바 |
| 최근 태스크 | projects/agents/*.md 중 pipeline-ops 관련 | 파일 링크 목록 |

### [judy-ops] 탭

| 섹션 | 데이터 소스 | 표시 내용 |
|------|-----------|---------|
| 목표 진행률 | judy-ops/PROJECT_CONTEXT.md | 1차(500개) / 2차(월 500만원) 달성률 |
| 오늘 작업 | general-executor/REPORT.md | 오늘 완료 작업 요약 |
| 최근 태스크 파일 | projects/agents/*.md | 파일 링크 + 상태(완료/진행중) |

### [personal-brand] 탭  ← 가장 중요

| 섹션 | 데이터 소스 | 표시 내용 |
|------|-----------|---------|
| **콘텐츠 씨앗** | `projects/personal-brand/content_seeds.md` | 미가공 씨앗 목록 (S번호 / 제목 / 필러 / 각도) |
| **오늘 발행** | TWITTER_OPS.md 또는 별도 로그 | 오늘 발행된 트윗 내용 + 링크 |
| 마일스톤 | project_context.md | M0~M4 단계별 달성 여부 |
| 시장조사 | research/최신파일.md | 최신 조사 날짜 + 링크 |

---

## 데이터 API 설계

파일을 직접 읽는 API 라우트 추가. 기존 패턴 참고 (`/api/system/monitor` 등).

### `/api/projects/personal-brand/seeds`

```
GET /api/projects/personal-brand/seeds

응답:
{
  "seeds": [
    {
      "id": "S001",
      "title": "측정 vs 분석",
      "pillar": ["P1", "P5"],
      "angle": "AI 에이전트에게 '측정해줘'라고 했을 때 생긴 일",
      "status": "미가공",
      "date": "2026-04-17"
    },
    ...
  ],
  "total": 6,
  "unprocessed": 6
}
```

파일 경로 (judy 머신 기준): `/Users/judy/.openclaw/workspace/projects/personal-brand/content_seeds.md`

### `/api/projects/status`

```
GET /api/projects/status

응답:
{
  "crawler-pipeline": {
    "active_products": 56,
    "target": 500,
    "progress_pct": 11.2
  },
  "personal-brand": {
    "milestone": "M0",
    "seeds_unprocessed": 6
  }
}
```

---

## 구현 참고 — 기존 Mission 탭 코드

Mission 탭은 `mission-control/src/app/mission/page.tsx` (또는 유사 경로)에 구현되어 있음.
사이드바 등록은 nav 컴포넌트에서 확인 후 동일 패턴으로 추가.

---

## 구현 순서

1. `MISSION_BOARD_FORK_TASK.md` 완료 확인 (submodule pull)
2. 기존 Mission 탭 코드 구조 파악
3. 사이드바에 Projects 항목 추가
4. `/app/projects/page.tsx` 생성 — 탭 컴포넌트
5. API 라우트 2개 구현 (`/api/projects/personal-brand/seeds`, `/api/projects/status`)
6. 각 탭 콘텐츠 컴포넌트 구현 (personal-brand 탭 최우선)
7. commit + push → judy에게 pull + 확인 요청

---

## judy에게 전달할 pull 지침 (구현 완료 후)

Windows에서 코드 push 완료 후 judy가 아래를 실행:

```bash
cd /Users/judy/workspace/mission-control
git pull origin main
# 미션보드는 next dev --turbo -H 0.0.0.0으로 실행 중이므로 HMR 자동 반영
# 단, 새 API 라우트 추가 시 서버 재시작 필요:
# pm2 restart mission-control  또는  next dev 프로세스 재시작
```

---

## 완료 기준

- [x] Projects 탭이 사이드바에 표시됨 (Dock.tsx에 Layers 아이콘으로 Mission 아래 추가)
- [x] 세 프로젝트 탭 전환 동작 (crawler-pipeline / judy-ops / personal-brand)
- [x] personal-brand 탭에서 content_seeds.md 씨앗 목록 표시 (`/api/projects/personal-brand/seeds`)
- [x] 탭 전환이 종이 탭 스타일로 렌더링됨 (선택 탭: 흰 배경 + 아래 테두리 없음)
- [x] 텔레그램 아가씨 보고: 미션보드 스크린샷 + URL (2026-04-19 04:04)

## 구현 완료 내역 (2026-04-17)

- `mission-control/src/components/TenacitOS/Dock.tsx` — Projects 항목 추가 (Layers 아이콘)
- `mission-control/src/app/(dashboard)/projects/page.tsx` — 메인 페이지 (3탭 종이탭 UI)
- `mission-control/src/app/api/projects/personal-brand/seeds/route.ts` — 씨앗 파싱 API
- `mission-control/src/app/api/projects/status/route.ts` — 프로젝트 상태 API
- gracejudy/mission-control push: 092d542
- judy-brain submodule 포인터 업데이트: 7884fbf

**judy 확인 필요:**
```bash
cd /Users/judy/workspace/mission-control
git pull origin main
# 새 API 라우트 추가됨 → next dev 서버 재시작 필요
pm2 restart mission-control  # 또는 프로세스 직접 재시작
```
