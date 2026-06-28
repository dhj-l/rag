# AGENTS.md — 智能文档助手 (RAG)

## 仓库布局

```
/
├── backend/          # NestJS (commonjs, pnpm)
├── frontend/         # Vue 3 + Vite + Tailwind (esm, pnpm)
├── infra/langfuse/   # Langfuse Docker 编排（独立启动）
├── prd和架构设计/    # PRD + ARCHITECTURE.md（必读）
└── docker-compose.yml # 全服务编排
```

两个子包是独立 `pnpm` workspace 成员（非 monorepo 工具管理），各自有 `pnpm-lock.yaml`。

## 开发命令

| 用途 | 命令 | 目录 |
|------|------|------|
| 后端启动 (watch) | `pnpm start:dev` | `backend/` |
| 后端构建 | `pnpm build` (`nest build`) | `backend/` |
| 后端测试 | `pnpm test` (jest) | `backend/` |
| 后端 seed | `pnpm seed` (tsx) | `backend/` |
| 后端 lint | `pnpm lint` | `backend/` |
| 后端格式化 | `pnpm format` | `backend/` |
| 前端开发 | `pnpm dev` (vite, :5173) | `frontend/` |
| 前端构建 | `pnpm build` (vue-tsc -b && vite build) | `frontend/` |
| 前端类型检查 | `pnpm type-check` (vue-tsc --noEmit) | `frontend/` |
| 启动基础设施 | `docker compose up -d mongodb chroma postgres langfuse` | `/` |
| 全栈启动 | `docker compose up --build -d` | `/` |

**包管理器**: pnpm@10.2.0（两子包均已锁定）。前端无 lint/format scripts。

## 路径别名

- 后端: `@/` → `src/`（`tsconfig.json paths` + `jest moduleNameMapper`）
- 前端: `@/` → `src/`（`vite.config.ts resolve.alias` + `tsconfig paths`）

## 后端要点

- **Jest**: 配置在 `package.json` 内联，`rootDir: src`, `testRegex: ".*\\.spec\\.ts$"`；spec 文件与源文件同目录
- **全局中间件**（`main.ts`）: ValidationPipe (whitelist + forbidNonWhitelisted + transform) + HttpExceptionFilter + TransformInterceptor
- **统一响应**: 成功 `{ code: 200, data, message }`，异常 `{ code, data: null, message }`（`TransformInterceptor` / `HttpExceptionFilter`）
- **SSE**: 手写 `res.write` (非 `@Sse()`)，`Content-Type: text/event-stream`，不走统一响应信封；事件类型 `token/sources/tool/error/done`
- **AI 模块 @Global**: 所有 AI 服务 (PermissionService, LlmService, AgentService 等) 可在各业务模块直接注入
- **构建**: `nest-cli.json` 配置 `deleteOutDir: true`（构建前自动清理 dist）
- **无 ESLint/Prettier 配置文件**（仅有 scripts，采用默认配置）

## 前端要点

- **Vite 代理**: 开发时 `/api` → `http://localhost:3000`
- **SSE**: 使用 `@microsoft/fetch-event-source`（支持 POST + 自定义 header），而非原生 EventSource；封装在 `useSSE` composable 中
- **路由**: `/login` (公开), `/chat/:id?`, `/admin` (需 admin 角色)；根 `/` 重定向到 `/chat`
- **Auth token**: `localStorage` key `da_token`；用户信息 key `da_user`
- **类型同步**: `frontend/src/types/index.ts` 必须与 `backend/src/common/types/common.types.ts` 保持一致

## 权限矩阵

| 角色 | 可访问级别 |
|------|-----------|
| employee | L1 (公开), L2 (部门内部) |
| manager | L1, L2, L3 (保密) |
| ceo / admin | L1, L2, L3, L4 (机密) |

需部门过滤的角色 (employee/manager) 在 L2/L3 级别上还需部门匹配。核心逻辑在 `PermissionService`。

## 常量与约定

- 最大文件上传: 20MB (`MAX_FILE_SIZE`)
- 审计日志 TTL: 90 天
- LLM 使用 `deepseek-chat`（支持工具调用），**不要使用 `deepseek-reasoner`**（不支持工具调用）
- Agent 中间件管道: `dynamicSystemPrompt → summarization(4k tokens) → modelRetry(3) → toolRetry(2)`

## 架构文档

`prd和架构设计/ARCHITECTURE.md` 是详细的架构参考（API 接口、数据模型、权限逻辑、SSE 协议等），遇到需要理解高层次设计时优先阅读。
