import { Injectable, Logger } from '@nestjs/common';
import Bottleneck from 'bottleneck';

const GLOBAL_PER_SEC = 30;
const PER_CHAT_PER_SEC = 1;
const RETRY_DELAYS_MS = [500, 2000, 8000];

/**
 * Rate-limits outgoing Telegram calls to stay under the documented
 * bureau limits (30 msgs/sec globally, 1 msg/sec per chat) and
 * retries transient 429 / 5xx responses with exponential backoff.
 *
 * Callers wrap any outgoing Telegraf call in `schedule(chatId, fn)`.
 */
@Injectable()
export class BotThrottler {
  private readonly logger = new Logger(BotThrottler.name);
  private readonly global = new Bottleneck({
    reservoir: GLOBAL_PER_SEC,
    reservoirRefreshAmount: GLOBAL_PER_SEC,
    reservoirRefreshInterval: 1000,
    minTime: Math.ceil(1000 / GLOBAL_PER_SEC),
  });
  private readonly perChat = new Map<number, Bottleneck>();

  private getChatLimiter(chatId: number): Bottleneck {
    let limiter = this.perChat.get(chatId);
    if (!limiter) {
      limiter = new Bottleneck({
        reservoir: PER_CHAT_PER_SEC,
        reservoirRefreshAmount: PER_CHAT_PER_SEC,
        reservoirRefreshInterval: 1000,
        minTime: Math.ceil(1000 / PER_CHAT_PER_SEC),
      });
      this.perChat.set(chatId, limiter);
    }
    return limiter;
  }

  /**
   * Run `fn` through the per-chat limiter (nested inside the global
   * one) with exponential-backoff retry on 429 / 5xx responses from
   * Telegram.
   */
  async schedule<T>(chatId: number, fn: () => Promise<T>): Promise<T> {
    const chatLimiter = this.getChatLimiter(chatId);
    return this.global.schedule(() =>
      chatLimiter.schedule(() => this.withRetry(chatId, fn)),
    );
  }

  private async withRetry<T>(chatId: number, fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!this.shouldRetry(err) || attempt === RETRY_DELAYS_MS.length) break;
        const delayMs = this.retryDelayMs(err, attempt);
        this.logger.warn(
          `Telegram call failed (chatId=${chatId}, attempt=${attempt + 1}), retrying in ${delayMs}ms: ${(err as Error).message}`,
        );
        await sleep(delayMs);
      }
    }
    throw lastErr;
  }

  private shouldRetry(err: unknown): boolean {
    const code = this.extractCode(err);
    if (code == null) return false;
    return code === 429 || (code >= 500 && code < 600);
  }

  private retryDelayMs(err: unknown, attempt: number): number {
    const code = this.extractCode(err);
    if (code === 429) {
      const retryAfter = this.extractRetryAfter(err);
      if (retryAfter != null) return Math.max(retryAfter * 1000, RETRY_DELAYS_MS[attempt]);
    }
    return RETRY_DELAYS_MS[attempt];
  }

  private extractCode(err: unknown): number | null {
    const e = err as { response?: { error_code?: number }; code?: number };
    return e?.response?.error_code ?? e?.code ?? null;
  }

  private extractRetryAfter(err: unknown): number | null {
    const e = err as { response?: { parameters?: { retry_after?: number } } };
    return e?.response?.parameters?.retry_after ?? null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
