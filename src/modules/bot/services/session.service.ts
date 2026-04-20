import { Injectable } from '@nestjs/common';

const DEFAULT_TTL_MS = 30 * 60 * 1000;

interface SessionEntry<T> {
  state: T;
  expiresAt: number;
}

/**
 * Short-lived, in-memory per-user session state for multi-step bot
 * flows (e.g. a future "setup program" wizard). NOT used for AI
 * coach context — that lives in CoachContextService.
 *
 * Entries auto-expire on access after TTL (default 30 min). No
 * sweeper task: cleanup runs lazily, which is fine given the bot's
 * traffic shape.
 */
@Injectable()
export class SessionService {
  private readonly sessions = new Map<number, SessionEntry<unknown>>();

  /** @template T @returns {T | null} */
  get<T>(userId: number): T | null {
    const entry = this.sessions.get(userId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.sessions.delete(userId);
      return null;
    }
    return entry.state as T;
  }

  set<T>(userId: number, state: T, ttlMs = DEFAULT_TTL_MS): void {
    this.sessions.set(userId, { state, expiresAt: Date.now() + ttlMs });
  }

  clear(userId: number): void {
    this.sessions.delete(userId);
  }
}
