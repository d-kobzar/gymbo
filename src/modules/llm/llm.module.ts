import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LlmConfig } from '@core/config/llm.config';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';

/**
 * Provider-agnostic LLM facade. Today ships only `openai`; adding
 * `anthropic` / `gemini` / an OpenAI-compatible endpoint is a matter
 * of writing an adapter that implements LlmProvider and registering
 * it in the factory switch below.
 *
 * Downstream code depends on the LLM_PROVIDER injection token — never
 * on a concrete class — so swapping providers requires zero changes
 * outside this module.
 */
@Module({
  providers: [
    OpenAiProvider,
    {
      provide: LLM_PROVIDER,
      useFactory: (config: ConfigService, openai: OpenAiProvider): LlmProvider => {
        const cfg = config.getOrThrow<LlmConfig>('llm');
        switch (cfg.provider) {
          case 'openai':
            return openai;
          default:
            throw new Error(`Unsupported LLM_PROVIDER: ${cfg.provider}`);
        }
      },
      inject: [ConfigService, OpenAiProvider],
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
