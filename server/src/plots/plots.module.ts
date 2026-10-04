import { Module } from '@nestjs/common';

import { EconomyService } from '../economy/economy.service.js';
import { IncomeService } from '../income/income.service.js';
import { AdminController } from '../admin/admin.controller.js';
import { ProgressController } from '../progress/progress.controller.js';
import { ProgressService } from '../progress/progress.service.js';
import { TrackerService } from '../progress/tracker.service.js';
import { RewardsController } from '../rewards/rewards.controller.js';
import { RewardsService } from '../rewards/rewards.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { PlotsController } from './plots.controller.js';
import { PlotsService } from './plots.service.js';

@Module({
  controllers: [PlotsController, ProgressController, RewardsController, AdminController],
  providers: [PlotsService, WalletService, EconomyService, IncomeService, TrackerService, ProgressService, RewardsService],
})
export class PlotsModule {}
