module.exports = {
  apps: [
    {
      name: "suwaneegamers-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 4652",
      cwd: "C:/Users/Larry McHale/Desktop/suwaneegamers-poc/apps/web",
      env: {
        NODE_ENV: "production",
        PORT: 4652,
        HOSTNAME: "127.0.0.1",
      },
      max_restarts: 10,
      min_uptime: "5s",
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
      out_file: "C:/Users/Larry McHale/Desktop/suwaneegamers-poc/logs/web-out.log",
      error_file: "C:/Users/Larry McHale/Desktop/suwaneegamers-poc/logs/web-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
