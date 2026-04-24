# 미션보드 Fork + Remote 설정
_Issued by 아가씨 | 2026-04-17_
_담당: judy (Mac mini에서 실행)_

> 이 작업은 judy가 Mac mini에서 수행한다.
> 완료 후 이 파일 하단 체크리스트 기입 + commit + push.

---

## 목적

현재 미션보드(`mission-control/`)는 judy 로컬에만 커밋이 쌓이고 있어 Windows에서 접근·편집이 불가능하다.
`gracejudy/mission-control` repo로 fork 후 remote를 교체하여 Windows ↔ judy 양방향 협업이 가능하게 한다.

---

## 사전 조건

- GitHub에서 `carlosazaustre/tenacitOS`를 `gracejudy` 계정으로 fork 완료 (아가씨가 GitHub UI에서 수동 실행)
- Fork된 repo 이름: `gracejudy/mission-control`

> **judy가 이 파일을 읽었을 시점에 fork가 완료됐는지 먼저 확인한다.**
> 확인 방법: `curl -s https://api.github.com/repos/gracejudy/mission-control | grep '"name"'`
> 응답에 `"name": "mission-control"` 있으면 진행. 없으면 아가씨에게 텔레그램 보고 후 대기.

---

## 실행 절차

### Step 1 — 현재 remote 확인

```bash
cd /Users/judy/workspace/mission-control
git remote -v
```

예상 출력: `origin  https://github.com/carlosazaustre/tenacitOS.git`

### Step 2 — Remote를 fork로 교체

```bash
git remote set-url origin https://github.com/gracejudy/mission-control.git
git remote -v  # 확인
```

### Step 3 — 로컬 커밋 전체 push

```bash
git push origin main --force-with-lease
```

> `--force-with-lease` 사용 이유: fork 직후 upstream과 히스토리가 달라 fast-forward가 안 될 수 있음.
> 이미 쌓인 로컬 커밋(Mission 탭, TopBar 수정 등)을 fork에 올리는 1회성 작업이므로 허용.

### Step 4 — judy-brain에 submodule로 등록

```bash
cd /Users/judy/.openclaw/workspace  # judy-brain 클론 위치
git submodule add https://github.com/gracejudy/mission-control.git mission-control
git add .gitmodules mission-control
git commit -m "feat: mission-control을 gracejudy fork submodule로 등록"
git push
```

> 기존 `mission-control/` 빈 디렉토리가 있으면 먼저 `git rm -r --cached mission-control` 후 진행.

---

## 완료 체크리스트

- [x] gracejudy/mission-control fork 확인
- [x] git remote set-url 완료
- [x] git push origin main 완료 (커밋 수: 5개, b021506..f2103c9)
- [x] judy-brain submodule 등록 완료 (395c889)
- [x] 텔레그램 아가씨 보고: "mission-control fork 설정 완료. URL: https://github.com/gracejudy/mission-control"
