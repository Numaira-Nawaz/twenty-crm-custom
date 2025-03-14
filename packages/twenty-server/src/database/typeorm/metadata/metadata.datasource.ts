import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const isJest = process.argv.some((arg) => arg.includes('jest'));
console.log('process.env.PG_DATABASE_URL: ', process.env.PG_DATABASE_URL);

export const typeORMMetadataModuleOptions: TypeOrmModuleOptions = {
  url: process.env.PG_DATABASE_URL,
  type: 'postgres',
  logging: ['error'],
  schema: 'metadata',
  entities: [
    `${isJest ? '' : 'dist/'}src/engine/metadata-modules/**/*.entity{.ts,.js}`,
  ],
  synchronize: true,
  migrationsRun: false,
  migrationsTableName: '_typeorm_migrations',
  migrations: [
    `${isJest ? '' : 'dist/'}src/database/typeorm/metadata/migrations/*{.ts,.js}`,
  ],
  ssl:
    process.env.PG_SSL_ALLOW_SELF_SIGNED === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  extra: {
    query_timeout: 10000,
  },
};

export const connectionSource = new DataSource(
  typeORMMetadataModuleOptions as DataSourceOptions,
);
