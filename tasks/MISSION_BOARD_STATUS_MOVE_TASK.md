# Mission 탭 현황 섹션 → Projects 탭 이동
_Issued by 아가씨 | 2026-04-18_
_담당: general-executor_

> Mission 탭에서 프로젝트별 현황 섹션을 분리해 각 Projects 탭으로 이동. Mission 탭은 Freedom/에이전트 전체 뷰만 유지.

---

## 목적

현재 Mission 탭이 MISSION-CONTROL.md 전체를 렌더링해 에이전트 현황·KPI·이슈까지 모두 포함됨.
Mission은 "대시보드" 의미이므로, 프로젝트별 운영 현황(pipeline-ops 현황, general-executor 현황)은
Projects 탭 각 프로젝트 섹션으로 이동한다.

---

## 실행 지침

### Step 1 — 새 API 엔드포인트 생성

파일: `mission-control/src/app/api/mission/sections/route.ts` (신규)

MISSION-CONTROL.md를 읽어 섹션별 마크다운 문자열을 반환한다.

반환 JSON 구조:
```json
{
  "pipeline-ops": "## pipeline-ops 현황\n...(다음 ## 직전까지)",
  "general-executor-kpi": "### KPI\n...",
  "judyops-status": "### judy-ops 현황 (YYYY-MM-DD 기준)\n...",
  "personal-brand-milestone": "### personal-brand 마일스톤\n...\n#### M0 세부 항목\n..."
}
```

파싱 방법: `/api/mission/freedom/route.ts`의 섹션 추출 정규식 패턴 참고.
- `## pipeline-ops 현황` → 다음 `\n---` 또는 `\n##` 직전까지
- `## general-executor 현황` 내 하위 `###` 단위로 분리

### Step 2 — Mission 페이지 strip 로직 확장

파일: `mission-control/src/app/(dashboard)/mission/page.tsx`

현재 `stripFreedomSection()` 아래에 `stripProjectSections()` 함수 추가:
```typescript
function stripProjectSections(md: string): string {
  return md
    .replace(/## pipeline-ops 현황[\s\S]*?(?=\n---|\n## )/m, "")
    .replace(/## general-executor 현황[\s\S]*?(?=\n---|\n## )/m, "");
}
```

`strippedContent` 생성 시 두 함수 모두 적용:
```typescript
const strippedContent = content
  ? stripProjectSections(stripFreedomSection(content))
  : "";
```

### Step 3 — Projects 페이지에 섹션 렌더링 추가

파일: `mission-control/src/app/(dashboard)/projects/page.tsx`

1. `ReactMarkdown`, `remarkGfm` import 추가
2. `useEffect`에 `/api/mission/sections` 페치 추가 (fetchStatus와 병렬)
3. state: `sectionsData: Record<string, string> | null`
4. 각 탭 컴포넌트에 마크다운 섹션 렌더링 추가:

| 탭 | 렌더링할 섹션 키 |
|---|---|
| crawler-pipeline | `pipeline-ops` |
| judy-ops | `general-executor-kpi` + `judyops-status` |
| personal-brand | `personal-brand-milestone` |

렌더링 위치: 기존 stat 카드 아래, `<ReactMarkdown remarkPlugins={[remarkGfm]}>` 사용.

CSS: mission 페이지의 `.mission-markdown` 스타일 블록을 projects 페이지 `<style>` 태그에도 추가.
클래스명 충돌 없음 (같은 이름 사용 가능).

---

## 완료 기준

- [ ] `/api/mission/sections` 엔드포인트 응답 확인 (JSON 4개 키 반환)
- [ ] Mission 탭에서 `pipeline-ops 현황`, `general-executor 현황` 섹션 미노출 확인
- [ ] Projects > crawler-pipeline 탭에 pipeline-ops 현황 마크다운 렌더링 확인
- [ ] Projects > judy-ops 탭에 KPI + 상품 현황 테이블 렌더링 확인
- [ ] Projects > personal-brand 탭에 마일스톤 + M0 세부 항목 렌더링 확인
- [ ] 텔레그램 아가씨 보고

---
<!-- 아래는 judy가 작성 — 수정 금지 -->
## 실행 결과

**상태:** `대기`
**실행 일시:**
**담당 에이전트:**
**결과 요약:**
**이슈/특이사항:**
