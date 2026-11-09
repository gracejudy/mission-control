#!/bin/bash
# com.mission-control.schedule-sync (RunAtLoad만, 로그인/재부팅 1회)가 실행.
LOG="/Users/judy/dev/judy-brain/mission-control/logs/schedule.log"
LABEL="com.mission-control.dev"
PLIST="/Users/judy/Library/LaunchAgents/com.mission-control.dev.plist"
DOMAIN="gui/$(id -u)"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [sync] $1" >> "$LOG"; }

# com.mission-control.dev 자신의 RunAtLoad가 같은 로그인 스캔에서 발동할 시간을 준다
# (경쟁 조건 방지 — 두 Job의 RunAtLoad 실행 순서는 보장되지 않음).
MAX_WAIT=20
WAITED=0
while ! launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; do
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    log "WARNING: ${LABEL} 가 ${MAX_WAIT}s 동안 로드되지 않음 — 미로드로 간주하고 진행"
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

HOUR=$((10#$(date '+%H')))
IS_LOADED=false
launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1 && IS_LOADED=true

if [ "$HOUR" -ge 9 ] && [ "$HOUR" -lt 20 ]; then SHOULD_RUN=true; else SHOULD_RUN=false; fi

if [ "$SHOULD_RUN" = true ] && [ "$IS_LOADED" = false ]; then
  launchctl bootstrap "$DOMAIN" "$PLIST" 2>>"$LOG"
  log "hour=$HOUR (09-20 범위) 인데 안 떠 있었음 -> bootstrap"
elif [ "$SHOULD_RUN" = false ] && [ "$IS_LOADED" = true ]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>>"$LOG"
  log "hour=$HOUR (09-20 범위 밖) 인데 떠 있었음(RunAtLoad가 올림) -> bootout"
else
  log "hour=$HOUR, loaded=$IS_LOADED -> 이미 올바른 상태, no-op"
fi
