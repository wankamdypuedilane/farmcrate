#!/bin/bash
# Claude Code PostToolUse hook: checks each file the agent has just written.
# Claude Code sends a JSON description of the tool call on stdin. Exit code 2
# sends our message (stderr) back to the agent, which then fixes the file;
# exit code 0 says nothing is wrong.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input?.file_path??"")}catch{console.log("")}})')
[ -n "$file" ] && [ -f "$file" ] || exit 0
rel="${file#"$PWD"/}"

case "$rel" in
  src/*.ts|src/*.tsx|tests/*.ts|tests/*.tsx)
    # Lint only the edited file: fast enough to run after every edit.
    if ! out=$(npx eslint --max-warnings=0 "$rel" 2>&1); then
      echo "ESLint found problems in $rel. Fix them before continuing:" >&2
      echo "$out" >&2
      exit 2
    fi
    ;;
  supabase/migrations/*.sql)
    # Project rule: every new table gets Row Level Security in the same migration.
    tables=$(grep -ioE "create table (if not exists )?[a-z_.]+" "$rel" | awk '{print $NF}')
    for table in $tables; do
      if ! grep -iqE "alter table (only )?$table enable row level security" "$rel"; then
        echo "Migration $rel creates $table without enabling Row Level Security." >&2
        echo "Add: alter table $table enable row level security; and explicit policies." >&2
        exit 2
      fi
    done
    ;;
esac
exit 0
