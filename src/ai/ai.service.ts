import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import OpenAI from 'openai';
import { AiThread } from './ai-thread.model';
import { assistantTools, ASSISTANT_INSTRUCTIONS } from './tools/tool-definitions';
import { executeTool } from './tools/tool-handlers';

@Injectable()
export class AiService implements OnModuleInit {
  private client: OpenAI | null = null;
  private assistantId: string | null = null;

  constructor(
    @InjectModel(AiThread) private aiThreadModel: typeof AiThread,
  ) {
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  async onModuleInit() {
    if (!this.client) return;
    try {
      await this.getOrCreateAssistant();
    } catch (err: any) {
      console.warn('Assistant sync failed:', err?.message || err);
    }
  }

  private async getOrCreateAssistant(): Promise<string> {
    if (this.assistantId) return this.assistantId;

    const existing = await this.aiThreadModel.findOne({ where: {}, attributes: ['assistantId'] });
    const assistantConfig = {
      name: 'GymBo Coach',
      instructions: ASSISTANT_INSTRUCTIONS,
      model: 'gpt-4o',
      tools: assistantTools,
    };

    if (existing?.assistantId) {
      try {
        await this.client!.beta.assistants.update(existing.assistantId, assistantConfig);
        this.assistantId = existing.assistantId;
        return this.assistantId;
      } catch (err: any) {
        console.warn('Assistant update failed, recreating:', err?.message || err);
      }
    }

    const assistant = await this.client!.beta.assistants.create(assistantConfig);
    this.assistantId = assistant.id;
    return this.assistantId;
  }

  private async getOrCreateThread(userId: number): Promise<{ threadId: string; assistantId: string }> {
    let record = await this.aiThreadModel.findOne({ where: { userId } });

    if (record) {
      return { threadId: record.threadId, assistantId: record.assistantId };
    }

    const assistantId = await this.getOrCreateAssistant();
    const thread = await this.client!.beta.threads.create();

    record = await this.aiThreadModel.create({
      userId,
      threadId: thread.id,
      assistantId,
    });

    return { threadId: record.threadId, assistantId: record.assistantId };
  }

  async chat(userId: number, message: string): Promise<string> {
    if (!this.client) throw new Error('OpenAI not configured');

    const { threadId, assistantId } = await this.getOrCreateThread(userId);

    // Add user message to thread
    await this.client.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    });

    // Create a run
    let run = await this.client.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    // Poll until complete, handling tool calls
    let rounds = 0;
    while (rounds < 10) {
      rounds++;

      // Wait for run to complete
      run = await this.client.beta.threads.runs.poll(threadId, run.id);

      if (run.status === 'completed') break;

      if (run.status === 'requires_action' && run.required_action?.submit_tool_outputs) {
        const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs: Array<{ tool_call_id: string; output: string }> = [];

        for (const call of toolCalls) {
          const args = JSON.parse(call.function.arguments || '{}');
          const result = await executeTool(call.function.name, args, userId);
          toolOutputs.push({
            tool_call_id: call.id,
            output: JSON.stringify(result),
          });
        }

        run = await this.client.beta.threads.runs.submitToolOutputs(threadId, run.id, {
          tool_outputs: toolOutputs,
        });
        continue;
      }

      if (['failed', 'cancelled', 'expired'].includes(run.status)) {
        throw new Error(`Run ${run.status}: ${run.last_error?.message || 'unknown'}`);
      }
    }

    // Get the latest assistant message
    const messages = await this.client.beta.threads.messages.list(threadId, { limit: 1, order: 'desc' });
    const lastMsg = messages.data[0];

    if (lastMsg?.role === 'assistant' && lastMsg.content[0]?.type === 'text') {
      return lastMsg.content[0].text.value;
    }

    return 'I couldn\'t generate a response.';
  }

  async clearHistory(userId: number): Promise<void> {
    const record = await this.aiThreadModel.findOne({ where: { userId } });
    if (record && this.client) {
      try {
        await this.client.beta.threads.del(record.threadId);
      } catch {}
      await record.destroy();
    }
  }
}
