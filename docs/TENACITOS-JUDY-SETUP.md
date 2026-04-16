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

## 3. 알려진 버그 및 해결책

> 상세 내용은 [`../../docs/TROUBLESHOOTING.md`](../../docs/TROUBLESHOOTING.md) 참조

| 항목 | 요약 |
|------|------|
| openclaw.json 구조 차이 | `agent.name` / `agent.workspace` undefined → `identity.name` / `defaults.workspace` 패치 |
| Cron Jobs API CLI 실패 | Next.js 샌드박스에서 CLI 신뢰 불가 → GET은 파일 직접 읽기로 교체 |
| Office 3D SSR 오류 | `ssr: false`는 Server Component 불가 → `Office3DClient.tsx` 분리 |
| Mac 비호환 경고 | `df -BG`, `/proc/net/dev` Linux 전용 → 동작에는 무영향 |

---

## 4. Gateway 연동 확인

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

## 5. 재설치 체크리스트

- [ ] `.env.local` 생성 (위 2번 참고)
- [ ] `OPENCLAW_GATEWAY_URL` 실제 포트로 설정 (기본 18789 아님)
- [ ] `src/app/office/Office3DClient.tsx` 파일 존재 확인 (업스트림에 없을 수 있음)
- [ ] `src/app/api/agents/route.ts` — `identity.name` / `defaultWorkspace` 패치 적용
- [ ] `src/app/api/office/route.ts` — 동일 패치 + `OPENCLAW_GATEWAY_URL` env 사용
- [ ] `src/app/api/cron/route.ts` — GET은 파일 직접 읽기로 교체
- [ ] `.next` 캐시 문제 시: `rm -rf .next && npm run dev`
