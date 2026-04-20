import type { LlmFunctionTool } from '@modules/llm/llm-provider.interface';

/**
 * A single tool the coach can call. Every handler implements this
 * contract so the registry can treat them uniformly.
 *
 * - `name` is what the model emits as the tool call.
 * - `definition` is the JSON-schema-based declaration sent to the LLM.
 * - `execute` receives the parsed JSON arguments and the current user id.
 */
export interface CoachTool<TParams = Record<string, unknown>, TResult = unknown> {
  readonly name: string;
  readonly definition: LlmFunctionTool;
  execute(params: TParams, userId: number): Promise<TResult>;
}
