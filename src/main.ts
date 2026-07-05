import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import {
  initialize,
  createErrorRequestHandler,
  BaseResponseInterceptor,
} from 'core';

import qs from 'qs';
import { GlobalExceptionFilter } from './common';

async function bootstrap() {
  await initialize();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  let expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('query parser', (str: string) => qs.parse(str));

  // manual API test console (test-ui/) — dev only, never served in prod
  // if (process.env.NODE_ENV !== 'prod') {
    app.useStaticAssets(join(process.cwd(), 'test-ui'), {
      prefix: '/test-ui',
    });
  // }
  expressApp.get('/api/errors', createErrorRequestHandler());
  expressApp.get('/api/ping', (req, res) => {
    res.send('pong');
  });
  app.useGlobalInterceptors(new BaseResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());
  // app.useGlobalGuards(app.get(ClientVersionGuard))
  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(process.env.PORT!, '0.0.0.0');
}

bootstrap().then(() => {
  console.log('STARTED');
});
