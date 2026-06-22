import { Body, Controller, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { IsNotEmpty, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SSEEventType, UserContext } from '../../common/types/common.types';
import { ChatService } from './chat.service';

/** 对话消息 DTO（§3.6 POST /api/sessions/:id/chat） */
export class ChatMessageDto {
  /** 用户提问内容，非空字符串；作为 SSE 流的输入 */
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

  /**
   * 流式对话（POST /api/sessions/:id/chat，需登录，SSE）
   *
   * - 权限：需登录；会话需归属本人（否则 404）。
   * - 路径参数：id（会话 ObjectId）。
   * - 请求体：ChatMessageDto（message，非空字符串）。
   * - 响应：`Content-Type: text/event-stream`，逐帧 `data: {SSEEvent}\n\n`，不走统一响应信封。
   *   - token：增量文本片段（content）
   *   - sources：检索到的来源引用（data: SourceReference[]）
   *   - tool：触发的工具名（name，如 rag_search / summarize_document）
   *   - error：异常信息（message）
   *   - done：流结束标记
   * - 副作用：流结束后持久化用户/助手消息、更新会话时间与标题、按工具记审计（finally 保证中断也执行）。
   * - 错误：404 会话不存在；流中异常以 error 事件下发而非 HTTP 错误码。
   */
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
