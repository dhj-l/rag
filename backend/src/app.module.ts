import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AiModule } from './modules/ai/ai.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { DocumentModule } from './modules/document/document.module';
import { SessionModule } from './modules/session/session.module';
import { ChatModule } from './modules/chat/chat.module';

/**
 * 健康检查端点（T01 骨架）
 * GET /health → 经 TransformInterceptor 包装为 { code:200, data:{status:'ok'}, message:'操作成功' }
 */
@Controller()
class HealthController {
  @Get('health')
  check() {
    return { status: 'ok' };
  }
}

/**
 * 应用根模块
 *
 * - ConfigModule：全局，加载 configuration + Joi 校验（§7.4）。
 * - DatabaseModule：MongoDB 连接（@Global）。
 * - AiModule：PermissionService（@Global，核心跨模块服务）。
 *
 * 后续任务在 imports 中追加 AuthModule / UserModule / DocumentModule / SessionModule /
 * ChatModule / AuditModule 等。
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),
    DatabaseModule,
    AiModule,
    AuditModule,
    UserModule,
    AuthModule,
    DocumentModule,
    SessionModule,
    ChatModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
