import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { OpenAIConfig } from '@core/config/openai.config';
import { ASSISTANT_INSTRUCTIONS } from '../tools/instructions';
import { ThreadManagerService } from './thread-manager.service';
import { ToolExecutorService } from './tool-executor.service';

const MAX_TOOL_ROUNDS = 10;
const FALLBACK_REPLY = "I couldn't generate a response.";

/**
 * Direct wrapper around OpenAI Assistants API. Holds the singleton
 * Assistant id (shared across all users), runs a conversation turn,
 * and fans tool calls out through ToolExecutorService.
 *
 * Higher-level orchestration (context, rolling summary, events) is
 * planned for Phase 3 in CoachService.
 */
@Injectable()
export class AssistantService implements OnModuleInit {
  private readonly logger = new Logger(AssistantService.name);
  private readonly client: OpenAI | null;
  private assistantId: string | null = null;

  constructor(
    config: ConfigService,
    private readonly threadManager: ThreadManagerService,
    private readonly toolExecutor: ToolExecutorService,
  ) {
    const { apiKey } = config.getOrThrow<OpenAIConfig>('openai');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
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

    await client.beta.threads.messages.create(threadId, { role: 'user', content: message });

    let run = await client.beta.threads.runs.create(threadId, { assistant_id: assistantId });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      run = await client.beta.threads.runs.poll(threadId, run.id);

      if (run.status === 'completed') break;

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
