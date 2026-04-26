# Story Stars

Story Stars 是一个 `Expo + React Native + Supabase` 的 3D 故事宇宙应用。

当前产品路线：

- 用户无需先登录，发布时自动创建 Supabase 匿名身份。
- 正式故事存储在 Supabase `public.stories` 表。
- 首页宇宙只加载轻量星体数据，故事正文点击后再加载。
- 公开星所有人可见可读，私密星只有作者本人可读和定位。
- 审核功能当前关闭，先打磨发布、阅读和星空体验。
- 手机号保护入口当前默认关闭，等国内短信服务接入后再开放。

## 本地启动

```bash
npm install
npx expo start
```

没有配置 Supabase 时，App 会自动进入 Demo 模式：

- 匿名发布身份保存在本地设备。
- 故事数据保存在本地 AsyncStorage。
- 适合继续打磨 3D 场景和产品交互。

## 切换到 Supabase 模式

1. 在 Supabase 控制台创建项目。

2. 开启匿名登录：

   `Authentication -> Sign In / Providers -> Anonymous Sign-Ins -> Enabled`

3. 复制客户端环境变量：

   ```bash
   copy .env.example .env
   ```

   填入：

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. 打开 Supabase SQL Editor，执行完整初始化 SQL：

   `supabase/bootstrap.sql`

   详细说明见 `supabase/README.md`。

5. 重启 Expo：

   ```bash
   npx expo start --clear
   ```

只要 `.env` 里的 `EXPO_PUBLIC_SUPABASE_URL` 和 `EXPO_PUBLIC_SUPABASE_ANON_KEY` 都存在，App 就会自动从 Demo 模式切到 Supabase 模式。

## 数据结构

核心表：

- `profiles`: Supabase Auth 用户资料，匿名用户也会自动创建。
- `stories`: 一篇故事对应一颗星。
- `story_views`: 浏览去重计数。
- `story_likes`: 点赞与公开星亮度增长。
- `star_remnants`: 删除故事后保留的星体残影。

核心 RPC：

- `reserve_story_coordinate()`
- `get_universe_window_stars(...)`
- `get_story_detail(...)`
- `resolve_coordinate_target(...)`
- `record_story_view(...)`
- `record_story_like(...)`
- `retire_story_to_remnant(...)`

## 上线前清单

真机验收清单见：

`docs/device-acceptance-checklist.md`

项目详细说明见：

`docs/project-guide.md`

## 验证

```bash
cmd /c npx tsc --noEmit
cmd /c npm run lint
cmd /c npx expo export --platform web
```
