# 雷鸟培训系统 - Codex 交接说明

更新时间：2026-07-15

## 1. 项目概况

- 本地仓库：`C:\Users\zengluoqin\Documents\Codex\2026-07-04\w\work\training`
- GitHub：`Kk-bot-zeng/training`
- 主分支：`main`
- 生产域名：`https://www.kkzlqnb.top`
- 部署平台：Vercel，GitHub 更新后自动部署
- 数据库：Neon PostgreSQL
- 文件存储：Vercel Blob，Store 名称为 `training-blob`
- 技术栈：Next.js 16、React 19、Ant Design 6、Prisma 7、Neon、Vercel Blob
- UI 风格：深海蓝专业风（方案 C），后续功能应保持现有设计语言

## 2. 安全要求

- 不要把 GitHub PAT、Neon 连接串、数据库密码、JWT 密钥或 Blob 凭据写入代码或文档。
- 用户曾在旧对话中暴露 GitHub PAT 和数据库凭据，应提醒用户撤销/轮换，但不要复述凭据。
- `prisma/seed.ts` 中曾有硬编码数据库连接串，已经移除。
- 所有管理端写操作应使用 `getAuthAdmin()` 校验管理员身份。

## 3. Vercel 环境

生产环境应包含：

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_BASE_URL`
- `BLOB_STORE_ID`
- `BLOB_WEBHOOK_PUBLIC_KEY`
- Vercel 自动提供的 OIDC 请求身份

新版 Blob 上传使用 `BLOB_STORE_ID + @vercel/oidc`，不是旧版只依赖 `BLOB_READ_WRITE_TOKEN` 的流程。

## 4. 常用命令

项目的 `npm run build` 会先执行 `prisma db push`，可能直接连接生产数据库。仅做本地代码构建验证时使用占位变量：

```powershell
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/training'
$env:JWT_SECRET='build-verification-secret-at-least-32-characters'
$env:NEXT_PUBLIC_BASE_URL='https://training.example.com'
npx prisma generate
npx next build
```

部署构建脚本：

```text
prisma db push && next build
```

## 5. GitHub 与部署注意事项

- 本机普通 `git push` 曾因 Git Credential Manager 不可用而失败。
- 旧会话通过 GitHub REST API 创建 blob/tree/commit 并更新 `refs/heads/main`。
- 不要把 PAT 写入脚本或提交；新会话应让用户提供安全认证方式，或先尝试修复 `git push`。
- REST API 创建的远程提交 SHA 会与本地提交 SHA 不同，这是正常现象。
- 最近一次本地提交：`392ba65 Add confirmed cascading account deletion`
- 最近一次对应远程提交：`52f1b9b941014496f5695888e973b77dd5879b5d`
- 最近一次 Vercel 状态已确认 `success`。

## 6. 已完成功能

### 登录与学员端

- 系统名称改为“雷鸟培训系统”。
- 学员支持工号或姓名加密码登录。
- 学员端页面和数据加载做过性能优化。
- 学习资料从管理员培训档案同步，展示主题、时间、讲师、状态、课件和录屏。

### 签到

- 首次绑定设备，90 天免登录。
- 动态二维码、防代签、签到审计。
- 开始培训后立即允许签到。
- 微信扫码兼容，不使用定位。
- 数据模型：`DeviceBinding`、`CheckinAudit`。

### 考试

- 修复试卷发布、选题、删除、选项显示、提交 404 和自动判分。
- 正式考试可限制一次，模拟试卷可重复练习。
- 管理员可查看成绩、错题、练习次数。
- 问答题支持人工评分。

### 培训档案和导出

- 中文文件名导出使用 RFC 5987，XLSX 下载已验证。
- 培训档案支持课件和录屏，学员端自动同步。
- Vercel Blob 本地课件上传支持 PPT、PPTX、PDF，单文件上限 50MB。
- Blob 上传相关代码：
  - `src/app/admin/training-records/page.tsx`
  - `src/app/api/uploads/materials/route.ts`
- Blob 使用 `uploadPresigned()`、`handleUploadPresigned()`、`issueSignedToken()` 和 `getVercelOidcToken()`。
- 上传路径由客户端生成一次固定安全路径，避免签名路径和实际路径不一致。

### 员工导入

- Excel 模板表头已改为：`姓名、部门、密码`。
- 不导入工号和手机号，二者保存为空。
- 密码通过 bcrypt 加密后保存。
- `Employee.employeeNo` 已改为 `String? @unique`。
- 导入 API 会幂等执行 `ALTER TABLE "Employee" ALTER COLUMN "employeeNo" DROP NOT NULL`，兼容旧生产数据库。
- 相关代码：
  - `src/app/admin/employees/page.tsx`
  - `src/app/api/employees/import/route.ts`
  - `src/lib/excel.ts`

### 删除功能

- 部门管理：确认后删除部门及其所有员工和关联数据。
- 员工管理：确认后彻底删除员工账号和关联数据，不再只是设置离职。
- 删除顺序包含 `CheckinAudit`、`Attendance`、`ExamAttempt`、`DeviceBinding`、`Employee`，使用 Prisma 事务，失败会整体回滚。
- 前端确认框明确提示不可恢复，API 使用 `getAuthAdmin()`。

## 7. 数据模型

Prisma 主要模型：

- `Department`
- `Employee`
- `DeviceBinding`
- `CheckinAudit`
- `Admin`
- `Training`
- `Attendance`
- `TrainingRecord`
- `ExamQuestion`
- `ExamPaper`
- `ExamPaperQuestion`
- `ExamAttempt`

数据库定义位于 `prisma/schema.prisma`。

## 8. 优先复测事项

以下代码已修复、构建和部署，但用户尚未反馈最终复测结果，新会话应优先确认：

1. 管理员培训档案上传中文名称的 PPT/PPTX/PDF，保存后学员端能否打开。
2. 员工 Excel 按“姓名、部门、密码”导入两名以上无工号员工，是否全部成功，并能用姓名和密码登录。
3. 部门删除确认框是否显示员工数量，确认后部门和员工是否彻底删除。
4. 单个员工“删除账号”是否会删除账号及关联考勤、考试和设备数据。

如果 Blob 上传仍失败，当前前端会先手工请求一次预签名接口并显示服务端原始错误，应基于真实错误修复，不要猜测。

## 9. 协作偏好

- 用户希望尽量自动完成代码、构建、推送和部署，不希望反复手工操作。
- 修改后应完成生产构建并等待 Vercel 状态为 `success`。
- 不修改无关业务逻辑，保持现有深海蓝 UI。
- 遇到线上故障应收集真实接口错误或日志后修复，不做无依据猜测。

## 10. 新会话启动提示

新会话可以直接发送：

```text
请打开项目 training，先阅读 PROJECT_HANDOFF.md 和 AGENTS.md，然后检查 git status，继续维护雷鸟培训系统。请优先复测交接文档中的待验证事项，不要改动无关功能。
```
