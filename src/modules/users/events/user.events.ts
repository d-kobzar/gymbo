/**
 * Domain events emitted by the users module. Consumed in later phases
 * (e.g. the AI coach invalidates its rolling summary on profile change).
 * Declared here so downstream handlers can type the payload shape.
 */

export const UserEvents = {
  Registered: 'user.registered',
  ProfileUpdated: 'user.profile-updated',
} as const;

export type UserEventName = (typeof UserEvents)[keyof typeof UserEvents];

export interface UserRegisteredPayload {
  userId: number;
  telegramId: number;
}

export interface UserProfileUpdatedPayload {
  userId: number;
  changed: ReadonlyArray<keyof UserProfileChange>;
}

export interface UserProfileChange {
  name?: string;
  language?: string;
  timezone?: string;
}
