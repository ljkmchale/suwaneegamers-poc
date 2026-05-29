// Builds to .next-prod so the production service and dev server never share
// the same output directory. Run via: npm run build:prod
const { execSync } = require("child_process");

execSync("node node_modules/next/dist/bin/next build", {
  stdio: "inherit",
  env: { ...process.env, NEXT_DIST_DIR: ".next-prod" },
});
