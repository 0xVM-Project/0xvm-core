import { registerAs } from '@nestjs/config'
import * as path from 'path'

export default registerAs('db-mysql', () => ({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'test',
    entities: [path.dirname(__dirname) + '/**/*.entity{.ts,.js}'],
    synchronize: process.env.DB_SYNCHRONIZE == 'true' ? true : false,
}));
