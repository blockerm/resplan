// One-shot: init repo (or reuse existing), stage tracked files honoring
// .gitignore, commit, add remote, push to GitHub over HTTPS using a token
// passed via GITHUB_TOKEN env var.

import fs from "node:fs";
import path from "node:path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

const ROOT = process.cwd();
const TOKEN = process.env.GITHUB_TOKEN;
const REMOTE_URL = process.env.REMOTE_URL || "https://github.com/blockerm/resplan.git";
const BRANCH = process.env.BRANCH || "main";
const COMMIT_MSG =
  process.env.COMMIT_MSG || "Initial commit: resource-loader tool";
const AUTHOR = {
  name: "blockerm",
  email: "blockerm@users.noreply.github.com",
};

if (!TOKEN) {
  console.error("GITHUB_TOKEN env var required");
  process.exit(1);
}

function loadIgnore() {
  const rules = fs
    .readFileSync(path.join(ROOT, ".gitignore"), "utf8")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"));
  rules.push(".git");
  return rules;
}
function matches(rules, rel) {
  const parts = rel.split("/");
  for (const rule of rules) {
    if (rule.startsWith("*.")) {
      if (parts[parts.length - 1].endsWith(rule.slice(1))) return true;
      continue;
    }
    if (parts.includes(rule)) return true;
    if (rel === rule) return true;
  }
  return false;
}
function walk(dir, rules, acc) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    if (matches(rules, rel)) continue;
    if (ent.isDirectory()) walk(full, rules, acc);
    else acc.push(rel);
  }
}

async function ensureRepo() {
  const gitDir = path.join(ROOT, ".git");
  if (!fs.existsSync(gitDir)) {
    await git.init({ fs, dir: ROOT, defaultBranch: BRANCH });
    console.log("Initialized empty repo");
  } else {
    console.log("Repo already exists — reusing");
  }
}

async function main() {
  await ensureRepo();

  const rules = loadIgnore();
  const files = [];
  walk(ROOT, rules, files);
  console.log(`Staging ${files.length} files…`);
  for (const f of files) {
    await git.add({ fs, dir: ROOT, filepath: f });
  }

  const sha = await git.commit({
    fs,
    dir: ROOT,
    author: AUTHOR,
    committer: AUTHOR,
    message: COMMIT_MSG,
  });
  console.log(`Commit: ${sha}`);

  // Ensure remote is set
  const remotes = await git.listRemotes({ fs, dir: ROOT });
  if (!remotes.find((r) => r.remote === "origin")) {
    await git.addRemote({ fs, dir: ROOT, remote: "origin", url: REMOTE_URL });
    console.log(`Added remote origin -> ${REMOTE_URL}`);
  }

  // Ensure current branch is BRANCH
  const currentBranch = await git.currentBranch({ fs, dir: ROOT, fullname: false });
  if (currentBranch !== BRANCH) {
    await git.branch({ fs, dir: ROOT, ref: BRANCH, checkout: true });
    console.log(`Checked out branch ${BRANCH}`);
  }

  console.log(`Pushing to ${REMOTE_URL} (${BRANCH})…`);
  const result = await git.push({
    fs,
    http,
    dir: ROOT,
    remote: "origin",
    ref: BRANCH,
    onAuth: () => ({ username: "x-access-token", password: TOKEN }),
  });
  console.log("Push result:", JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error("Push failed:", e?.message || e);
  process.exit(1);
});
