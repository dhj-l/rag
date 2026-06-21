import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { ApiResponse } from '../types/common.types';

/**
 * 统一响应格式拦截器（ARCHITECTURE.md §7.2）
 *
 * 把控制器返回值包装成 `{ code: 200, data, message: '操作成功' }`。
 * 控制器只需返回业务 data，无需自行包装。
 *
 * 跳过包装的场景：
 * 1. SSE 流式响应（content-type 含 text/event-stream）—— T04 对话接口。
 * 2. 返回值已是 ApiResponse 结构（含 code + message）—— 避免二次包装。
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        // SSE 流：透传
        const contentType = response.getHeader('content-type');
        if (typeof contentType === 'string' && contentType.includes('text/event-stream')) {
          return data;
        }

        // 已是统一响应结构：透传
        if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
          return data;
        }

        return {
          code: 200,
          data,
          message: '操作成功',
        } satisfies ApiResponse<T>;
      }),
    );
  }
}
