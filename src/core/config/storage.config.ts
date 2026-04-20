import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  endpoint: string;
  region: string;
  keyId: string;
  appKey: string;
  bucket: string;
}

export const storageConfig = registerAs('storage', (): StorageConfig => ({
  endpoint: process.env.B2_ENDPOINT ?? '',
  region: process.env.B2_REGION ?? '',
  keyId: process.env.B2_KEY_ID ?? '',
  appKey: process.env.B2_APP_KEY ?? '',
  bucket: process.env.B2_BUCKET ?? '',
}));
