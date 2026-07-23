/**
 * Central registry of application events for the global event bus.
 *
 * The bus is strongly typed off {@link AppEventPayloads}: emitting an event
 * requires the payload declared for its name, and there is a single place to
 * see every event the app can raise.
 *
 * To add a new event:
 *   1. Define its payload class (below).
 *   2. Map its name → payload in {@link AppEventPayloads}.
 *   3. (optional) Add a constant to {@link AppEvent} for ergonomic call sites.
 *
 * Emit:   events.emit(AppEvent.Ping, new PingEvent())
 * Listen: @OnEvent(AppEvent.Ping) handle(e: PingEvent) { ... }
 *
 * Event names use a dotted `domain.action` convention (e.g. `subscription.created`).
 */

/** Example event — replace/extend with real domain events. */
export class PingEvent {
  constructor(public readonly at: Date = new Date()) {}
}

/**
 * The typed contract of the bus: event name → payload type.
 * Every emittable event MUST be declared here.
 */
export interface AppEventPayloads {
  'app.ping': PingEvent;
}

/** Union of all valid event names, derived from the payload map. */
export type AppEventName = keyof AppEventPayloads;

/**
 * Convenience constants for event names so call sites don't hardcode strings.
 * `satisfies` guarantees every value is a declared event name.
 */
export const AppEvent = {
  Ping: 'app.ping',
} as const satisfies Record<string, AppEventName>;
