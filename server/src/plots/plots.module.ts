import { Module } from '@nestjs/common';

import { EconomyService } from '../economy/economy.service.js';
import { IncomeService } from '../income/income.service.js';
import { AdminController } from '../admin/admin.controller.js';
import { AdmobVerifier } from '../ads/admob.verifier.js';
import { AdsController } from '../ads/ads.controller.js';
import { AdsService } from '../ads/ads.service.js';
import { CosmeticsController } from '../cosmetics/cosmetics.controller.js';
import { CosmeticsService } from '../cosmetics/cosmetics.service.js';
import { LeaderboardController } from '../leaderboard/leaderboard.controller.js';
import { LeaderboardService } from '../leaderboard/leaderboard.service.js';
import { MarketController } from '../market/market.controller.js';
import { MarketService } from '../market/market.service.js';
import { ProgressController } from '../progress/progress.controller.js';
import { ProgressService } from '../progress/progress.service.js';
import { TrackerService } from '../progress/tracker.service.js';
import { RewardsController } from '../rewards/rewards.controller.js';
import { RewardsService } from '../rewards/rewards.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { PlotsController } from './plots.controller.js';
import { PlotsService } from './plots.service.js';

@Module({
  controllers: [PlotsController, ProgressController, RewardsController, AdminController, AdsController, MarketController, LeaderboardController, CosmeticsController],
  providers: [PlotsService, WalletService, EconomyService, IncomeService, TrackerService, ProgressService, RewardsService, AdsService, AdmobVerifier, MarketService, LeaderboardService, CosmeticsService],
})
export class PlotsModule {}
