module.exports = {
  apps: [{
    name: "604-sell-cars",
    script: "server/index.js",
    instances: 1,
    exec_mode: "fork",
    env: { NODE_ENV: "production" },
    max_memory_restart: "750M",
    time: true,
  }],
};
