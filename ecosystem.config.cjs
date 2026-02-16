module.exports = {
  apps: [
    {
      name: "discord-adhan-bot",
      script: "src/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      min_uptime: "30s",
      max_restarts: 20,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--unhandled-rejections=strict"
      }
    }
  ]
};
