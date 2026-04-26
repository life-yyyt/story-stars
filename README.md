# Story Stars

Story Stars is a mobile 3D story universe where every story becomes a star.

这是一个基于 `Expo + React Native + Three.js + Supabase` 的产品原型：用户进入首页就是一片可交互的宇宙，发布一篇故事，就会在宇宙里生成一颗新的星。

## What It Does

- `3D Universe`: 首页是可拖拽、可缩放、可点星阅读的 3D 星空
- `Story -> Star`: 每篇故事对应一颗星星
- `Anonymous Publish`: 用户无需先显式注册，发布时自动创建匿名身份
- `Public / Private`: 公开星所有人可读，私密星只允许作者本人读取正文
- `Coordinate Locate`: 可以通过坐标码定位一颗星
- `Light Up`: 每个身份对同一颗星只能点亮一次，亮度会随点亮增长
- `Star Remnants`: 删除故事后，正文消失，但残影星体仍会留在宇宙里

## Current Status

当前项目已经从 Expo 初始模板收敛为一条明确主线：

- 路由层：`Universe / Compose / My Stars / Login`
- 前端主体验：`src/features/universe-lab`
- 数据层：`Demo backend + Supabase backend`
- 账号策略：匿名身份优先，手机号保护入口保留但默认关闭

当前优先级是把核心链路打磨稳定：

- 进入宇宙
- 发布故事
- 点星阅读
- 点亮
- 坐标定位
- 删除并保留残影

## Tech Stack

- `Expo`
- `React Native`
- `expo-router`
- `@react-three/fiber`
- `three`
- `Supabase`
- `TypeScript`

## Project Structure

```text
app/
  (tabs)/
    index.tsx        # 宇宙首页入口
    compose.tsx      # 发布 / 编辑
    stars.tsx        # 我的星星
  login.tsx          # 手机号保护入口

src/
  components/
    story/           # 故事表单、列表卡片
    ui/              # 极简 UI 基础组件
  context/
    app-context.tsx  # 全局业务状态中枢
  features/
    universe-lab/    # 当前实际使用的 3D 宇宙实现
    universe-runtime/# 跨页面定位 focus intent
  services/
    demo-backend.ts
    supabase-backend.ts
  lib/
    theme / env / validation / mappers / error-message ...

supabase/
  bootstrap.sql
  migrations/
  hotfix_*.sql
```

## Local Development

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npx expo start
```

Clear cache when needed:

```bash
npx expo start --clear
```

## Demo Mode vs Supabase Mode

### Demo Mode

如果没有配置 Supabase，App 会自动进入 Demo 模式：

- 匿名身份保存在本地
- 故事数据保存在 `AsyncStorage`
- 适合继续打磨 3D 场景、阅读体验和产品交互

### Supabase Mode

只要 `.env` 中同时存在：

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

App 就会自动切到 Supabase 模式。

基本步骤：

1. 在 Supabase 创建项目
2. 开启匿名登录
3. 执行 `supabase/bootstrap.sql`
4. 重启 Expo

更详细说明见：

- [supabase/README.md](./supabase/README.md)

## Core Data Model

核心表：

- `profiles`
- `stories`
- `story_views`
- `story_likes`
- `star_remnants`

核心 RPC：

- `reserve_story_coordinate()`
- `get_universe_window_stars(...)`
- `get_story_detail(...)`
- `resolve_coordinate_target(...)`
- `record_story_view(...)`
- `record_story_like(...)`
- `retire_story_to_remnant(...)`

## Docs

- [项目详细说明](./docs/project-guide.md)
- [iPhone 真机验收清单](./docs/device-acceptance-checklist.md)

## Validation

Run before each handoff:

```bash
cmd /c npx tsc --noEmit
cmd /c npm run lint
cmd /c npx expo export --platform web
```

## Notes

- 审核功能当前默认关闭，优先打磨核心体验
- 手机号保护入口暂未正式接入国内短信服务
- Expo Go 只适合开发预览，不适合作为最终性能判断
