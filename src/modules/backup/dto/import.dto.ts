import { IsArray, IsOptional } from 'class-validator';

/**
 * Backup payloads from v1 export have loose nested shapes (snake_case in
 * places, numeric exercise_id vs string exercise name). We accept any
 * object arrays here and let the service do the structural coercion —
 * DTOs aren't the right place to codify the v1 schema quirks.
 */
export class ImportBackupDto {
  @IsOptional()
  @IsArray()
  exercises?: unknown[];

  @IsOptional()
  @IsArray()
  workouts?: unknown[];

  @IsOptional()
  @IsArray()
  measurements?: unknown[];

  @IsOptional()
  @IsArray()
  programs?: unknown[];
}
