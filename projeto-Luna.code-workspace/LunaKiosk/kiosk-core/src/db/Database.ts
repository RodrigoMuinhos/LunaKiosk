import fs from 'node:fs';
import path from 'node:path';

import { getSchemaSql, KIOSK_DB_FILENAME } from './schema.js';

export type DatabaseConfig = {
  dataDir: string;
};

export class DatabasePath {
  readonly filename: string;
  constructor(config: DatabaseConfig) {
    fs.mkdirSync(config.dataDir, { recursive: true });
    this.filename = path.join(config.dataDir, KIOSK_DB_FILENAME);
  }
}

export type SchemaProvider = {
  schemaSql: string[];
};

export const DefaultSchemaProvider: SchemaProvider = {
  schemaSql: getSchemaSql()
};
