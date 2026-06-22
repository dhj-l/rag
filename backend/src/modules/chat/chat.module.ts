import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';

/**
 * 对话模块（§3.6 SSE 对话接口）
 *
 * imports SessionModule 以注入 SessionModel + MessageModel（由 SessionModule 注册并导出）。
 * AgentService / AuditService 为 @Global 全局服务，无需 import。
 */
@Module({
  imports: [SessionModule],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
