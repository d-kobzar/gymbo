import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import OpenAI from 'openai';
import { AiThread } from '../models/ai-thread.model';

export interface ThreadHandle {
  threadId: string;
  assistantId: string;
}

/**
 * Owns the AiThreads table — one persistent OpenAI thread per user.
 * The assistant service asks for a handle before every chat turn and
 * the manager either fetches it or creates + caches a new one.
 */
@Injectable()
export class ThreadManagerService {
  constructor(@InjectModel(AiThread) private readonly aiThreadModel: typeof AiThread) {}

  async getOrCreate(
    userId: number,
    client: OpenAI,
    assistantId: string,
  ): Promise<ThreadHandle> {
    const existing = await this.aiThreadModel.findOne({ where: { userId } });
    if (existing) {
      return { threadId: existing.threadId, assistantId: existing.assistantId };
    }

    const thread = await client.beta.threads.create();
    const record = await this.aiThreadModel.create({
      userId,
      threadId: thread.id,
      assistantId,
    } as Partial<AiThread>);
    return { threadId: record.threadId, assistantId: record.assistantId };
  }

  async findAnyAssistantId(): Promise<string | null> {
    const record = await this.aiThreadModel.findOne({ attributes: ['assistantId'] });
    return record?.assistantId ?? null;
  }

  async clear(userId: number, client: OpenAI): Promise<void> {
    const record = await this.aiThreadModel.findOne({ where: { userId } });
    if (!record) return;
    try {
      await client.beta.threads.del(record.threadId);
    } catch {
      // ignore — remote thread may already be gone
    }
    await record.destroy();
  }
}
