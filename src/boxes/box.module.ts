import { Module } from '@nestjs/common';
import { BoxesController } from './box.controller';
import { BoxesService } from './box.service';

@Module({
  controllers: [BoxesController],
  providers: [BoxesService],
  exports: [BoxesService],
})
export class BoxesModule {}
