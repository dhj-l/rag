import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

/**
 * 后端应用入口（ARCHITECTURE.md §2.1 main.ts）
 *
 * 全局中间件：
 * - ValidationPipe：DTO 校验（whitelist + forbidNonWhitelist + transform）
 * - HttpExceptionFilter：统一异常 → { code, data:null, message }（§7.2）
 * - TransformInterceptor：统一成功响应 → { code:200, data, message }（§7.2）
 * - CORS：开放（前端 5173 跨域联调）
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;

  await app.listen(port);
  Logger.log(`🚀 后端已启动：http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
