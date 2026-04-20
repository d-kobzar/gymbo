import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

/**
 * Thin wrapper around `@nestjs/event-emitter` so feature modules import
 * a project-local symbol. Register once, globally.
 */
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 50,
      verboseMemoryLeak: true,
    }),
  ],
  exports: [EventEmitterModule],
})
export class EventBusModule {}
