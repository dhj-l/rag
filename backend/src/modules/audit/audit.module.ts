import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module';
import { AuditLog, AuditLogSchema } from './audit.schema';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

/**
 * 审计模块（§3.2 / §3.6 审计接口）
 *
 * @Global：AuditService 被认证/用户/文档/对话等模块跨模块注入，全局可用。
 * 导入 AiModule 以注入 PermissionService（buildFilterCondition 复用）。
 */
@Global()
@Module({
  imports: [
    AiModule,
    MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]),
  ],
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
