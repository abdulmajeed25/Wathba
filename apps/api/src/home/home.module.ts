import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { HomeAdminController, HomeController } from './home.controller';
import { HomeService } from './home.service';

/** Batch HOME — the magazine homepage: composed payload + admin surface. */
@Module({
  imports: [IdentityModule],
  controllers: [HomeController, HomeAdminController],
  providers: [HomeService],
})
export class HomeModule {}
