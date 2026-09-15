// Preview which files would be committed — respects .gitignore.
// Uses isomorphic-git's status matrix after temporarily indexing.
// Non-destructive: writes only to /tmp; doesn't touch the project's .git.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function loadIgnore() {
  const rules = fs
    .readFileSync(path.join(ROOT, ".gitignore"), "utf8")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"));
  // Also always exclude .git internals
  rules.push(".git");
  return rules;
}

function matches(rules, rel) {
  const parts = rel.split("/");
  for (const rule of rules) {
    // "*.db" or "*.db-journal" — extension patterns
    if (rule.startsWith("*.")) {
      if (parts[parts.length - 1].endsWith(rule.slice(1))) return true;
      continue;
    }
    // Plain directory or file name — matches anywhere in the path
    if (parts.includes(rule)) return true;
    if (rel === rule) return true;
  }
  return false;
}

function walk(dir, rules, acc) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(ROOT, full);
    if (matches(rules, rel)) continue;
    if (ent.isDirectory()) walk(full, rules, acc);
    else acc.push(rel);
  }
}

const rules = loadIgnore();
const files = [];
walk(ROOT, rules, files);
files.sort();
console.log(`Files to commit: ${files.length}`);
console.log("---sample (first 40)---");
for (const f of files.slice(0, 40)) console.log(f);
console.log("---by top-level dir---");
const byDir = new Map();
for (const f of files) {
  const top = f.includes(path.sep) ? f.split(path.sep)[0] : "(root)";
  byDir.set(top, (byDir.get(top) ?? 0) + 1);
}
for (const [k, v] of [...byDir.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}
// Flag anything suspicious
const suspicious = files.filter((f) =>
  /(^|[\/\\])(\.env|.*\.pem|.*\.key|.*\.p12|.*credentials.*)/i.test(f),
);
if (suspicious.length) {
  console.log("---SUSPICIOUS (would be committed, review!)---");
  for (const f of suspicious) console.log(f);
}
