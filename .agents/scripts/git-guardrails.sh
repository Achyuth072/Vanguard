#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.toolCall.args.CommandLine // empty')

if [[ -z "$CMD" ]]; then
  echo '{"decision": "allow"}'
  exit 0
fi

# Hard-blocked dangerous git commands
BLOCKED_PATTERNS=(
  "git\s+push\s+.*(-f|--force)"
  "git\s+reset\s+--hard"
  "git\s+clean\s+.*-f"
  "git\s+branch\s+.*(-D|--delete\s+--force)"
  "git\s+restore\s+\."
  "git\s+checkout\s+\."
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$CMD" | grep -iE "$pattern" > /dev/null; then
    echo "{\"decision\": \"deny\", \"reason\": \"Git guardrail blocked dangerous command: '$CMD'\"}"
    exit 0
  fi
done

# Guarded commands requiring explicit user prompt
PROMPT_PATTERNS=(
  "git\s+push"
  "git\s+rebase"
  "git\s+merge"
)

for pattern in "${PROMPT_PATTERNS[@]}"; do
  if echo "$CMD" | grep -iE "$pattern" > /dev/null; then
    echo "{\"decision\": \"force_ask\", \"reason\": \"Git command requires explicit user confirmation: '$CMD'\"}"
    exit 0
  fi
done

echo '{"decision": "allow"}'
