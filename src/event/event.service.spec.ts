import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEventBus } from './event.service';
import { AppEvent, PingEvent } from './events';

describe('AppEventBus', () => {
  let emitter: EventEmitter2;
  let bus: AppEventBus;

  beforeEach(() => {
    emitter = new EventEmitter2({ delimiter: '.' });
    bus = new AppEventBus(emitter);
  });

  it('delivers the payload to a registered listener', () => {
    const handler = jest.fn();
    emitter.on(AppEvent.Ping, handler);

    const payload = new PingEvent();
    bus.emit(AppEvent.Ping, payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('does not let a throwing listener break the emitter', () => {
    emitter.on(AppEvent.Ping, () => {
      throw new Error('boom');
    });
    const survivor = jest.fn();
    emitter.on(AppEvent.Ping, survivor);

    expect(() => bus.emit(AppEvent.Ping, new PingEvent())).not.toThrow();
    expect(survivor).toHaveBeenCalledTimes(1);
  });

  it('emitAsync awaits async listeners', async () => {
    const seen: string[] = [];
    emitter.on(AppEvent.Ping, async () => {
      await Promise.resolve();
      seen.push('done');
    });

    await bus.emitAsync(AppEvent.Ping, new PingEvent());

    expect(seen).toEqual(['done']);
  });
});
