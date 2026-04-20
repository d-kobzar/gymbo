import type { FunctionTool } from 'openai/resources/beta/assistants';

/**
 * A single tool the coach assistant can call. Every handler implements
 * this contract so the registry can treat them uniformly.
 *
 * - `name` is what the assistant emits as the tool call.
 * - `definition` is the OpenAI function schema (parameters, description).
 * - `execute` receives the parsed JSON arguments and the current user id.
 */
export interface CoachTool<TParams = Record<string, unknown>, TResult = unknown> {
  readonly name: string;
  readonly definition: FunctionTool;
  execute(params: TParams, userId: number): Promise<TResult>;
}
