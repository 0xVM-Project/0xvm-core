module.exports = {
  apps: [
    {
      name: '0xvm-core',
      script: './dist/main.js',
      args: '',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      // log_file: './logs/system.log',
      // out_file: './logs/out.log',
      // error_file: './logs/error.log',
      // Do not set the log_date_format option, because the program log already records the time.
      // log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
