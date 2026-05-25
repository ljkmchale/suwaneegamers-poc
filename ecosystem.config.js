// PM2 configuration for Windows production server
// Place this file at C:\apps\suwaneegamers\ecosystem.config.js

module.exports = {
  apps: [
    {
      name: "suwaneegamers-web",
      // Path to the standalone Next.js server output
      script: "C:/apps/suwaneegamers/apps/web/.next/standalone/apps/web/server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1", // Bind to localhost only — Cloudflare Tunnel handles external
      },
      max_restarts: 10,
      min_uptime: "5s",
      watch: false,
      autorestart: true,
      // Restart if memory exceeds 512MB
      max_memory_restart: "512M",
      // Log paths
      out_file: "C:/apps/suwaneegamers/logs/web-out.log",
      error_file: "C:/apps/suwaneegamers/logs/web-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
