# 培训考勤系统 - 云部署指南

## 架构

```
GitHub 代码 → Vercel 自动部署（免费）→ 全球 CDN 访问
                ↓
         Neon PostgreSQL（免费 0.5GB）
```

**每月费用：￥0**

## 第一步：创建 GitHub 仓库

1. 打开 https://github.com ，登录你的账号
2. 点击右上角 "+" → "New repository"
3. 仓库名填 `training-attendance`，选择 Private（私有）
4. 点击 "Create repository"
5. 记下仓库地址，如 `https://github.com/你的用户名/training-attendance`

## 第二步：推送代码到 GitHub

```bash
cd D:\training-attendance

# 初始化 Git（如果还没做）
git init
git add .
git commit -m "培训考勤系统 v1.0"

# 推送到 GitHub
git remote add origin https://github.com/你的用户名/training-attendance.git
git branch -M main
git push -u origin main
```

## 第三步：创建免费 PostgreSQL 数据库

1. 打开 https://neon.tech ，点击 "Sign Up"（用 GitHub 账号注册）
2. 创建新项目，选择区域（选离你最近的，如新加坡）
3. 创建后，复制数据库连接 URL，格式类似：
   ```
   postgresql://training_owner:xxxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/training?sslmode=require
   ```

## 第四步：切换项目到 PostgreSQL

修改 `prisma/schema.prisma` 第 5 行：
```
// 改前：
datasource db {
  provider = "sqlite"
}

// 改后：
datasource db {
  provider = "postgresql"
}
```

## 第五步：部署到 Vercel

1. 打开 https://vercel.com ，用 GitHub 账号登录
2. 点击 "New Project"
3. 导入你的 `training-attendance` 仓库
4. 配置环境变量：
   - `DATABASE_URL` = Neon 的数据库连接 URL
   - `JWT_SECRET` = 随机字符串（如：`my-super-secret-key-2024`）
   - `NEXT_PUBLIC_BASE_URL` = `https://你的域名.vercel.app`
5. 点击 "Deploy"

## 第六步：初始化数据库

部署完成后，在 Vercel 项目设置中找到 Terminal，运行：

```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

或者本地运行（需要先安装 PostgreSQL 客户端）：

```bash
DATABASE_URL="你的Neon数据库URL" npx prisma migrate deploy
```

## 第七步：登录使用

1. 访问 Vercel 给你的域名：`https://xxx.vercel.app`
2. 用 admin / admin123 登录
3. 开始使用！

## 域名自定义（可选）

在 Vercel 项目设置 → Domains 中添加你自己的域名。

## 注意事项

- Neon 免费版：0.5GB 存储，足够存几万条考勤记录
- Vercel 免费版：100GB 带宽/月，部门使用完全够
- 建议每月备份一次数据（Neon 控制台可以导出）
- 如果流量变大，Vercel Pro 每月 $20，Neon 也可以升级
