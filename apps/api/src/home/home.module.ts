import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OpsModule } from '../ops/ops.module';
import { HeroService } from './hero.service';
import { HomeAdminController, HomeController } from './home.controller';
import { HomeService } from './home.service';

/** Batch HOME — the magazine homepage: composed payload + admin surface. */
@Module({
  imports: [IdentityModule, OpsModule],
  controllers: [HomeController, HomeAdminController],
  providers: [HomeService, HeroService],
})
export class HomeModule {}
