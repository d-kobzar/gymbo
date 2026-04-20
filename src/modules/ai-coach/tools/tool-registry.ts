import { Injectable } from '@nestjs/common';
import type { FunctionTool } from 'openai/resources/beta/assistants';
import type { CoachTool } from './coach-tool.interface';

export class UnknownCoachToolError extends Error {
  constructor(public readonly toolName: string) {
    super(`Unknown coach tool: ${toolName}`);
    this.name = 'UnknownCoachToolError';
  }
}

@Injectable()
export class ToolRegistry {
  private readonly tools = new Map<string, CoachTool>();

  constructor(tools: CoachTool[]) {
    for (const tool of tools) {
      if (this.tools.has(tool.name)) {
        throw new Error(`Duplicate coach tool name: ${tool.name}`);
      }
      this.tools.set(tool.name, tool);
    }
  }

  getDefinitions(): FunctionTool[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async execute(name: string, params: unknown, userId: number): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new UnknownCoachToolError(name);
    return tool.execute(params as Record<string, unknown>, userId);
  }
}
