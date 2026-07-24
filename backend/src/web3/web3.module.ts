import { Module } from '@nestjs/common';
import { Web3Service } from './web3.service';
import { Web3Controller } from './web3.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [Web3Controller],
  providers: [Web3Service],
  exports: [Web3Service],
})
export class Web3Module {}
