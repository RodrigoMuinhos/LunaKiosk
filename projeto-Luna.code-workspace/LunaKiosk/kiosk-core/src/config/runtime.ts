export type RuntimeConfig = {
  USE_PERSISTENT_DB: boolean;
  DB_FILE_PATH: string;
  OUTBOX_ENABLED: boolean;
  KIOSK_V2_ENABLED: boolean;
  TEF_BRIDGE_URL: string;
  PRINT_BRIDGE_URL: string;
  OUTBOX_SYNC_URL: string;
};

export function getConfig(): RuntimeConfig {
  const env = process.env;
  return {
    USE_PERSISTENT_DB: (env.USE_PERSISTENT_DB ?? 'true').toLowerCase() !== 'false',
    DB_FILE_PATH: env.DB_FILE_PATH || './data/kiosk.db',
    OUTBOX_ENABLED: (env.OUTBOX_ENABLED ?? 'true').toLowerCase() !== 'false',
    KIOSK_V2_ENABLED: (env.KIOSK_V2_ENABLED ?? 'false').toLowerCase() === 'true',
    TEF_BRIDGE_URL: env.TEF_BRIDGE_URL || 'http://127.0.0.1:7071',
    PRINT_BRIDGE_URL: env.PRINT_BRIDGE_URL || 'http://127.0.0.1:7072',
    OUTBOX_SYNC_URL: env.OUTBOX_SYNC_URL || 'http://127.0.0.1:7090/sync/outbox'
  };
}
