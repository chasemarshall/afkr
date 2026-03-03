const { join } = require('path');

module.exports = {
  apps: [
    {
      name: 'afkr-server',
      script: 'server/dist/index.js',
      cwd: __dirname,
      exec_mode: 'fork',
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: 'afkr-webhook',
      script: 'scripts/webhook.mjs',
      cwd: __dirname,
      exec_mode: 'fork',
      node_args: `--env-file=${join(__dirname, '.env')}`,
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
