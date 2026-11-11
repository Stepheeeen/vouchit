import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { WagersModule } from './wagers/wagers.module';
import { DisputesModule } from './disputes/disputes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { Web3Module } from './web3/web3.module';

@Module({
  imports: [
    // A global floor on request rate, with tighter per-endpoint limits applied
    // via @Throttle on the auth routes. Nothing was rate limited before this,
    // so a six-digit code could be guessed to exhaustion and the signup
    // endpoint could be driven as a mail cannon.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule,
    UsersModule,
    PrismaModule,
    WagersModule,
    DisputesModule,
    NotificationsModule,
    Web3Module,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
