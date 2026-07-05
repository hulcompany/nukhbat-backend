import { Client } from 'pg';

type SoftDeletePayload = {
  eventId?: string;
  id: string;
  path?: string;
  type?: string;
  deletedAt?: string;
};

type Handler = (payload: SoftDeletePayload) => void | Promise<void>;

export class FilePgListener {
  private client: Client;
  private running = false;
  private handler: Handler;

  constructor(
    connectionString: string,
    handler: Handler
  ) {
    this.client = new Client({ connectionString });
    this.handler = handler;
  }

  async start() {
    if (this.running) return;
    this.running = true;

    await this.connect();

    this.client.on('notification', async (msg) => {
        
      if (!msg.payload) return;

      try {
        const payload: SoftDeletePayload = JSON.parse(msg.payload);
        await this.handler(payload);
      } catch (err) {
        console.error('Invalid soft delete payload:', msg.payload, err);
      }
    });

    this.client.on('error', async (err) => {
      console.error('PG listener error:', err);
      this.running = false;

      // naive reconnect loop
      setTimeout(() => this.start(), 3000);
    });
  }

  private async connect() {
    await this.client.connect();
    await this.client.query('LISTEN app_file_soft_delete');
  }

  async stop() {
    this.running = false;
    await this.client.end();
  }
}