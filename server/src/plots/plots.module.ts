import { Module } from '@nestjs/common';

import { EconomyService } from '../economy/economy.service.js';
import { IncomeService } from '../income/income.service.js';
import { ProgressController } from '../progress/progress.controller.js';
import { ProgressService } from '../progress/progress.service.js';
import { TrackerService } from '../progress/tracker.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { PlotsController } from './plots.controller.js';
import { PlotsService } from './plots.service.js';

@Module({
  controllers: [PlotsController, ProgressController],
  providers: [PlotsService, WalletService, EconomyService, IncomeService, TrackerService, ProgressService],
})
export class PlotsModule {}
