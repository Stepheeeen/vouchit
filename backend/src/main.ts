import 'dotenv/config';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Render terminates TLS in front of us. Without this Express reads the
  // socket address for every request, so the rate limiter sees one shared
  // client and throttles the whole world together.
  app.set('trust proxy', 1);

  // The API answered with no security headers at all and advertised
  // `x-powered-by: Express`. These cost nothing and close the easy doors.
  app.use(
    helmet({
      // This is a JSON API, not a document server: a default-src policy here
      // governs nothing the browser renders, and the frontend sets its own.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.disable('x-powered-by');

  const frontendUrl = process.env.FRONTEND_URL;
  app.enableCors({
    origin: [
      frontendUrl,
      'https://usevouchit.com',
      'https://www.usevouchit.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ].filter((o): o is string => !!o),
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
