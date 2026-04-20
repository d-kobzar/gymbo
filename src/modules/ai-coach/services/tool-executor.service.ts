import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistry, UnknownCoachToolError } from '../tools/tool-registry';

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  result: unknown;
  durationMs: number;
}

/**
 * Thin wrapper around ToolRegistry that measures latency and logs each
 * invocation. The assistant service delegates every tool call here so
 * budget/round-count enforcement lives in one place (Phase 3 will add
 * round + token budgets).
 */
@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(private readonly registry: ToolRegistry) {}

  getDefinitions() {
    return this.registry.getDefinitions();
  }

  async execute(
    toolName: string,
    params: unknown,
    userId: number,
  ): Promise<ToolExecutionResult> {
    const start = Date.now();
    try {
      const result = await this.registry.execute(toolName, params, userId);
      const durationMs = Date.now() - start;
      this.logger.log(
        `tool ${toolName} userId=${userId} durationMs=${durationMs} ok`,
      );
      return { toolName, success: true, result, durationMs };
    } catch (err) {
      const durationMs = Date.now() - start;
      if (err instanceof UnknownCoachToolError) {
        this.logger.warn(
          `tool ${toolName} userId=${userId} durationMs=${durationMs} unknown`,
        );
        return {
          toolName,
          success: false,
          result: { error: err.message },
          durationMs,
        };
      }
      this.logger.error(
        `tool ${toolName} userId=${userId} durationMs=${durationMs} failed: ${(err as Error).message}`,
      );
      return {
        toolName,
        success: false,
        result: { error: (err as Error).message },
        durationMs,
      };
    }
  }
}
