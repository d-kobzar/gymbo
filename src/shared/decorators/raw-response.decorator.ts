import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route (or controller) as opted-out of the global `TransformInterceptor`
 * envelope. The raw controller return value is sent to the client untouched.
 *
 * Use on endpoints whose response shape is dictated by a third party
 * (health checks, webhook acknowledgements, static-like payloads).
 */
export const RAW_RESPONSE_KEY = 'raw-response';
export const Raw = () => SetMetadata(RAW_RESPONSE_KEY, true);
