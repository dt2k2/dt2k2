import { mkdir, writeFile } from "node:fs/promises";
import { extname } from "node:path";

const token = process.env.GITHUB_TOKEN;
const contributor = process.env.CONTRIBUTOR || "dt2k2";
const outputPath = "profile/external-contributions.svg";

const targets = [
  {
    repository: "Tquoc1/Inkit_DuQuang_V1",
    title: "INKIT - 2D Psychological Horror Game",
    role: "Side Developer",
    stack: "Unity / C#",
  },
];

if (!token) throw new Error("GITHUB_TOKEN is required");

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "dt2k2-profile-contribution-card",
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} for ${path}: ${body}`);
  }
  return response.json();
}

async function getAll(path) {
  const separator = path.includes("?") ? "&" : "?";
  const items = [];
  for (let page = 1; page <= 10; page += 1) {
    const data = await github(`${path}${separator}per_page=100&page=${page}`);
    if (!Array.isArray(data)) throw new Error(`Expected an array from ${path}`);
    items.push(...data);
    if (data.length < 100) break;
  }
  return items;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function fileType(filename) {
  const lower = filename.toLowerCase();
  const ext = extname(lower);
  const types = {
    ".cs": "C#",
    ".java": "Java",
    ".py": "Python",
    ".js": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".jsx": "JavaScript",
    ".cpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".hpp": "C++",
    ".c": "C",
    ".h": "C/C++ Header",
    ".sql": "SQL",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".md": "Documentation",
    ".unity": "Unity Scene",
    ".prefab": "Unity Prefab",
    ".asset": "Unity Asset",
    ".meta": "Unity Metadata",
    ".json": "JSON",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".xml": "XML",
    ".sh": "Shell",
  };
  return types[ext] || (lower.endsWith("dockerfile") ? "Dockerfile" : "Other");
}

async function collectTarget(target) {
  const repo = await github(`/repos/${target.repository}`);
  const query = encodeURIComponent(
    `repo:${target.repository} type:pr author:${contributor} is:merged`,
  );
  const search = await github(`/search/issues?q=${query}&per_page=100`);
  const mergedPrs = search.items || [];

  const commitMap = new Map();
  const directCommits = await getAll(
    `/repos/${target.repository}/commits?sha=${encodeURIComponent(repo.default_branch)}&author=${encodeURIComponent(contributor)}`,
  );
  for (const commit of directCommits) commitMap.set(commit.sha, commit);

  for (const pr of mergedPrs) {
    const commits = await getAll(
      `/repos/${target.repository}/pulls/${pr.number}/commits`,
    );
    for (const commit of commits) {
      const logins = [commit.author?.login, commit.committer?.login]
        .filter(Boolean)
        .map((login) => login.toLowerCase());
      if (logins.includes(contributor.toLowerCase())) {
        commitMap.set(commit.sha, commit);
      }
    }
  }

  const typeTotals = new Map();
  const files = new Set();
  let additions = 0;
  let deletions = 0;

  for (const sha of commitMap.keys()) {
    const detail = await github(`/repos/${target.repository}/commits/${sha}`);
    for (const file of detail.files || []) {
      files.add(file.filename);
      additions += file.additions || 0;
      deletions += file.deletions || 0;
      const type = fileType(file.filename);
      const changedLines = (file.additions || 0) + (file.deletions || 0);
      typeTotals.set(type, (typeTotals.get(type) || 0) + changedLines);
    }
  }

  const topTypes = [...typeTotals.entries()]
    .filter(([, lines]) => lines > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return {
    ...target,
    defaultBranch: repo.default_branch,
    mergedPrs: mergedPrs.length,
    commits: commitMap.size,
    files: files.size,
    additions,
    deletions,
    topTypes,
  };
}

function renderCard(results) {
  const width = 820;
  const blockHeight = 184;
  const height = 92 + results.length * blockHeight + 44;
  const updated = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  const blocks = results
    .map((result, index) => {
      const y = 82 + index * blockHeight;
      const typeText = result.topTypes.length
        ? result.topTypes.map(([name, lines]) => `${name}: ${lines}`).join("  •  ")
        : "No attributed file changes found";
      return `
        <g transform="translate(28 ${y})">
          <rect width="764" height="160" rx="10" fill="#151b2b" stroke="#2f81f7" stroke-opacity="0.55"/>
          <text x="22" y="31" class="repo">${escapeXml(result.title)}</text>
          <text x="22" y="53" class="muted">${escapeXml(result.repository)}  •  Role: ${escapeXml(result.role)}  •  Stack: ${escapeXml(result.stack)}</text>
          <g transform="translate(22 76)">
            <text x="0" y="0" class="label">Merged PRs</text>
            <text x="118" y="0" class="value">${result.mergedPrs}</text>
            <text x="190" y="0" class="label">Attributed commits</text>
            <text x="342" y="0" class="value">${result.commits}</text>
            <text x="420" y="0" class="label">Files changed</text>
            <text x="530" y="0" class="value">${result.files}</text>
          </g>
          <g transform="translate(22 106)">
            <text x="0" y="0" class="label">Line changes</text>
            <text x="118" y="0" class="added">+${result.additions}</text>
            <text x="176" y="0" class="deleted">-${result.deletions}</text>
            <text x="260" y="0" class="muted">on ${escapeXml(result.defaultBranch)}</text>
          </g>
          <text x="22" y="137" class="types">Changed file types: ${escapeXml(typeText)}</text>
        </g>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="External GitHub contributions by ${escapeXml(contributor)}">
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
      .title { fill: #70a5fd; font-size: 22px; font-weight: 700; }
      .repo { fill: #f0f6fc; font-size: 17px; font-weight: 700; }
      .label { fill: #a5b4cf; font-size: 13px; }
      .value { fill: #38bdae; font-size: 15px; font-weight: 700; }
      .muted { fill: #8b98b5; font-size: 12px; }
      .types { fill: #c8d1e3; font-size: 12px; }
      .added { fill: #3fb950; font-size: 14px; font-weight: 700; }
      .deleted { fill: #f85149; font-size: 14px; font-weight: 700; }
      .footer { fill: #7d89a4; font-size: 11px; }
    </style>
    <rect width="100%" height="100%" rx="12" fill="#0d1117" stroke="#30363d"/>
    <text x="28" y="42" class="title">External Contributions</text>
    <text x="28" y="64" class="muted">Verified from merged pull requests and attributed commits on default branches</text>
    ${blocks}
    <text x="28" y="${height - 20}" class="footer">Contributor: ${escapeXml(contributor)}  •  Updated automatically: ${escapeXml(updated)} (Vietnam time)</text>
  </svg>`;
}

const results = [];
for (const target of targets) results.push(await collectTarget(target));
await mkdir("profile", { recursive: true });
await writeFile(outputPath, renderCard(results), "utf8");
console.log(JSON.stringify(results, null, 2));
