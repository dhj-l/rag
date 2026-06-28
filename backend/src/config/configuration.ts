/**
 * 配置加载器（ARCHITECTURE.md §7.4）
 *
 * 供 ConfigModule.forRoot({ load: [configuration] }) 使用，
 * 通过 ConfigService.get('port') / get('jwt.secret') 等访问。
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),

  mongodb: {
    uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/doc_assistant',
  },

  chroma: {
    url: process.env.CHROMA_URL ?? 'http://localhost:8000',
  },

  llm: {
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'deepseek-chat',
  },

  embedding: {
    apiKey: process.env.SILICONFLOW_API_KEY ?? '',
    model: process.env.EMBEDDING_MODEL ?? 'Qwen/Qwen3-Embedding-0.6B',
    baseUrl: process.env.SILICONFLOW_BASE_URL ?? 'https://api.siliconflow.cn/v1',
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  },

  upload: {
    dir: process.env.UPLOAD_DIR ?? './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? String(20 * 1024 * 1024), 10),
  },

  langfuse: {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? '',
    secretKey: process.env.LANGFUSE_SECRET_KEY ?? '',
    baseUrl: process.env.LANGFUSE_BASEURL ?? 'http://localhost:3001',
  },
});
