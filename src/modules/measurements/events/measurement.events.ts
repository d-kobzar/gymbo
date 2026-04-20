export const MeasurementEvents = {
  Created: 'measurement.created',
  Updated: 'measurement.updated',
  Deleted: 'measurement.deleted',
} as const;

export interface MeasurementCreatedPayload {
  userId: number;
  measurementId: number;
  date: string;
}
