import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from './entity/book.entity';
import { BookService } from './book.services';
import { BookController } from './book.controller';
import { SubscriptionModule } from '../subscription/subscription.module';
// import { BookController } from './book.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Book]), SubscriptionModule],
  exports: [BookService],
  providers: [BookService],
  controllers: [BookController],
})
export class BookModule {}
