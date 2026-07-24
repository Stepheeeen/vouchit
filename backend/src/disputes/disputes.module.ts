import { Module } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { PrismaModule } from '../prisma/prisma.module';
import { Web3Module } from '../web3/web3.module';

@Module({
  imports: [PrismaModule, Web3Module],
  controllers: [DisputesController],
  providers: [DisputesService],
})
export class DisputesModule {}
