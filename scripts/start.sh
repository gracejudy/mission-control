#!/bin/bash
# com.mission-control.start (매일 09:00)가 실행.
LOG="/Users/judy/dev/judy-brain/mission-control/logs/schedule.log"
LABEL="com.mission-control.dev"
PLIST="/Users/judy/Library/LaunchAgents/com.mission-control.dev.plist"
DOMAIN="gui/$(id -u)"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [start] $1" >> "$LOG"; }

if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
  log "already loaded — no-op"
  exit 0
fi

if launchctl bootstrap "$DOMAIN" "$PLIST" 2>>"$LOG"; then
  log "bootstrap OK — mission-control starting"
else
  log "bootstrap FAILED — see stderr above in this same log"
fi
