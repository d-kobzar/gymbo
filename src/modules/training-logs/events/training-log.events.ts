/**
 * Events emitted by the training-logs module. The Phase 3 coach-context
 * listener subscribes here to mark the rolling summary stale.
 */
export const TrainingLogEvents = {
  Created: 'training-log.created',
  Updated: 'training-log.updated',
  Deleted: 'training-log.deleted',
} as const;

export interface TrainingLogCreatedPayload {
  userId: number;
  logId: number;
  exerciseId: number;
  date: string;
  isPr: boolean;
}
