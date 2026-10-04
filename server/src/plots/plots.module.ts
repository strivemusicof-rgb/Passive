import { Module } from '@nestjs/common';

import { EconomyService } from '../economy/economy.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { PlotsController } from './plots.controller.js';
import { PlotsService } from './plots.service.js';

@Module({
  controllers: [PlotsController],
  providers: [PlotsService, WalletService, EconomyService],
})
export class PlotsModule {}
