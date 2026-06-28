import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from '../chat/message.schema';
import { Session, SessionSchema } from './session.schema';
import { Document, DocumentSchema } from '../document/document.schema';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';

/**
 * 会话模块（§3.6 会话接口）
 *
 * 同时注册 Session 与 Message 两个模型并导出 MongooseModule，
 * 供 ChatModule（imports: [SessionModule]）注入 MessageModel / SessionModel，
 * 避免与 ChatModule 形成循环依赖。
 *
 * SessionService 注入 MessageModel 以返回会话详情的消息历史（§3.6 GET /:id）。
 * F-15：注入 DocumentModel 用于校验会话关联文档的存在性与访问权限。
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Document.name, schema: DocumentSchema }, // F-15 关联文档校验
    ]),
  ],
  providers: [SessionService],
  controllers: [SessionController],
  exports: [SessionService, MongooseModule],
})
export class SessionModule {}
