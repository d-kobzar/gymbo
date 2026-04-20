export const ProgramEvents = {
  Created: 'program.created',
  Updated: 'program.updated',
  Deleted: 'program.deleted',
} as const;

export interface ProgramMutatedPayload {
  userId: number;
  programId: number;
}
