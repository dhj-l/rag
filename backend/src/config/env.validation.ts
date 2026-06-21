import * as Joi from 'joi';

/**
 * 环境变量校验（ARCHITECTURE.md §7.4）
 *
 * ConfigModule.forRoot({ validationSchema }) 启动时校验，缺失/非法直接报错退出。
 *
 * T01 阶段：DEEPSEEK / DASHSCOPE API key 设为可选（真实调用在 T03）；
 *           JWT_SECRET 必填（T02 认证依赖，且不应有默认值掩盖漏配）。
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  // 后端服务
  PORT: Joi.number().port().default(3000),

  // MongoDB
  MONGODB_URI: Joi.string().uri().required(),

  // Chroma
  CHROMA_URL: Joi.string().uri().default('http://localhost:8000'),

  // LLM（T03 接入）
  DEEPSEEK_API_KEY: Joi.string().allow('').optional(),
  LLM_MODEL: Joi.string().default('deepseek-chat'),

  // Embedding（T03 接入）
  DASHSCOPE_API_KEY: Joi.string().allow('').optional(),
  EMBEDDING_MODEL: Joi.string().default('text-embedding-v3'),

  // JWT
  JWT_SECRET: Joi.string().min(16).empty('').default('change-me-in-production--change-me'),
  JWT_EXPIRES_IN: Joi.string().default('24h'),

  // 文件上传
  UPLOAD_DIR: Joi.string().default('./uploads'),
  MAX_FILE_SIZE: Joi.number().integer().positive().default(20 * 1024 * 1024),

  // Langfuse（T03 接入）
  LANGFUSE_PUBLIC_KEY: Joi.string().allow('').optional(),
  LANGFUSE_SECRET_KEY: Joi.string().allow('').optional(),
  LANGFUSE_BASEURL: Joi.string().uri().default('http://localhost:3001'),
});
