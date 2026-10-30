#!/bin/bash
# Claude Code PreToolUse hook for Bash: refuses commands that are hard to undo,
# whatever the permission mode. Exit code 2 blocks the command and tells the
# agent why; it can then ask the human to do it, if it really is needed.
command=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input?.command??"")}catch{console.log("")}})')

block() {
  echo "Blocked by .claude/settings.json hook: $1" >&2
  echo "If this is really needed, explain why and let a human run it." >&2
  exit 2
}

case "$command" in
  *"git push"*"--force"*|*"git push"*" -f"*) block "force-pushing rewrites shared history." ;;
  *"--no-verify"*) block "skipping Git hooks hides failing checks." ;;
  *"supabase db reset"*"--linked"*) block "this would erase the linked (remote) database." ;;
  *"supabase db push"*) block "migrations reach shared databases through CI, not from an agent session." ;;
esac
# A path to an environment file (.env, .env.local...), but not .env.example
# (removed before the test) and not "process.env" in a script.
others="${command//.env.example/}"
if [[ "$others" =~ (^|[[:space:]/\"\'=])\.env(\.[A-Za-z]+)?([[:space:]\"\']|$) ]]; then
  block "environment files contain secrets."
fi
exit 0
