import { Injectable, type OnModuleDestroy, type OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'production'
          ? ['error', 'warn']
          : ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Prisma connected');
    } catch (err) {
      this.logger.error('Prisma failed to connect', err as Error);
      // In dev we keep running so the API still starts (health endpoint
      // will surface the failure). In prod, crash hard.
      if (process.env.NODE_ENV === 'production') throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
