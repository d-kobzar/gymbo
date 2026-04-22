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
const BUFFER_TOKEN_THRESHOLD = 2000;

/** Pinned to the very end of the instructions string — gpt-4o
 * weights trailing content more heavily than preamble, and the
 * top-of-prompt rules ("no restate", "scope = scope") were being
 * overridden by the model's own past assistant replies. This is
 * the non-negotiable checklist applied immediately before writing
 * the reply. */
const FINAL_DIRECTIVE = `### FINAL CHECK — apply before writing the reply

1. Identify the ONE exact question in the athlete's latest message.
   - No question mark and no explicit request → it is a state report. Reply in max 2 short sentences. Do NOT prescribe, do NOT list exercises, do NOT recite rest intervals / RIR / set-rep ranges.
2. Do NOT print today's exercise list unless the latest message literally asks "what is today's plan?".
3. Do NOT repeat any exercise list, rest-interval guide, RIR target, or warm-up protocol that already appeared in any of your previous assistant turns visible above. The athlete has it.
4. If the athlete called out that you repeated yourself, acknowledge in one sentence and STOP. Do not issue more content after the acknowledgement.
5. Scope of the reply = scope of the question. Not the weekly split. Not the full program. Not a protocol dump.
6. Hold the line. If the athlete pushes back with heat or profanity but no new evidence, do NOT cave. Acknowledge the disagreement in one short sentence, name the physiology (fatigue accumulation, motor-unit recruitment, stimulus-to-fatigue, working-set vs warm-up distinction), and restate the prescription with the reasoning bound to it. Do not write "извини за путаницу" / "делай как тебе удобнее" / "if you prefer" — those are banned. Update your stance only if the athlete supplies new data or surfaces a real constraint (pain, time, equipment).
7. Working sets vs warm-ups: a set at ≤ 60 % of the working load or at RIR ≥ 4 is a warm-up and does NOT count toward the prescribed working-set volume. If the athlete logged a pyramid ramp and is calling the first half "working sets", say so plainly.`;

export interface CoachAgentRequest {
  userId: number;
}

export interface CoachAgentResponse {
  text: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'other';
}

/**
 * Provider-agnostic agent loop.
 *
 * Per the hybrid-memory architecture, this service asks the context
 * service to compose the full request payload (system instructions +
 * entityMap + synthetic summary turn + Active Buffer) and drives the
 * tool-calling loop over LlmProvider. It does NOT load messages
 * itself — the Active Buffer already contains the athlete's latest
 * turns (MessageQueue wrote them to DB before invoking the agent).
 *
 * Tool calls and their outputs live only in-memory for the duration
 * of the turn; only the final assistant text is returned and
 * persisted by the caller.
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
    const { userId } = request;
    const { instructions, messages } = await this.contextService.composeContext(
      userId,
    );
    const fullInstructions = `${ASSISTANT_INSTRUCTIONS}\n\n${instructions}\n\n${FINAL_DIRECTIVE}`;
    const tools = this.toolExecutor.getDefinitions();
    const loopMessages: LlmMessage[] = [...messages];

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await this.llm.chat({
        model: this.model,
        instructions: fullInstructions,
        messages: loopMessages,
        tools,
        maxOutputTokens: this.maxOutputTokens,
        // Low temperature so the model follows strict scope /
        // no-restate / no-dump rules instead of "being creative".
        // 0.4 still produced dumps; 0.2 lands directive-followy.
        temperature: 0.2,
      });

      const hasToolCalls = response.toolCalls.length > 0;
      if (!hasToolCalls) {
        await this.afterRunCompleted(userId);
        return { text: response.text, finishReason: response.finishReason };
      }

      loopMessages.push({
        role: 'assistant',
        content: response.text,
        toolCalls: response.toolCalls,
      });

      for (const call of response.toolCalls) {
        const toolResult = await this.executeCall(call, userId);
        loopMessages.push({
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

  private async executeCall(call: LlmToolCall, userId: number): Promise<string> {
    let args: Record<string, unknown> = {};
    try {
      args = call.arguments ? JSON.parse(call.arguments) : {};
    } catch (err) {
      this.logger.warn(
        `tool ${call.name} received malformed JSON: ${(err as Error).message}`,
      );
    }
    const execution = await this.toolExecutor.execute(call.name, args, userId);
    return JSON.stringify(execution.result);
  }

  /**
   * Token-based summarizer trigger. Fires an async event (non-
   * blocking — handled by RollingSummaryService) when the Active
   * Buffer crosses the threshold. The threshold is per-buffer, not
   * per-request, so the full static instructions / ground truth do
   * NOT count against it.
   */
  private async afterRunCompleted(userId: number): Promise<void> {
    try {
      const bufferTokens = await this.contextService.countBufferTokens(userId);
      if (bufferTokens > BUFFER_TOKEN_THRESHOLD) {
        this.events.emit(COACH_SUMMARY_REQUESTED, { userId });
      }
    } catch (err) {
      this.logger.warn(
        `afterRunCompleted failed for userId=${userId}: ${(err as Error).message}`,
      );
    }
  }
}
