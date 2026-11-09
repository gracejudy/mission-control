#!/bin/bash
# com.mission-control.stop (매일 20:00)가 실행.
LOG="/Users/judy/dev/judy-brain/mission-control/logs/schedule.log"
LABEL="com.mission-control.dev"
DOMAIN="gui/$(id -u)"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [stop] $1" >> "$LOG"; }

if ! launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
  log "already not loaded — no-op"
  exit 0
fi

if launchctl bootout "$DOMAIN/$LABEL" 2>>"$LOG"; then
  log "bootout OK — mission-control stopped"
else
  log "bootout FAILED — see stderr above in this same log"
fi
