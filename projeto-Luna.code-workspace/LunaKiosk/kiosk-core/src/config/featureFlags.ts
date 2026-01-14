export type FeatureFlags = {
  KIOSK_V2_ENABLED: boolean;
};

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function getFeatureFlags(env: NodeJS.ProcessEnv = process.env): FeatureFlags {
  return {
    KIOSK_V2_ENABLED: parseBool(env.KIOSK_V2_ENABLED)
  };
}
