import { Module } from '@nestjs/common';
import { WagersService } from './wagers.service';
import { WagersController } from './wagers.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [WagersService],
  controllers: [WagersController],
  exports: [WagersService],
})
export class WagersModule {}
