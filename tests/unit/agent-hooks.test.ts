// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The hooks receive the tool call as JSON on stdin, as Claude Code sends it.
function runHook(script: string, toolInput: Record<string, string>, projectDir = process.cwd()) {
  const result = spawnSync("bash", [join(process.cwd(), "scripts", script)], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: toolInput }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: "utf8",
  });
  return { code: result.status, stderr: result.stderr };
}

describe("PreToolUse guard for Bash", () => {
  it.each([
    "git push --force origin main",
    "git commit --no-verify -m wip",
    "npx supabase db reset --linked",
    "npx supabase db push",
    "cat .env.local",
    "cp .env.example .env.local",
  ])("blocks %s with exit code 2 and a reason", (command) => {
    const { code, stderr } = runHook("agent-guard-bash.sh", { command });
    expect(code).toBe(2);
    expect(stderr).toMatch(/^Blocked by .claude\/settings.json hook: /);
  });

  it.each(["npm run test", "git status", "grep KEY .env.example", "node -e 'console.log(process.env.HOME)'"])(
    "lets %s through",
    (command) => {
      expect(runHook("agent-guard-bash.sh", { command }).code).toBe(0);
    },
  );
});

describe("PostToolUse check of written files", () => {
  // A throwaway project with only what the script reads.
  const project = mkdtempSync(join(tmpdir(), "farmcrate-hook-"));
  mkdirSync(join(project, "supabase", "migrations"), { recursive: true });
  const migration = (name: string, sql: string) => {
    const path = join(project, "supabase", "migrations", name);
    writeFileSync(path, sql);
    return path;
  };

  it("refuses a migration that creates a table without Row Level Security", () => {
    const file = migration("1_bad.sql", "create table public.labels (id uuid primary key);\n");
    const { code, stderr } = runHook("agent-check-file.sh", { file_path: file }, project);
    expect(code).toBe(2);
    expect(stderr).toContain("creates public.labels without enabling Row Level Security");
  });

  it("accepts a migration that enables Row Level Security on each new table", () => {
    const file = migration(
      "2_good.sql",
      "create table public.labels (id uuid primary key);\nalter table public.labels enable row level security;\n",
    );
    expect(runHook("agent-check-file.sh", { file_path: file }, project).code).toBe(0);
  });

  it("ignores files it does not know and missing input", () => {
    expect(runHook("agent-check-file.sh", { file_path: join(project, "README.md") }, project).code).toBe(0);
    expect(runHook("agent-check-file.sh", {}, project).code).toBe(0);
  });
});
