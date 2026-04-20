import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as publicly accessible, bypassing the default JWT auth
 * guard. Consumed by `JwtAuthGuard` via the reflector.
 */
export const IS_PUBLIC_KEY = 'is-public';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
