export * from './event.module';
export * from './event.service';
export * from './events';

// Re-exported so listeners can `import { OnEvent } from 'src/event'` alongside
// the event names, without a separate dependency import.
export { OnEvent } from '@nestjs/event-emitter';
