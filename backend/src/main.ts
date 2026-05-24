
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL,
      'https://usevouchit.com',
      'https://www.usevouchit.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ].filter((o): o is string => !!o),
    credentials: true,
  }); // Enable CORS for Next.js frontend
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
