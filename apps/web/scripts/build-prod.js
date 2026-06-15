// Builds to .next-prod so the production service and dev server never share
// the same output directory. Run via: npm run build:prod
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const contentDir = path.resolve(__dirname, "../../../content");

// Clear the image optimization cache so stale optimized images are never
// served after source images change between deploys.
const imgCache = path.resolve(__dirname, "../.next-prod/cache/images");
if (fs.existsSync(imgCache)) {
  fs.rmSync(imgCache, { recursive: true, force: true });
  console.log("Cleared .next-prod/cache/images");
}

execSync("node node_modules/next/dist/bin/next build --webpack", {
  stdio: "inherit",
  env: { ...process.env, NEXT_DIST_DIR: ".next-prod", SUWANEE_CONTENT_DIR: contentDir },
});
