import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const redis = new Redis({
          host: process.env.REDIS_URL,
          port: Number(process.env.REDIS_PORT),
        });

        redis.on('connect', () => {
          console.log('-- Redis connected --');
        });

        redis.on('error', (err) => {
          console.error('Redis error:', err);
        });

        return redis;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
