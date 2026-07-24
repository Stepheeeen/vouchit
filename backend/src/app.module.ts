import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { LedgerModule } from './ledger/ledger.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { WagersModule } from './wagers/wagers.module';
import { DisputesModule } from './disputes/disputes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { Web3Module } from './web3/web3.module';

@Module({
  imports: [AuthModule, LedgerModule, UsersModule, PrismaModule, WagersModule, DisputesModule, NotificationsModule, Web3Module],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
