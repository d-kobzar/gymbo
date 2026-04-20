import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { LlmConfig } from '@core/config/llm.config';
import {
  LLM_PROVIDER,
  type LlmMessage,
  type LlmProvider,
  type LlmToolCall,
} from '@modules/llm/llm-provider.interface';
import { ASSISTANT_INSTRUCTIONS } from '../tools/instructions';
import { CoachContextService } from './coach-context.service';
import { COACH_SUMMARY_REQUESTED } from './rolling-summary.service';
import { ToolExecutorService } from './tool-executor.service';

const MAX_TOOL_ROUNDS = 5;

export interface CoachAgentRequest {
  userId: number;
  history: LlmMessage[];
}

export interface CoachAgentResponse {
  text: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'other';
}

/**
 * Provider-agnostic agent loop. Given the persisted conversation
 * history (read from CoachMessages by the caller), composes
 * system-level instructions (ASSISTANT_INSTRUCTIONS + Context moment +
 * profile / program / measurements / rolling summary) and drives the
 * tool-calling loop over LlmProvider. Tool calls and their outputs
 * live only in-memory for the duration of the turn; only the final
 * assistant text is handed back and persisted by the caller.
 */
@Injectable()
export class CoachAgentService {
  private readonly logger = new Logger(CoachAgentService.name);
  private readonly model: string;
  private readonly maxOutputTokens: number;

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly toolExecutor: ToolExecutorService,
    private readonly contextService: CoachContextService,
    private readonly events: EventEmitter2,
    config: ConfigService,
  ) {
    const cfg = config.getOrThrow<LlmConfig>('llm');
    this.model = cfg.model;
    this.maxOutputTokens = cfg.maxOutputTokens;
  }

  async run(request: CoachAgentRequest): Promise<CoachAgentResponse> {
    const { userId, history } = request;
    const instructions = await this.composeInstructions(userId);
    const tools = this.toolExecutor.getDefinitions();
    const messages: LlmMessage[] = [...history];

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await this.llm.chat({
        model: this.model,
        instructions,
        messages,
        tools,
        maxOutputTokens: this.maxOutputTokens,
      });

      const hasToolCalls = response.toolCalls.length > 0;
      if (!hasToolCalls) {
        await this.afterRunCompleted(userId);
        return { text: response.text, finishReason: response.finishReason };
      }

      messages.push({
        role: 'assistant',
        content: response.text,
        toolCalls: response.toolCalls,
      });

      for (const call of response.toolCalls) {
        const toolResult = await this.executeCall(call, userId);
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          output: toolResult,
        });
      }
    }

    this.logger.warn(
      `coach agent exhausted ${MAX_TOOL_ROUNDS} tool rounds for userId=${userId}`,
    );
    await this.afterRunCompleted(userId);
    return {
      text: "I wasn't able to finish that in a reasonable number of steps. Try rephrasing?",
      finishReason: 'other',
    };
  }

  private async composeInstructions(userId: number): Promise<string> {
    const context = await this.contextService.buildRunInstructions(userId).catch((err: Error) => {
      this.logger.warn(`buildRunInstructions failed: ${err.message}`);
      return '';
    });
    return context ? `${ASSISTANT_INSTRUCTIONS}\n\n${context}` : ASSISTANT_INSTRUCTIONS;
  }

  private async executeCall(call: LlmToolCall, userId: number): Promise<string> {
    let args: Record<string, unknown> = {};
    try {
      args = call.arguments ? JSON.parse(call.arguments) : {};
    } catch (err) {
      this.logger.warn(`tool ${call.name} received malformed JSON: ${(err as Error).message}`);
    }
    const execution = await this.toolExecutor.execute(call.name, args, userId);
    return JSON.stringify(execution.result);
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
}
