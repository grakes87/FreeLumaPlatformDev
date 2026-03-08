module.exports = {
  apps: [
    {
      name: 'freeluma',
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      node_args: '--max-old-space-size=2048',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '2G',
      restart_delay: 3000,
    },
  ],
};
