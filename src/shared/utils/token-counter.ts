import { getEncoding, type Tiktoken } from 'js-tiktoken';

/**
 * Lazy-loaded o200k_base encoder — the BPE used by gpt-4o and gpt-4o-mini.
 * Counts are per-turn cheap but we cache the encoder singleton.
 */
let cached: Tiktoken | null = null;
function encoder(): Tiktoken {
  if (!cached) cached = getEncoding('o200k_base');
  return cached;
}

export function countTextTokens(text: string): number {
  if (!text) return 0;
  return encoder().encode(text).length;
}

/**
 * Approximate per-message token cost including the role / wrapper
 * overhead OpenAI adds to chat messages. The constants below mirror
 * OpenAI's "How to count tokens with tiktoken" cookbook — worth
 * ±1–2 tokens per message, which is the right precision for deciding
 * when to fire a summarizer.
 */
export function countMessagesTokens(
  messages: Array<{ role: string; content: string }>,
): number {
  let total = 0;
  for (const msg of messages) {
    total += 4; // role + message separators
    total += countTextTokens(msg.role);
    total += countTextTokens(msg.content);
  }
  return total + 2; // primed reply
}
