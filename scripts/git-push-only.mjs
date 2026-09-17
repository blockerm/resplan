// Push already-committed HEAD to origin/main via isomorphic-git.
import fs from "node:fs";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

const ROOT = process.cwd();
const TOKEN = process.env.GITHUB_TOKEN;
const BRANCH = "main";

if (!TOKEN) { console.error("GITHUB_TOKEN required"); process.exit(1); }

const head = await git.resolveRef({ fs, dir: ROOT, ref: "HEAD" });
console.log(`Local HEAD: ${head}`);

console.log(`Pushing to origin/${BRANCH}…`);
const r = await git.push({
  fs,
  http,
  dir: ROOT,
  remote: "origin",
  ref: BRANCH,
  onAuth: () => ({ username: "x-access-token", password: TOKEN }),
});
console.log("Push result:", JSON.stringify(r, null, 2));
