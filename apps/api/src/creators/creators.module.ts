import { Module } from '@nestjs/common';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';

/**
 * Creators bounded context — public creator profile read + follow / unfollow.
 * Depends only on the global PrismaModule. Wire into AppModule.imports[] to
 * mount the routes.
 */
@Module({
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
