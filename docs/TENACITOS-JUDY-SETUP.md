# Judy 환경 Mission Control 설치 가이드

> 최초 설치일: 2026-04-15  
> 환경: Mac mini (darwin), OpenClaw @ `/Users/judy/.openclaw`  
> 대시보드: [carlosazaustre/tenacitOS](https://github.com/carlosazaustre/tenacitOS) (mission-control)  
> Next.js 16.1.6 + Turbopack

---

## 1. 설치 순서

```bash
# 1. 레포 클론
git clone https://github.com/carlosazaustre/tenacitOS \
  ~/.openclaw/workspace/mission-control
cd ~/.openclaw/workspace/mission-control

# 2. 의존성 설치
npm install

# 3. 환경변수 설정 (아래 섹션 참고)
cp .env.example .env.local  # 없으면 직접 생성

# 4. 개발 서버 실행
npm run dev -- -H 0.0.0.0
```

---

## 2. .env.local 필수 설정

```env
# 인증 (필수)
ADMIN_PASSWORD=<원하는 비밀번호>
AUTH_SECRET=<랜덤 base64 문자열>  # openssl rand -base64 32

# OpenClaw 경로 (Mac 기본값과 다름 — 반드시 명시)
OPENCLAW_DIR=/Users/judy/.openclaw

# Gateway 포트 (기본값 18789가 아닌 실제 포트 확인 필수)
OPENCLAW_GATEWAY_URL=http://127.0.0.1:46265

# 브랜딩
NEXT_PUBLIC_AGENT_NAME=Judy
NEXT_PUBLIC_AGENT_EMOJI=🤖
NEXT_PUBLIC_AGENT_DESCRIPTION=Autonomous agent powered by OpenClaw
NEXT_PUBLIC_AGENT_LOCATION=Seoul, Korea
NEXT_PUBLIC_BIRTH_DATE=2025-11-01
NEXT_PUBLIC_OWNER_USERNAME=SYU
NEXT_PUBLIC_COMPANY_NAME=JUDY MISSION CONTROL
```

> **Gateway 포트 확인 방법:**  
> `cat ~/.openclaw/openclaw.json | grep port`  
> 또는 `lsof -i | grep openclaw`

---

## 3. Judy openclaw.json 구조 — 업스트림과 다른 점

업스트림 TenacitOS는 openclaw.json 에이전트 구조를 아래처럼 가정:

```json
{
  "agents": {
    "list": [
      { "id": "main", "name": "Main", "workspace": "/path/to/workspace" }
    ]
  }
}
```

**Judy 환경은 다르다:**

```json
{
  "agents": {
    "defaults": {
      "workspace": "/Users/judy/.openclaw/workspace",
      "model": { "primary": "claude-opus-4-5" }
    },
    "list": [
      {
        "id": "main",
        "identity": { "name": "Judy" },
        "workspace": null  ← 없거나 null (defaults에서 상속)
      }
    ]
  }
}
```

**이 차이로 발생한 버그:**
- `agent.name` → `undefined` (실제 위치: `agent.identity.name`)
- `agent.workspace` → `undefined` (실제 위치: `agents.defaults.workspace`)

**수정된 파일:** `src/app/api/agents/route.ts`, `src/app/api/office/route.ts`  
**핵심 패치:**
```typescript
const defaultWorkspace = config.agents.defaults?.workspace || "";
const agentName = agent.name || agent.identity?.name || agent.id;
const workspace = agent.workspace || defaultWorkspace;
```

---

## 4. Cron Jobs API — CLI 대신 파일 직접 읽기

**문제:** `execSync("openclaw cron list --json")` 가 Next.js Turbopack dev server 내부에서 exit code 1 (빈 stdout)으로 실패.  
터미널에서는 정상 동작하지만 Next.js 프로세스 샌드박스에서 CLI가 신뢰할 수 없음.

**해결:** GET은 파일 직접 읽기, PUT/DELETE는 CLI 유지 (env 명시)

```typescript
// src/app/api/cron/route.ts

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/Users/judy/.openclaw";
const EXEC_ENV = { ...process.env, HOME: "/Users/judy", PATH: "/usr/local/bin:/usr/bin:/bin" };

// GET: 파일 직접 읽기
export async function GET() {
  const raw = readFileSync(`${OPENCLAW_DIR}/cron/jobs.json`, "utf-8");
  const data = JSON.parse(raw);
  // ...
}

// PUT/DELETE: CLI 사용 시 반드시 env 명시
execSync(`openclaw cron enable ${id}`, { env: EXEC_ENV });
```

---

## 5. Office 3D 탭 — SSR 비활성화 필수

**문제:** Three.js / React-Three-Fiber는 WebGL(브라우저 전용 API)을 사용.  
`next/dynamic`의 `ssr: false` 는 **Server Component에서 사용 불가**.

**잘못된 패턴 (에러 발생):**
```tsx
// page.tsx — Server Component (metadata export 있음)
import dynamic from 'next/dynamic';
const Office3D = dynamic(() => import('...'), { ssr: false }); // ← 에러!
```

**올바른 패턴:**
```
src/app/office/
  page.tsx          ← Server Component (metadata만)
  Office3DClient.tsx ← 'use client' + dynamic ssr:false
```

```tsx
// Office3DClient.tsx
'use client';
import dynamic from 'next/dynamic';

const Office3D = dynamic(() => import('@/components/Office3D/Office3D'), {
  ssr: false,
  loading: () => <div>Loading 3D Office...</div>,
});

export default function Office3DClient() {
  return <Office3D />;
}
```

```tsx
// page.tsx
import Office3DClient from './Office3DClient';
export const metadata = { title: 'The Office 3D | Mission Control' };
export default function OfficePage() { return <Office3DClient />; }
```

---

## 6. Mac 환경 비호환 — 비치명적 경고

아래 에러들은 Linux 전용 코드 때문. 대시보드 동작에는 영향 없음.

| 에러 | 원인 | 위치 |
|------|------|------|
| `Cannot read properties of undefined (reading 'replace')` | `df -BG` 출력 포맷이 Mac/Linux 다름 | `src/app/api/system/stats/route.ts:32` |
| `ENOENT: /proc/net/dev` | Linux 전용 네트워크 통계 파일 | `src/app/api/system/monitor/route.ts` |

---

## 7. Gateway 연동 확인

```bash
# gateway 토큰 확인
cat ~/.openclaw/openclaw.json | grep -A3 '"auth"'

# gateway 세션 API 동작 확인
curl -s -H "Authorization: Bearer <token>" \
  http://127.0.0.1:46265/api/sessions | jq .
```

`/api/office` 는 gateway → 파일 순으로 fallback:
1. `GET /api/sessions` (gateway) — 5분 이내 활동 시 ACTIVE
2. `memory/YYYY-MM-DD.md` mtime — fallback

---

## 8. 재설치 체크리스트

- [ ] `.env.local` 생성 (위 2번 참고)
- [ ] `OPENCLAW_GATEWAY_URL` 실제 포트로 설정 (기본 18789 아님)
- [ ] `src/app/office/Office3DClient.tsx` 파일 존재 확인 (업스트림에 없을 수 있음)
- [ ] `src/app/api/agents/route.ts` — `identity.name` / `defaultWorkspace` 패치 적용
- [ ] `src/app/api/office/route.ts` — 동일 패치 + `OPENCLAW_GATEWAY_URL` env 사용
- [ ] `src/app/api/cron/route.ts` — GET은 파일 직접 읽기로 교체
- [ ] `.next` 캐시 문제 시: `rm -rf .next && npm run dev`
