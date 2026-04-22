import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import type { LlmConfig } from '@core/config/llm.config';
import { I18nService } from '@modules/i18n/services/i18n.service';
import { BotService } from '@modules/bot/services/bot.service';
import { User } from '@modules/users/models/user.model';
import { CoachMessage } from '../models/coach-message.model';
import { CoachAgentService } from './coach-agent.service';

const RECOVERY_SWEEP_MS = 60_000;
const BOOT_RECOVERY_DELAY_MS = 3_000;

/**
 * DB-first queue with per-user debounce.
 *
 * Users on Telegram tend to split a single thought across several short
 * messages ("привет", "у меня вопрос", "про спину"). We want ONE LLM
 * turn that sees the whole thought, not one call per line.
 *
 *   1. Every incoming user message is written to CoachMessages with
 *      processedAt = NULL — immediate, synchronous.
 *   2. Per-user setTimeout ticks after LLM_DEBOUNCE_MS (default 15s).
 *      Each new message resets the timer.
 *   3. On fire: atomically claim all unprocessed rows for the user,
 *      concatenate, call the agent, persist the assistant reply (also
 *      in CoachMessages), and send via Telegram bot.
 *   4. Recovery: OnApplicationBootstrap scans for users with orphaned
 *      unprocessed messages (crashed mid-debounce) and re-arms them.
 *      A periodic sweep does the same every 60s in case a timer is
 *      dropped (process restart, clock skew, etc).
 *
 * Concurrency: a per-user Promise guard (`inflight`) prevents two
 * batches firing at once — the second waits for the first to finish
 * then checks for new work.
 */
@Injectable()
export class MessageQueueService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MessageQueueService.name);
  private readonly debounceMs: number;
  private readonly timers = new Map<number, NodeJS.Timeout>();
  private readonly inflight = new Map<number, Promise<void>>();
  private sweepHandle: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(CoachMessage) private readonly messageModel: typeof CoachMessage,
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly agent: CoachAgentService,
    @Inject(forwardRef(() => BotService))
    private readonly bot: BotService,
    private readonly i18n: I18nService,
    config: ConfigService,
  ) {
    const cfg = config.getOrThrow<LlmConfig>('llm');
    this.debounceMs = cfg.debounceMs;
  }

  async onApplicationBootstrap(): Promise<void> {
    setTimeout(() => void this.recoverOrphans(), BOOT_RECOVERY_DELAY_MS);
    this.sweepHandle = setInterval(
      () => void this.recoverOrphans(),
      RECOVERY_SWEEP_MS,
    );
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    if (this.sweepHandle) clearInterval(this.sweepHandle);
  }

  /**
   * Enqueue a user message. Writes to DB immediately and (re)arms the
   * debounce timer. Returns once the write lands — the actual LLM
   * call runs asynchronously.
   */
  async enqueue(userId: number, content: string): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed) return;
    await this.messageModel.create({
      userId,
      role: 'user',
      content: trimmed,
    } as Partial<CoachMessage>);
    this.armTimer(userId);
  }

  private armTimer(userId: number): void {
    const existing = this.timers.get(userId);
    if (existing) clearTimeout(existing);
    const handle = setTimeout(() => {
      this.timers.delete(userId);
      void this.fire(userId);
    }, this.debounceMs);
    this.timers.set(userId, handle);
  }

  private async fire(userId: number): Promise<void> {
    const existing = this.inflight.get(userId);
    if (existing) {
      try {
        await existing;
      } catch {
        /* ignore — we only care about serialization */
      }
    }
    const task = this.runBatch(userId).finally(() => {
      this.inflight.delete(userId);
    });
    this.inflight.set(userId, task);
    await task;
  }

  private async runBatch(userId: number): Promise<void> {
    const now = new Date();

    const unprocessed = await this.messageModel.findAll({
      where: { userId, role: 'user', processedAt: null },
      order: [['createdAt', 'ASC']],
    });
    if (unprocessed.length === 0) return;

    const user = await this.userModel.findByPk(userId, {
      attributes: ['id', 'chatId', 'language'],
    });
    if (!user?.chatId) {
      this.logger.warn(
        `no chatId for userId=${userId}; skipping batch of ${unprocessed.length}`,
      );
      return;
    }

    // Mark the debounced user messages as processed BEFORE the LLM
    // call — they already live in CoachMessages and will be picked up
    // as the tail of the Active Buffer by ContextService.composeContext.
    // `processedAt` only gates the debounce queue; it is independent
    // of `summaryStatus` which gates the memory-fold pipeline.
    await this.messageModel.update(
      { processedAt: now },
      { where: { id: { [Op.in]: unprocessed.map((m) => m.id) } } },
    );

    let reply: string;
    try {
      const result = await this.agent.run({ userId });
      reply = result.text?.trim() || this.i18n.t('coach.error', user.language);
    } catch (err) {
      this.logger.error(
        `coach agent failed for userId=${userId}: ${(err as Error).message}`,
      );
      await this.bot.sendMessage(
        Number(user.chatId),
        this.i18n.t('coach.error', user.language),
      );
      return;
    }

    await this.messageModel.create({
      userId,
      role: 'assistant',
      content: reply,
      processedAt: new Date(),
    } as Partial<CoachMessage>);

    await this.bot.sendToChat(Number(user.chatId), reply);
  }

  private async recoverOrphans(): Promise<void> {
    const cutoff = new Date(Date.now() - this.debounceMs);
    try {
      const rows = await this.messageModel.findAll({
        where: {
          role: 'user',
          processedAt: null,
          createdAt: { [Op.lte]: cutoff },
        },
        attributes: ['userId'],
        group: ['userId'],
        raw: true,
      });
      for (const row of rows as unknown as Array<{ userId: number }>) {
        if (this.timers.has(row.userId) || this.inflight.has(row.userId)) continue;
        this.logger.log(`recovering orphaned batch for userId=${row.userId}`);
        void this.fire(row.userId);
      }
    } catch (err) {
      this.logger.warn(`recoverOrphans failed: ${(err as Error).message}`);
    }
  }
}
