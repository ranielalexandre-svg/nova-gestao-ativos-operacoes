import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StarlinksController } from './starlinks.controller';
import { StarlinksService } from './starlinks.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StarlinksController],
  providers: [StarlinksService],
})
export class StarlinksModule {}
