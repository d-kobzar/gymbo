import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import OpenAI from 'openai';
import type { OpenAIConfig } from '@core/config/openai.config';
import { ASSISTANT_INSTRUCTIONS } from '../tools/instructions';
import { CoachContextService } from './coach-context.service';
import { COACH_SUMMARY_REQUESTED } from './rolling-summary.service';
import { ThreadManagerService } from './thread-manager.service';
import { ToolExecutorService } from './tool-executor.service';

const MAX_TOOL_ROUNDS = 5;
const FALLBACK_REPLY = "I couldn't generate a response.";
const BUDGET_EXCEEDED_REPLY =
  "I've used up the token budget for this answer. Give me a moment and try again.";

/**
 * Direct wrapper around OpenAI Assistants API. Holds the singleton
 * Assistant id (shared across all users), runs a conversation turn,
 * fans tool calls out through ToolExecutorService, and pulls the
 * per-user context block from CoachContextService so the coach stays
 * aware of profile / rolling summary / recent domain events.
 *
 * Budgets:
 *  - MAX_TOOL_ROUNDS: hard cap on how many tool-call rounds a single
 *    user turn may do (Phase 3 lowered this from 10 to 5).
 *  - runTokenBudget (from OpenAIConfig): when the running
 *    `run.usage.total_tokens` crosses it, we stop and reply with a
 *    soft fallback instead of pressing on.
 */
@Injectable()
export class AssistantService implements OnModuleInit {
  private readonly logger = new Logger(AssistantService.name);
  private readonly client: OpenAI | null;
  private readonly tokenBudget: number;
  private assistantId: string | null = null;

  constructor(
    config: ConfigService,
    private readonly threadManager: ThreadManagerService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly contextService: CoachContextService,
    private readonly events: EventEmitter2,
  ) {
    const cfg = config.getOrThrow<OpenAIConfig>('openai');
    this.client = cfg.apiKey ? new OpenAI({ apiKey: cfg.apiKey }) : null;
    this.tokenBudget = cfg.runTokenBudget;
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) return;
    try {
      await this.syncAssistant();
    } catch (err) {
      this.logger.warn(`Assistant sync failed: ${(err as Error).message}`);
    }
  }

  async chat(userId: number, message: string): Promise<string> {
    const client = this.requireClient();
    const assistantId = await this.syncAssistant();
    const { threadId } = await this.threadManager.getOrCreate(userId, client, assistantId);
    const additionalInstructions = await this.contextService
      .buildRunInstructions(userId)
      .catch((err: Error) => {
        this.logger.warn(`buildRunInstructions failed: ${err.message}`);
        return '';
      });

    await client.beta.threads.messages.create(threadId, { role: 'user', content: message });

    let run = await client.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
      additional_instructions: additionalInstructions || undefined,
    });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      run = await client.beta.threads.runs.poll(threadId, run.id);

      if (run.status === 'completed') break;

      if (this.overBudget(run)) {
        await this.cancelRun(client, threadId, run.id);
        this.logger.warn(
          `Run cancelled by token budget (${this.tokenBudget}) for userId=${userId}`,
        );
        return BUDGET_EXCEEDED_REPLY;
      }

      if (run.status === 'requires_action' && run.required_action?.submit_tool_outputs) {
        const calls = run.required_action.submit_tool_outputs.tool_calls;
        const outputs = await Promise.all(
          calls.map(async (call) => {
            const args = this.safeParseJson(call.function.arguments);
            const execution = await this.toolExecutor.execute(
              call.function.name,
              args,
              userId,
            );
            return {
              tool_call_id: call.id,
              output: JSON.stringify(execution.result),
            };
          }),
        );

        run = await client.beta.threads.runs.submitToolOutputs(threadId, run.id, {
          tool_outputs: outputs,
        });
        continue;
      }

      if (['failed', 'cancelled', 'expired'].includes(run.status)) {
        throw new Error(`Run ${run.status}: ${run.last_error?.message ?? 'unknown'}`);
      }
    }

    await this.afterRunCompleted(userId);

    const messages = await client.beta.threads.messages.list(threadId, {
      limit: 1,
      order: 'desc',
    });
    const last = messages.data[0];
    if (last?.role === 'assistant' && last.content[0]?.type === 'text') {
      return last.content[0].text.value;
    }
    return FALLBACK_REPLY;
  }

  async clearHistory(userId: number): Promise<void> {
    const client = this.requireClient();
    await this.threadManager.clear(userId, client);
  }

  private async afterRunCompleted(userId: number): Promise<void> {
    try {
      const { shouldRegenerate } = await this.contextService.recordRunCompleted(userId);
      if (shouldRegenerate) {
        this.events.emit(COACH_SUMMARY_REQUESTED, { userId });
      }
    } catch (err) {
      this.logger.warn(
        `afterRunCompleted failed for userId=${userId}: ${(err as Error).message}`,
      );
    }
  }

  private overBudget(run: OpenAI.Beta.Threads.Runs.Run): boolean {
    const used = run.usage?.total_tokens ?? 0;
    return this.tokenBudget > 0 && used > this.tokenBudget;
  }

  private async cancelRun(client: OpenAI, threadId: string, runId: string): Promise<void> {
    try {
      await client.beta.threads.runs.cancel(threadId, runId);
    } catch (err) {
      this.logger.debug(`cancel run failed: ${(err as Error).message}`);
    }
  }

  private async syncAssistant(): Promise<string> {
    if (this.assistantId) return this.assistantId;
    const client = this.requireClient();

    const assistantConfig = {
      name: 'GymBo Coach',
      instructions: ASSISTANT_INSTRUCTIONS,
      model: 'gpt-4o',
      tools: this.toolExecutor.getDefinitions(),
    };

    const existingId = await this.threadManager.findAnyAssistantId();
    if (existingId) {
      try {
        await client.beta.assistants.update(existingId, assistantConfig);
        this.assistantId = existingId;
        return this.assistantId;
      } catch (err) {
        this.logger.warn(
          `Assistant update failed, recreating: ${(err as Error).message}`,
        );
      }
    }

    const assistant = await client.beta.assistants.create(assistantConfig);
    this.assistantId = assistant.id;
    return this.assistantId;
  }

  private requireClient(): OpenAI {
    if (!this.client) {
      throw new Error('OpenAI not configured (OPENAI_API_KEY missing)');
    }
    return this.client;
  }

  private safeParseJson(raw: string | null | undefined): Record<string, unknown> {
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
