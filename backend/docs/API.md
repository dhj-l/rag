# 智能文档助手 后端接口调用文档

> 后端基于 NestJS + Mongoose + LangChain，提供认证、用户管理、会话、流式对话、文档管理与检索、审计日志等 HTTP 接口。
> 本文档覆盖全部 **22 个** HTTP 端点（含 F-13 段落级摘要、F-15 会话关联文档、问答热度统计），含鉴权说明、请求/响应示例、错误码与枚举速查。
> 代码注释与架构章节引用见 `prd和架构设计/ARCHITECTURE.md`（§3.6 接口契约）。

***

## 目录

- [1. 概述](#1-概述)
  - [1.1 Base URL](#11-base-url)
  - [1.2 统一响应格式](#12-统一响应格式)
  - [1.3 鉴权方式](#13-鉴权方式)
  - [1.4 全局参数校验](#14-全局参数校验)
- [2. 枚举速查表](#2-枚举速查表)
- [3. 认证模块 Auth](#3-认证模块-auth)
- [4. 用户管理模块 User](#4-用户管理模块-user)
- [5. 会话模块 Session](#5-会话模块-session)
- [6. 对话模块 Chat（SSE）](#6-对话模块-chatsse)
- [7. 文档模块 Document](#7-文档模块-document)
- [8. 审计模块 Audit](#8-审计模块-audit)
- [9. 健康检查 Health](#9-健康检查-health)
- [10. 错误码总表](#10-错误码总表)
- [11. 附录](#11-附录)

***

## 1. 概述

### 1.1 Base URL

```
http://localhost:3000
```

端口由 `PORT` 环境变量控制（默认 3000）。所有业务路由统一前缀 `/api`，健康检查为 `/health`。

### 1.2 统一响应格式

除 SSE 流式接口（`POST /api/sessions/:id/chat`）外，所有接口的成功响应由全局 `TransformInterceptor` 包装为统一信封：

```json
{
  "code": 200,
  "data": { /* 业务数据，失败时为 null */ },
  "message": "操作成功"
}
```

错误响应由全局 `HttpExceptionFilter` 统一包装：

```json
{
  "code": 401,
  "data": null,
  "message": "用户名或密码错误"
}
```

> 文档各接口「成功响应」小节仅展示 `data` 字段内容，省略外层信封。

### 1.3 鉴权方式

采用 JWT Bearer Token。登录成功后获得 `token`，后续请求通过请求头携带：

```
Authorization: Bearer <token>
```

- Token 有效期 **24 小时**（`JWT_EXPIRES_IN` 可配置）。
- Token 载荷（`JwtPayload`）：`sub`（用户 ID）、`username`、`role`、`departments`、`iat`、`exp`。
- 需登录的接口由 `JwtAuthGuard` 守护；admin 接口额外由 `RolesGuard` + `@Roles(Role.ADMIN)` 校验。
- Token 失效（用户被禁用或删除）返回 `401 登录已失效，请重新登录`。

### 1.4 全局参数校验

全局启用 `ValidationPipe`：

- `whitelist: true` —— 自动剥离 DTO 未定义的字段。
- `forbidNonWhitelisted: true` —— 传入未定义字段时直接 400 拒绝。
- `transform: true` —— 查询参数自动按 `@Type` 转换（如 string → number）。

校验失败返回 `400`，`message` 为 class-validator 的中文提示。

***

## 2. 枚举速查表

> 类型源头：`src/common/types/common.types.ts`（§3.7）。

### Role 角色

| 值          | 含义       |
| ---------- | -------- |
| `employee` | 普通员工     |
| `manager`  | 部门主管     |
| `ceo`      | CEO / 高管 |
| `admin`    | 管理员      |

### SecurityLevel 保密级别

| 值    | 含义   |
| ---- | ---- |
| `L1` | 全员公开 |
| `L2` | 部门内部 |
| `L3` | 保密   |
| `L4` | 机密   |

### 角色 × 保密级别 权限矩阵

（`ROLE_ACCESSIBLE_LEVELS`，§3.8）

| 角色         | 可访问保密级别        |
| ---------- | -------------- |
| `employee` | L1, L2         |
| `manager`  | L1, L2, L3     |
| `ceo`      | L1, L2, L3, L4 |
| `admin`    | L1, L2, L3, L4 |

> L2/L3 文档还需「部门匹配」才可访问；L1/L4 的 `department` 固定为 `all`。

### DocumentStatus 文档处理状态

| 值           | 含义                   |
| ----------- | -------------------- |
| `uploaded`  | 已上传，待处理              |
| `parsing`   | 解析中                  |
| `embedding` | 向量化中                 |
| `completed` | 处理完成                 |
| `failed`    | 处理失败（见 errorMessage） |

### FileType 文件类型

| 值          | 含义                        |
| ---------- | ------------------------- |
| `pdf`      | PDF                       |
| `txt`      | 纯文本                       |
| `markdown` | Markdown（.md / .markdown） |

### UserStatus 用户状态

| 值          | 含义 |
| ---------- | -- |
| `active`   | 启用 |
| `disabled` | 禁用 |

### AuditAction 审计操作类型

| 值               | 含义               |
| --------------- | ---------------- |
| `search`        | RAG 检索           |
| `view_document` | 查看文档             |
| `summarize`     | 生成摘要             |
| `upload`        | 上传 / 重索引         |
| `delete`        | 删除               |
| `login`         | 登录               |
| `role_change`   | 角色变更 / 用户创建 / 启停 |

### SSEEventType 对话事件类型

| 值         | 含义     |
| --------- | ------ |
| `token`   | 增量文本片段 |
| `sources` | 检索来源引用 |
| `tool`    | 触发的工具名 |
| `error`   | 异常信息   |
| `done`    | 流结束标记  |

***

## 3. 认证模块 Auth

> 控制器：`src/modules/auth/auth.controller.ts`，路由前缀 `/api/auth`。

### 3.1 用户登录

`POST /api/auth/login` · 公开

用户名密码校验通过后签发 JWT，并记录登录审计。

**请求体**

```json
{
  "username": "admin",
  "password": "123456"
}
```

| 字段         | 类型     | 必填 | 说明         |
| ---------- | ------ | -- | ---------- |
| `username` | string | 是  | 用户名        |
| `password` | string | 是  | 明文密码（≥1 位） |

**成功响应** `data`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "665f1a2b3c4d5e6f7a8b9c0d",
    "username": "admin",
    "displayName": "管理员",
    "role": "admin",
    "departments": [],
    "status": "active",
    "createdAt": "2026-06-01T08:00:00.000Z",
    "updatedAt": "2026-06-01T08:00:00.000Z"
  }
}
```

**可能错误**

| 状态码 | message       | 触发场景                 |
| --- | ------------- | -------------------- |
| 401 | 用户名或密码错误      | 用户名不存在或密码不匹配         |
| 403 | 账号已被禁用，请联系管理员 | 用户 status 为 disabled |

**curl**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

### 3.2 获取当前用户信息

`GET /api/auth/profile` · 需登录

返回当前登录用户的业务字段子集，常用于刷新页面后恢复登录态。

**成功响应** `data`

```json
{
  "userId": "665f1a2b3c4d5e6f7a8b9c0d",
  "username": "admin",
  "role": "admin",
  "departments": []
}
```

**curl**

```bash
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <token>"
```

***

## 4. 用户管理模块 User

> 控制器：`src/modules/user/user.controller.ts`，路由前缀 `/api/users`。
> **全部接口需 admin 角色**。

### 4.1 用户分页列表

`GET /api/users` · admin

**查询参数**

| 参数         | 类型     | 必填 | 默认 | 说明        |
| ---------- | ------ | -- | -- | --------- |
| `page`     | number | 否  | 1  | 页码，最小 1   |
| `pageSize` | number | 否  | 20 | 每页条数，最小 1 |

**成功响应** `data`

```json
{
  "list": [
    {
      "id": "665f1a2b3c4d5e6f7a8b9c0d",
      "username": "admin",
      "displayName": "管理员",
      "role": "admin",
      "departments": [],
      "status": "active",
      "createdAt": "2026-06-01T08:00:00.000Z",
      "updatedAt": "2026-06-01T08:00:00.000Z"
    }
  ],
  "total": 1
}
```

> 返回的 `UserResponse` 不含密码字段。按 `createdAt` 倒序。

**curl**

```bash
curl "http://localhost:3000/api/users?page=1&pageSize=20" \
  -H "Authorization: Bearer <admin-token>"
```

### 4.2 创建用户

`POST /api/users` · admin

**请求体**

```json
{
  "username": "zhangsan",
  "password": "123456",
  "displayName": "张三",
  "role": "employee",
  "departments": ["研发部"]
}
```

| 字段            | 类型        | 必填 | 说明                               |
| ------------- | --------- | -- | -------------------------------- |
| `username`    | string    | 是  | 全局唯一                             |
| `password`    | string    | 是  | 明文，≥6 位，后端 bcrypt 哈希             |
| `displayName` | string    | 是  | 显示名                              |
| `role`        | Role      | 是  | employee / manager / ceo / admin |
| `departments` | string\[] | 是  | 所属部门数组                           |

**成功响应** `data`：`UserResponse`（创建后默认 `status: active`）

**可能错误**

| 状态码 | message | 触发场景          |
| --- | ------- | ------------- |
| 409 | 用户名已存在  | username 已被占用 |

**curl**

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"123456","displayName":"张三","role":"employee","departments":["研发部"]}'
```

### 4.3 更新用户角色/部门

`PATCH /api/users/:id` · admin

**路径参数**

| 参数   | 说明          |
| ---- | ----------- |
| `id` | 用户 ObjectId |

**请求体**（字段均可选，至少传一个）

```json
{
  "role": "manager",
  "departments": ["研发部", "产品部"]
}
```

**成功响应** `data`：`UserResponse`（更新后）

**可能错误**

| 状态码 | message | 触发场景  |
| --- | ------- | ----- |
| 404 | 用户不存在   | id 无效 |

**curl**

```bash
curl -X PATCH http://localhost:3000/api/users/665f1a2b3c4d5e6f7a8b9c0d \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"role":"manager"}'
```

### 4.4 启用/禁用用户

`PATCH /api/users/:id/status` · admin

**路径参数**：`id`（用户 ObjectId）

**请求体**

```json
{ "status": "disabled" }
```

| 字段       | 类型         | 必填 | 说明                |
| -------- | ---------- | -- | ----------------- |
| `status` | UserStatus | 是  | active / disabled |

**成功响应** `data`：`UserResponse`（更新后）

> 启停操作在审计中归入 `role_change`（§3.7 无独立 status 类型），`filterCondition` 记录 before/after。

**curl**

```bash
curl -X PATCH http://localhost:3000/api/users/665f1a2b3c4d5e6f7a8b9c0d/status \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"disabled"}'
```

***

## 5. 会话模块 Session

> 控制器：`src/modules/session/session.controller.ts`，路由前缀 `/api/sessions`。
> **全部接口需登录**；会话隔离由 `SessionService` 保证（仅返回本人会话，不存在与无权限均返回 404）。

### 5.1 创建会话

`POST /api/sessions` · 需登录

**请求体**

```json
{ "title": "如何使用系统" }
```

| 字段      | 类型     | 必填 | 说明                        |
| ------- | ------ | -- | ------------------------- |
| `title` | string | 否  | 缺省为「新会话」；首条消息后自动取前 20 字命名 |

**成功响应** `data`

```json
{
  "id": "6670a1b2c3d4e5f6a7b8c9d0",
  "title": "如何使用系统",
  "lastMessageAt": "2026-06-22T10:00:00.000Z",
  "createdAt": "2026-06-22T10:00:00.000Z",
  "updatedAt": "2026-06-22T10:00:00.000Z"
}
```

**curl**

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"如何使用系统"}'
```

### 5.2 会话列表

`GET /api/sessions` · 需登录

**查询参数**

| 参数         | 类型     | 必填 | 默认 | 说明   |
| ---------- | ------ | -- | -- | ---- |
| `page`     | number | 否  | 1  | 页码   |
| `pageSize` | number | 否  | 50 | 每页条数 |

**成功响应** `data`：`{ list: SessionResponse[], total }`，按 `updatedAt` 倒序。

**curl**

```bash
curl "http://localhost:3000/api/sessions?page=1&pageSize=50" \
  -H "Authorization: Bearer <token>"
```

### 5.3 会话详情

`GET /api/sessions/:id` · 需登录

**路径参数**：`id`（会话 ObjectId）

**成功响应** `data`

```json
{
  "id": "6670a1b2c3d4e5f6a7b8c9d0",
  "title": "如何使用系统",
  "lastMessageAt": "2026-06-22T10:05:00.000Z",
  "createdAt": "2026-06-22T10:00:00.000Z",
  "updatedAt": "2026-06-22T10:05:00.000Z",
  "messages": [
    {
      "id": "6670a1b2c3d4e5f6a7b8c9d1",
      "role": "user",
      "content": "如何上传文档？",
      "toolUsed": null,
      "createdAt": "2026-06-22T10:05:00.000Z"
    },
    {
      "id": "6670a1b2c3d4e5f6a7b8c9d2",
      "role": "assistant",
      "content": "您可以通过文档管理页面上传...",
      "sources": [
        {
          "documentId": "666e...",
          "documentTitle": "使用手册.pdf",
          "chunkContent": "点击上传按钮选择文件...",
          "chunkIndex": 0,
          "page": 1,
          "securityLevel": "L1"
        }
      ],
      "toolUsed": "rag_search",
      "createdAt": "2026-06-22T10:05:01.000Z"
    }
  ]
}
```

> 消息按 `createdAt` 升序。仅本人会话可查。

**可能错误**

| 状态码 | message | 触发场景        |
| --- | ------- | ----------- |
| 404 | 会话不存在   | id 无效或不属于本人 |

### 5.4 重命名会话

`PATCH /api/sessions/:id` · 需登录

**请求体**

```json
{ "title": "新标题" }
```

| 字段      | 类型     | 必填 | 说明   |
| ------- | ------ | -- | ---- |
| `title` | string | 是  | 必填非空 |

**成功响应** `data`：`SessionResponse`（更新后）

**可能错误**：404 会话不存在。

### 5.5 删除会话

`DELETE /api/sessions/:id` · 需登录

删除会话及其全部消息。

**成功响应** `data`：`null`

**可能错误**：404 会话不存在。

**curl**

```bash
curl -X DELETE http://localhost:3000/api/sessions/6670a1b2c3d4e5f6a7b8c9d0 \
  -H "Authorization: Bearer <token>"
```

***

## 6. 对话模块 Chat（SSE）

> 控制器：`src/modules/chat/chat.controller.ts`，路由 `POST /api/sessions/:id/chat`。

### 6.1 流式对话

`POST /api/sessions/:id/chat` · 需登录 · `text/event-stream`

基于 RAG 的流式问答。采用 **POST + 手写 SSE**（`@Res()`），而非 NestJS `@Sse()`（其强制 GET，无法满足 POST + JSON body + Authorization 头契约）。

**请求头**

```
Authorization: Bearer <token>
Content-Type: application/json
Accept: text/event-stream
```

**路径参数**：`id`（会话 ObjectId）

**请求体**

```json
{ "message": "如何上传文档？" }
```

| 字段        | 类型     | 必填 | 说明      |
| --------- | ------ | -- | ------- |
| `message` | string | 是  | 用户提问，非空 |

**响应**：`Content-Type: text/event-stream`，逐帧下发，**不经过统一响应信封**。每帧格式为：

```
data: {"type":"...","content":"..."}\n\n
```

**事件类型**

| type      | 携带字段                      | 说明                                                                                |
| --------- | ------------------------- | --------------------------------------------------------------------------------- |
| `token`   | `content`                 | 增量文本片段，前端拼接展示                                                                     |
| `sources` | `data: SourceReference[]` | RAG 检索到的来源引用（documentId/documentTitle/chunkContent/chunkIndex/page/securityLevel） |
| `tool`    | `name`                    | 触发的工具名（`rag_search` / `summarize_document` / `general_chat`）                      |
| `error`   | `message`                 | 流中异常信息                                                                            |
| `done`    | —                         | 流结束标记                                                                             |

**事件序列示例**

```
data: {"type":"tool","name":"rag_search"}

data: {"type":"sources","data":[{"documentId":"666e...","documentTitle":"使用手册.pdf","chunkContent":"...","chunkIndex":0,"page":1,"securityLevel":"L1"}]}

data: {"type":"token","content":"您"}

data: {"type":"token","content":"可以"}

data: {"type":"token","content":"通过..."}

data: {"type":"done"}
```

**副作用**：流结束后（`finally`，即使客户端中断也执行）持久化用户/助手消息、更新会话 `lastMessageAt`、首条消息自动命名会话标题，并按工具记审计（`rag_search` → `SEARCH`，`summarize_document` → `SUMMARIZE`）。

**可能错误**

| 状态码         | message | 触发场景                                                            |
| ----------- | ------- | --------------------------------------------------------------- |
| 404         | 会话不存在   | id 无效或不属于本人                                                     |
| —（error 事件） | 异常信息    | 流式过程中的内部异常，以 `{"type":"error","message":"..."}` 事件下发而非 HTTP 错误码 |

**前端消费示例**（`@microsoft/fetch-event-source`，支持 POST + 自定义头）

```js
import { fetchEventSource } from '@microsoft/fetch-event-source';

await fetchEventSource(`http://localhost:3000/api/sessions/${sessionId}/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ message: '如何上传文档？' }),
  onmessage(ev) {
    const evt = JSON.parse(ev.data);
    switch (evt.type) {
      case 'token':    // 追加文本
      case 'sources':  // 展示来源引用
      case 'tool':     // 显示工具调用
      case 'error':    // 错误处理
      case 'done':     // 结束
    }
  },
});
```

**curl**

```bash
curl -N -X POST http://localhost:3000/api/sessions/6670a1b2c3d4e5f6a7b8c9d0/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"如何上传文档？"}'
```

> `-N` 禁用缓冲，实时输出 SSE 帧。

***

## 7. 文档模块 Document

> 控制器：`src/modules/document/document.controller.ts`，路由前缀 `/api/documents`。
> `upload` / `updateSecurity` / `remove` 仅 admin；`list` / `status` / `summary` 全部已认证角色（按权限矩阵过滤）。

### 7.1 上传文档

`POST /api/documents/upload` · admin · `multipart/form-data` · HTTP 201

**请求体**（multipart）

| 字段              | 位置 | 类型            | 必填       | 说明                        |
| --------------- | -- | ------------- | -------- | ------------------------- |
| `file`          | 文件 | binary        | 是        | pdf/txt/md/markdown/docx，≤20MB |
| `title`         | 表单 | string        | 是        | 文档标题                      |
| `securityLevel` | 表单 | SecurityLevel | 是        | L1/L2/L3/L4               |
| `department`    | 表单 | string        | L2/L3 必填 | 所属部门；L1/L4 可省略，默认 `all`   |

**文件类型约束**：扩展名与 MIME 双校验（`documentFileFilter`）。允许 `.pdf / .txt / .md / .markdown / .docx`，MIME 含 `application/pdf`、`text/plain`、`text/markdown`、`application/octet-stream`（兜底）、`application/vnd.openxmlformats-officedocument.wordprocessingml.document`（.docx，F-12）。

**成功响应** `data`（HTTP 201）

```json
{
  "documentId": "666e1a2b3c4d5e6f7a8b9c0e",
  "status": "uploaded"
}
```

> 上传后异步触发解析/向量化流水线，不阻塞响应。用 `GET /:id/status` 轮询进度。

**可能错误**

| 状态码 | message                          | 触发场景           |
| --- | -------------------------------- | -------------- |
| 400 | 未收到上传文件                          | 缺少 file 字段     |
| 400 | 不支持的文件类型，仅允许 pdf/txt/md/markdown/docx | 扩展名/MIME 不在白名单 |
| 413 | 文件大小不能超过 20MB                    | 超过大小限制         |

**curl**

```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer <admin-token>" \
  -F "file=@/path/to/manual.pdf" \
  -F "title=使用手册" \
  -F "securityLevel=L1"
```

### 7.2 文档列表

`GET /api/documents` · 需登录

按角色×保密级别权限矩阵过滤，仅返回当前用户可访问的文档。

**查询参数**

| 参数         | 类型     | 必填 | 默认 | 说明   |
| ---------- | ------ | -- | -- | ---- |
| `page`     | number | 否  | 1  | 页码   |
| `pageSize` | number | 否  | 20 | 每页条数 |

**成功响应** `data`

```json
{
  "list": [
    {
      "id": "666e1a2b3c4d5e6f7a8b9c0e",
      "title": "使用手册",
      "filename": "manual.pdf",
      "fileType": "pdf",
      "fileSize": 1048576,
      "securityLevel": "L1",
      "department": "all",
      "status": "completed",
      "chunkCount": 12,
      "uploadedBy": "665f1a2b3c4d5e6f7a8b9c0d",
      "createdAt": "2026-06-20T08:00:00.000Z",
      "updatedAt": "2026-06-20T08:01:30.000Z"
    }
  ],
  "total": 1
}
```

> `DocumentResponse` 已剥离 `filePath`。按 `createdAt` 倒序。

**curl**

```bash
curl "http://localhost:3000/api/documents?page=1&pageSize=20" \
  -H "Authorization: Bearer <token>"
```

### 7.3 查询文档索引状态

`GET /api/documents/:id/status` · 需登录

**路径参数**：`id`（文档 ObjectId）

**成功响应** `data`

```json
{
  "documentId": "666e1a2b3c4d5e6f7a8b9c0e",
  "status": "completed",
  "chunkCount": 12
}
```

> `chunkCount` / `errorMessage` 为可选字段，仅在有值时返回；`failed` 状态下含 `errorMessage`。

**可能错误**

| 状态码 | message   | 触发场景  |
| --- | --------- | ----- |
| 404 | 文档不存在     | id 无效 |
| 403 | 没有权限访问该文档 | 无访问权限 |

### 7.4 获取文档摘要

`GET /api/documents/:id/summary` · 需登录

直接读取文件内容 + LLM 生成摘要（≤200 字，不经过 Agent）。

**路径参数**：`id`（文档 ObjectId）

**成功响应** `data`

```json
{
  "summary": "本文档介绍了系统的上传、检索与权限管理流程……",
  "documentTitle": "使用手册"
}
```

> 副作用：记录 `SUMMARIZE` 审计。

**可能错误**

| 状态码 | message     | 触发场景       |
| --- | ----------- | ---------- |
| 404 | 文档不存在       | id 无效      |
| 404 | 文档文件不可用     | 文件路径缺失或已删除 |
| 403 | 没有权限查看该文档摘要 | 无摘要查看权限    |

### 7.5 调整文档保密级别/部门（重索引）

`PATCH /api/documents/:id` · admin

变更保密级别或部门后，清理旧向量索引并异步重新分块/向量化/入库。

**路径参数**：`id`（文档 ObjectId）

**请求体**

```json
{ "securityLevel": "L2", "department": "研发部" }
```

| 字段              | 类型            | 必填       | 说明                       |
| --------------- | ------------- | -------- | ------------------------ |
| `securityLevel` | SecurityLevel | 是        | 新保密级别                    |
| `department`    | string        | L2/L3 必填 | 新所属部门；L1/L4 可省略，默认 `all` |

**成功响应** `data`：`DocumentResponse`（`status` 回到 `uploaded`/`parsing`，触发重索引）

**可能错误**

| 状态码 | message        | 触发场景       |
| --- | -------------- | ---------- |
| 404 | 文档不存在          | id 无效      |
| 400 | 文档文件不可用，无法重新索引 | 文件路径缺失或已删除 |

### 7.6 删除文档

`DELETE /api/documents/:id` · admin

best-effort 删除文件 + 向量库索引 + MongoDB 记录。

**路径参数**：`id`（文档 ObjectId）

**成功响应** `data`：`null`

> 副作用：记录 `DELETE` 审计。

**可能错误**

| 状态码 | message | 触发场景  |
| --- | ------- | ----- |
| 404 | 文档不存在   | id 无效 |

**curl**

```bash
curl -X DELETE http://localhost:3000/api/documents/666e1a2b3c4d5e6f7a8b9c0e \
  -H "Authorization: Bearer <admin-token>"
```

***

## 8. 审计模块 Audit

> 控制器：`src/modules/audit/audit.controller.ts`，路由前缀 `/api/audit`。

### 8.1 审计日志分页查询

`GET /api/audit/logs` · admin

**查询参数**（均可选）

| 参数         | 类型          | 说明                                                                     |
| ---------- | ----------- | ---------------------------------------------------------------------- |
| `page`     | number      | 页码，默认 1                                                                |
| `pageSize` | number      | 每页条数，默认 20                                                             |
| `action`   | AuditAction | 精确过滤（search/view\_document/summarize/upload/delete/login/role\_change） |
| `username` | string      | 用户名模糊匹配，大小写不敏感                                                         |

**成功响应** `data`

```json
{
  "list": [
    {
      "id": "6671a1b2c3d4e5f6a7b8c9d3",
      "userId": "665f1a2b3c4d5e6f7a8b9c0d",
      "username": "admin",
      "action": "login",
      "resource": null,
      "resourceId": null,
      "filterCondition": null,
      "resultCount": null,
      "ipAddress": "127.0.0.1",
      "createdAt": "2026-06-22T10:00:00.000Z",
      "expiresAt": "2026-09-20T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

> 审计日志 TTL 90 天（`expiresAt = createdAt + 90d`，到期自动删除）。按 `createdAt` 倒序。

**curl**

```bash
curl "http://localhost:3000/api/audit/logs?page=1&pageSize=20&action=login" \
  -H "Authorization: Bearer <admin-token>"
```

***

## 9. 健康检查 Health

> 控制器：`src/app.module.ts` 内嵌 `HealthController`。

### 9.1 健康检查

`GET /health` · 公开

**成功响应**（经统一信封包装）

```json
{
  "code": 200,
  "data": { "status": "ok" },
  "message": "操作成功"
}
```

**curl**

```bash
curl http://localhost:3000/health
```

***

## 10. 错误码总表

| HTTP 状态码 | 触发场景                         | 典型接口                              |
| -------- | ---------------------------- | --------------------------------- |
| 200      | 请求成功（默认）                     | 所有 GET / PATCH / DELETE 成功        |
| 201      | 资源创建成功                       | `POST /api/documents/upload`      |
| 400      | 参数校验失败 / 文件类型不支持 / 文件不可用重新索引 | 所有接口（ValidationPipe）、上传、重索引       |
| 401      | 未登录 / Token 失效 / 用户名或密码错误    | 登录、需登录接口                          |
| 403      | 无权限（角色不足 / 文档权限不足 / 账号禁用）    | admin 接口、文档 status/summary、登录禁用账号 |
| 404      | 资源不存在（会话/文档/用户不存在，或会话非本人）    | 会话、文档、用户相关接口                      |
| 409      | 资源冲突（用户名已存在）                 | 创建用户                              |
| 413      | 文件超过 20MB                    | 上传文档                              |

> 错误响应统一为 `{ code, data: null, message }`，`message` 为中文提示。
> 对话接口（SSE）的流中异常不返回 HTTP 错误码，而是以 `{"type":"error","message":"..."}` 事件下发。

***

## 11. 附录

### 11.1 文件上传约束

- **最大大小**：20MB（`MAX_FILE_SIZE`，§7.5 / §7.4）。
- **支持类型**：`.pdf` / `.txt` / `.md` / `.markdown`。
- **校验方式**：扩展名 + MIME 双校验；`application/octet-stream` 作为 `.md`/`.txt` 的兜底 MIME。

### 11.2 保密级别与部门联动规则

| 保密级别 | department 取值 | 访问范围          |
| ---- | ------------- | ------------- |
| L1   | `all`（固定）     | 全员可访问         |
| L2   | 具体部门名（必填）     | 同部门 + 更高权限角色  |
| L3   | 具体部门名（必填）     | 同部门 + 更高权限角色  |
| L4   | `all`（固定）     | 仅 ceo / admin |

- 上传（`UploadDocumentDto`）与重索引（`UpdateDocumentSecurityDto`）中，`securityLevel` 为 `L2`/`L3` 时 `department` 必填，否则 400。
- `L1`/`L4` 的 `department` 后端固定为 `all`。
- 重索引会清除旧向量并按新 `metadata`（securityLevel + department）重新入库。

### 11.3 统一信封与拦截器

- `TransformInterceptor`：成功响应包装为 `{ code:200, data, message:'操作成功' }`；对 `text/event-stream` 透传。
- `HttpExceptionFilter`：异常统一为 `{ code, data:null, message }`。
- 全局 `ValidationPipe`：`whitelist + forbidNonWhitelisted + transform`。

### 11.4 相关源码索引

| 关注点         | 文件                                                                            |
| ----------- | ----------------------------------------------------------------------------- |
| 公共类型/枚举     | `src/common/types/common.types.ts`                                            |
| 统一响应拦截器     | `src/common/interceptors/transform.interceptor.ts`                            |
| 异常过滤器       | `src/common/filters/http-exception.filter.ts`                                 |
| JWT 守卫 / 策略 | `src/common/guards/jwt-auth.guard.ts`、`src/modules/auth/jwt.strategy.ts`      |
| 角色守卫 / 装饰器  | `src/common/guards/roles.guard.ts`、`src/common/decorators/roles.decorator.ts` |
| 当前用户装饰器     | `src/common/decorators/current-user.decorator.ts`                             |
| 权限矩阵实现      | `src/modules/ai/permission.service.ts`                                        |

