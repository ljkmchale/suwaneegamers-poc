// Starts Next from .next-prod so production and dev never share .next.
// Extra args are passed through, e.g. npm run start:prod -- -p 3001
const { spawnSync } = require("child_process");
const path = require("path");

const contentDir = path.resolve(__dirname, "../../../content");

const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", ...process.argv.slice(2).filter((arg) => arg !== "--")],
  {
    stdio: "inherit",
    env: { ...process.env, NEXT_DIST_DIR: ".next-prod", SUWANEE_CONTENT_DIR: contentDir },
    shell: false,
  },
);

process.exit(result.status ?? 1);
