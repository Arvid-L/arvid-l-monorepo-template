import { config } from 'dotenv';
import { resolve } from 'path';

// Loads the env file BEFORE any module that reads process.env at import
// time (AppModule's ConfigModule.forRoot validation runs during decorator
// evaluation). main.ts imports this file first — keep it dependency-free.
// In containers the environment is injected directly and no env file
// exists; dotenv silently no-ops on a missing file.
const NODE_ENV_FILE_RECORD: Record<string, string> = {
  development: '.env.dev',
  e2e: '.env.e2e',
  production: '.env.production',
};

config({
  path: resolve(
    process.cwd(),
    NODE_ENV_FILE_RECORD[process.env.NODE_ENV ?? 'development'] ?? '.env.dev',
  ),
});
