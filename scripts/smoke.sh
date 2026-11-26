#!/usr/bin/env bash
# Smoke test for the running Compose stack: the page, one calculation and one
# error through nginx, then the JSON 503 with the calculator stopped.
# Run from the repo root after `docker compose up -d --build --wait`.
set -euo pipefail

base="${BASE_URL:-http://localhost:8080}"
failures=0

check() { # name, expected, actual
  if [[ "$2" == "$3" ]]; then
    echo "ok   $1"
  else
    echo "FAIL $1: want $2, got $3"
    failures=$((failures + 1))
  fi
}

calculate() { # JSON body -> "body status", newlines removed
  curl -s -w ' %{http_code}' -X POST "$base/api/v1/calculate" \
    -H 'Content-Type: application/json' -d "$1" | tr -d '\n'
}

check "page" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$base/")"
check "add" '{"result":"0.3","exact":true} 200' \
  "$(calculate '{"operation":"add","operands":["0.1","0.2"]}')"
check "backend error passes through" \
  '{"error":{"code":"DIVISION_BY_ZERO","message":"Cannot divide by zero."}} 422' \
  "$(calculate '{"operation":"divide","operands":["1","0"]}')"

docker compose stop calculator >/dev/null 2>&1
trap 'docker compose start calculator >/dev/null 2>&1' EXIT
down="$(calculate '{"operation":"add","operands":["1","2"]}')"
check "calculator stopped: JSON 503" "503" "${down##* }"
check "calculator stopped: SERVICE_UNAVAILABLE" "yes" \
  "$([[ "$down" == *'"code":"SERVICE_UNAVAILABLE"'* ]] && echo yes || echo no)"

if ((failures > 0)); then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
