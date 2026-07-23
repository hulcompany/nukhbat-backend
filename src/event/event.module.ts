import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppEventBus } from './event.service';

/**
 * Global event bus module.
 *
 * `EventEmitterModule.forRoot` registers the underlying `EventEmitter2` and
 * discovers `@OnEvent(...)` listeners across the app. This module exposes the
 * typed {@link AppEventBus} for publishing. Being `@Global`, no other module
 * needs to import it to inject `AppEventBus`.
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      // dotted `domain.action` event names
      delimiter: '.',
      // warn instead of silently leaking when a listener count grows unbounded
      verboseMemoryLeak: true,
    }),
  ],
  providers: [AppEventBus],
  exports: [AppEventBus],
})
export class EventModule {}
