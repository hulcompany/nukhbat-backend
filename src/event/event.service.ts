import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEventName, AppEventPayloads } from './events';

/**
 * Global, strongly-typed event bus.
 *
 * A thin wrapper over Nest's {@link EventEmitter2} that constrains every emit
 * to the {@link AppEventPayloads} contract. Inject it anywhere to publish
 * domain events; subscribe with the `@OnEvent(name)` decorator on any provider.
 *
 * Emission is fire-and-forget by default — a throwing listener does not affect
 * the emitter or other listeners. Use {@link emitAsync} when you need to await
 * async listeners (e.g. before completing the originating request).
 */
@Injectable()
export class AppEventBus {
  constructor(private readonly emitter: EventEmitter2) {}

  /**
   * Publish an event. Returns synchronously; listeners run in registration
   * order and their results (and errors) are ignored.
   */
  emit<E extends AppEventName>(event: E, payload: AppEventPayloads[E]): void {
    this.emitter.emit(event, payload);
  }

  /**
   * Publish an event and await all listeners (including async ones),
   * resolving with their return values.
   */
  emitAsync<E extends AppEventName>(
    event: E,
    payload: AppEventPayloads[E],
  ): Promise<unknown[]> {
    return this.emitter.emitAsync(event, payload);
  }
}
