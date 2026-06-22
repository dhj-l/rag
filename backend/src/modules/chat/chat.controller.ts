import { Body, Controller, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { IsNotEmpty, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SSEEventType, UserContext } from '../../common/types/common.types';
import { ChatService } from './chat.service';

/** 对话消息 DTO（§3.6 POST /api/sessions/:id/chat） */
export class ChatMessageDto {
  @IsString()
  @IsNotEmpty({ message: '消息内容不能为空' })
  message!: string;
}

/**
 * 对话控制器（§3.6 SSE 流式接口）
 *
 * 采用 POST + 手写 SSE（@Res）：
 * - NestJS @Sse() 装饰器强制 GET，无法满足 §3.6 的 POST + JSON body + Authorization 头契约；
 * - 前端使用 @microsoft/fetch-event-source（POST + 自定义头），Authorization 头由 JwtAuthGuard 校验。
 *
 * ChatService.streamMessage 为异步生成器，逐事件 res.write，finally res.end()。
 * TransformInterceptor 对 text/event-stream 透传，@Res() 下不干预返回值。
 */
@Controller('api')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('sessions/:id/chat')
  async chat(
    @Param('id') id: string,
    @Body() dto: ChatMessageDto,
    @CurrentUser() user: UserContext,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    try {
      for await (const evt of this.chatService.streamMessage(id, dto.message, user)) {
        res.write(`data: ${JSON.stringify(evt)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: SSEEventType.ERROR, message: String(err) })}\n\n`);
    } finally {
      res.end();
    }
  }
}
