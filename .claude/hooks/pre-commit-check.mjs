// Claude Code の PreToolUse フック（.claude/settings.json から呼ばれる）。
// Claude Code が Bash / PowerShell で `git commit` を実行する直前に scripts/check-consistency.mjs を走らせ、
// 問題があればコミットをブロックする（終了コード2＋stderrの内容がClaudeに返る）。
// git commit 以外のコマンドでは何もしない。
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let input = '';
for await (const chunk of process.stdin) input += chunk;

let command = '';
try { command = JSON.parse(input)?.tool_input?.command || ''; } catch { process.exit(0); }
if (!/\bgit\s+commit\b/.test(command)) process.exit(0);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'check-consistency.mjs')], { cwd: root, encoding: 'utf8' });
if (r.status === 0) process.exit(0);

process.stderr.write(
  'コミット前の整合性チェック（scripts/check-consistency.mjs）で問題が見つかったため、コミットを止めました。修正してから再度コミットしてください。\n' +
  (r.stdout || '') + (r.stderr || '')
);
process.exit(2);
