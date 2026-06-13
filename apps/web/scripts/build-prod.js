// Builds to .next-prod so the production service and dev server never share
// the same output directory. Run via: npm run build:prod
const { execSync } = require("child_process");
const path = require("path");

const contentDir = path.resolve(__dirname, "../../../content");

execSync("node node_modules/next/dist/bin/next build --webpack", {
  stdio: "inherit",
  env: { ...process.env, NEXT_DIST_DIR: ".next-prod", SUWANEE_CONTENT_DIR: contentDir },
});
