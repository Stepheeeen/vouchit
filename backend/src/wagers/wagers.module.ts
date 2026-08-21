import { Module } from '@nestjs/common';
import { WagersService } from './wagers.service';
import { WagersController } from './wagers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { Web3Module } from '../web3/web3.module';

@Module({
  imports: [PrismaModule, Web3Module],
  providers: [WagersService],
  controllers: [WagersController],
  exports: [WagersService],
})
export class WagersModule {}
