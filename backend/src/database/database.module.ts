import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

/**
 * MongoDB 连接模块（ARCHITECTURE.md §3.2 / §7.4）
 *
 * - @Global()：全局可用，各业务模块无需重复 import。
 * - 通过 ConfigService 读取 MONGODB_URI，连接事件打日志便于排障。
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('mongodb.uri');
        const logger = new Logger('MongoDB');
        return {
          uri,
          onConnectionCreate: () => {
            logger.log(`连接中: ${uri?.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')}`);
          },
        };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
