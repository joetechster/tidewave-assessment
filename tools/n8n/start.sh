#!/bin/sh
# First start only: let n8n create its database and owner, then import the starter credentials and workflows.
MARK=/home/node/.n8n/.tidewave_imported
if [ ! -f "$MARK" ]; then
  n8n start &
  PID=$!
  i=0
  until wget -q -O /dev/null http://127.0.0.1:5678/healthz 2>/dev/null; do i=$((i+1)); [ $i -gt 120 ] && break; sleep 2; done
  sleep 3
  kill $PID; wait $PID 2>/dev/null
  n8n import:credentials --input=/tidewave/credentials.json || exit 1
  n8n import:workflow --separate --input=/tidewave-workflows || exit 1
  for id in wf_street_team_lead wf_solace_events wf_staff_test_run; do n8n publish:workflow --id=$id || echo "publish failed for $id"; done
  touch "$MARK"
fi
exec n8n start
