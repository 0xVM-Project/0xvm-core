import { registerAs } from '@nestjs/config'
import * as path from 'path'
import * as glob from 'glob';

/**
 * Load entities using glob patterns while excluding specific directories
 * @returns {string[]} List of entity file paths
 */
function getEntities(): string[] {
  const baseDir = path.dirname(__dirname);
  // Glob pattern to match all entity files
  const allEntities = glob.sync(path.join(baseDir, '/**/*.entity{.ts,.js}'));
  // Glob patterns to match files in directories we want to exclude
  const excludedEntities = glob.sync(path.join(baseDir, '/**/sqlite-entities/*.entity{.ts,.js}'));
  // Filter out excluded entities
  const filteredEntities = allEntities.filter(entity => !excludedEntities.includes(entity));
  return filteredEntities;
}

export default registerAs('db-mysql', () => ({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'test',
    entities: getEntities(),
    synchronize: process.env.DB_SYNCHRONIZE == 'true' ? true : false,
}));