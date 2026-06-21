import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import type { ApiResponse } from '../types/common.types';

/**
 * 全局异常过滤器（ARCHITECTURE.md §7.2）
 *
 * 统一把异常格式化为 `{ code, data: null, message }`：
 * - HttpException：取其 status + message（数组消息取首条）。
 * - 其他异常：归 500，生产环境不暴露堆栈，message 统一为「服务暂时不可用，请稍后重试」。
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务暂时不可用，请稍后重试';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as { message?: string | string[] };
        message = Array.isArray(r.message) ? r.message[0] : r.message ?? message;
      }
    } else {
      // 未知异常：记录完整堆栈，但不向前端暴露
      this.logger.error(exception);
    }

    const body: ApiResponse = {
      code: status,
      data: null,
      message,
    };

    response.status(status).json(body);
  }
}
