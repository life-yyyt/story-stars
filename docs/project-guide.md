# Story Stars 项目说明

## 1. 项目是什么

`Story Stars` 是一个把“故事”表达成“星星”的移动端产品原型。

当前版本的核心体验是：

- 进入首页就是一片可交互的 3D 宇宙
- 每篇故事对应一颗星
- 用户可以直接发布，不需要先显式登录
- 点击星星进入阅读层
- 公开星可被所有人阅读和点亮
- 私密星仍存在于宇宙里，但只有作者本人能读取正文
- 删除故事后，正文消失，但星体残影继续留在宇宙中

这个项目现在已经不是 Expo 初始模板了，主线结构已经收敛成“产品页面 + 新 3D 宇宙实验场 + 后端适配层”的方式。

## 2. 当前产品目标

当前阶段的目标不是一次性把所有功能做满，而是先把以下三件事做对：

1. 手机端 3D 宇宙稳定、可浏览、可阅读
2. 发布、阅读、定位、删除、点亮这些核心链路闭环
3. 数据能逐步从本地 Demo 模式切到 Supabase 正式存储

当前不作为第一优先级的内容：

- 重型审核流
- 手机号短信找回正式上线
- 更复杂的社交关系
- 管理后台
- 更大规模的分区聚合宇宙

## 3. 技术栈

前端：

- `Expo`
- `React Native`
- `expo-router`
- `@react-three/fiber`
- `three`

数据与身份：

- `Supabase`
- 匿名登录
- Row Level Security
- RPC + 表查询混合

本地降级与原型支持：

- `AsyncStorage`
- Demo backend

## 4. 目录结构

当前建议从下面几个目录理解项目：

### 4.1 路由层

`app/`

- `app/_layout.tsx`
  - 全局 Provider、字体、主题入口
- `app/login.tsx`
  - 手机号保护入口
- `app/(tabs)/index.tsx`
  - 宇宙首页入口
- `app/(tabs)/compose.tsx`
  - 发布 / 编辑页面
- `app/(tabs)/stars.tsx`
  - 我的星星页面
- `app/(tabs)/_layout.tsx`
  - 底部 Tab 导航

### 4.2 业务主目录

`src/`

- `src/components/story`
  - 与故事表单、故事列表卡片直接相关的通用组件
- `src/components/ui`
  - 极简 UI 基础组件
- `src/context`
  - AppContext，整个产品状态与数据动作的中心
- `src/features/universe-lab`
  - 当前实际使用的 3D 宇宙实现
- `src/features/universe-runtime`
  - 当前只保留跨页面定位用的 focus intent
- `src/lib`
  - 环境变量、错误文案、主题、映射、校验、工具函数
- `src/services`
  - backend 抽象、demo backend、supabase backend
- `src/types`
  - 领域类型定义

### 4.3 云端目录

`supabase/`

- `bootstrap.sql`
  - 当前完整初始化 SQL
- `migrations/`
  - 迁移脚本
- `hotfix_*.sql`
  - 用于修复线上函数或结构差异的补丁 SQL
- `README.md`
  - Supabase 侧说明

### 4.4 文档目录

`docs/`

- `device-acceptance-checklist.md`
  - iPhone 真机验收清单
- `project-guide.md`
  - 当前这份项目说明

## 5. 当前前端架构

## 5.1 首页宇宙

首页不再走旧的多套宇宙框架，而是统一走：

- `src/features/universe-lab/universe-lab-screen.tsx`

它负责：

- 宇宙场景展示
- 顶部极简控制条
- 坐标定位面板
- 阅读层打开与关闭
- 宇宙消息提示

### 5.2 3D 渲染层

主要文件：

- `universe-lab-scene.native.tsx`
- `universe-lab-render-tree.tsx`
- `use-universe-lab-scene.ts`
- `use-universe-lab-native-gestures.ts`
- `universe-lab-render-core.ts`
- `universe-lab-focus-star.tsx`
- `use-universe-lab-glow-texture.ts`

职责划分：

- `scene`
  - 负责 Canvas、手势挂载和视口尺寸
- `render-tree`
  - 负责星场、星云、环境星、相机 rig
- `use-universe-lab-scene`
  - 负责 orbit、聚焦、reader 状态、误触保护、缩放边界
- `render-core`
  - 负责 nebula / 环境星 / glow / 星体视觉参数等纯渲染工具

### 5.3 阅读层

主要文件：

- `universe-lab-story-reader.tsx`

当前支持：

- 打开故事
- 关闭故事
- 复制坐标
- 编辑自己的星
- 点亮
- 显示阅读数和点亮数

当前交互规则：

- 点星直接进入阅读
- 阅读层打开时锁住背景宇宙手势
- 关闭后恢复宇宙浏览

## 6. 当前数据架构

## 6.1 AppContext 是中枢

文件：

- `src/context/app-context.tsx`

它负责：

- 当前 session
- viewerFingerprint
- `visibleStars`
- `myStories`
- `storyDetailCache`
- `activeUniverseQuery`
- `focusRequest`

它同时暴露核心动作：

- `saveStory`
- `deleteStory`
- `loadStoryDetail`
- `syncUniverseWindow`
- `locateByCoordinate`
- `recordStoryView`
- `likeStory`
- `requestOtp`
- `verifyOtp`
- `requestPhoneBinding`
- `verifyPhoneBinding`
- `signOut`

可以把它理解成“页面层和后端层之间的唯一业务中间层”。

## 6.2 后端抽象

文件：

- `src/services/backend.ts`

这个文件定义了统一接口，实际由两套实现完成：

- `src/services/demo-backend.ts`
- `src/services/supabase-backend.ts`

这样做的意义是：

- 没配置 Supabase 时仍然可以完整打磨交互
- 切云端后不用重写页面
- 页面代码不需要关心当前是 Demo 还是真云端

## 6.3 Demo 模式

特点：

- session 存在本地
- story 数据存在 `AsyncStorage`
- 点亮、阅读、删除残影也会模拟

适合：

- 3D 场景打磨
- 交互测试
- UI 走查
- 没接数据库前继续开发

## 6.4 Supabase 模式

开启条件：

- `.env` 中同时存在
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

当前策略：

- 首次发布时自动匿名登录
- stories 正式写入 Supabase
- 首页只拉轻量星体数据
- 点星后再请求详情

## 7. 主要业务规则

## 7.1 发布

- 用户不需要先手动登录
- 点击发布时会自动 `ensurePublishSession()`
- 每个身份每天最多发布 3 颗星
- 编辑已有故事不占额度

## 7.2 可见性

公开星：

- 所有人可见
- 所有人可读
- 有坐标
- 可点亮

私密星：

- 仍在宇宙里可见
- 对作者本人可读
- 对其他人不可读
- 非作者不返回坐标

## 7.3 点亮

当前规则：

- 一颗星，同一身份只能点亮一次
- 作者本人也只能点亮一次
- 公开星亮度随点亮次数增加

## 7.4 删除

删除后的结果不是“宇宙里彻底消失”，而是：

- 正式故事内容删除
- 我的星星里消失
- 宇宙里保留一个不可阅读的残影星体

这个逻辑是产品设定的一部分，不是 bug。

## 7.5 坐标定位

定位规则：

- 输入坐标码
- 后端解析目标星
- 同步目标窗口
- 相机聚焦到目标星
- 目标星处于屏幕中心附近

## 8. Supabase 侧结构

当前项目至少涉及以下核心对象：

表：

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

额外约束：

- `stories_daily_limit` trigger
- RLS 规则
- 匿名身份也走 `authenticated` 权限体系

## 9. 当前手机号保护状态

手机号保护入口已经有产品形态，但默认不开启。

控制位：

- `EXPO_PUBLIC_PHONE_AUTH_ENABLED=false`

当前建议：

- 先继续用匿名身份发布
- 手机号找回后续接入国内短信服务
  - 阿里云短信
  - 腾讯云短信

为什么暂时不开：

- Supabase Phone 登录默认更偏海外短信提供商
- 当前项目优先级仍然是打磨核心产品体验

## 10. 目前已经完成的关键闭环

当前已经相对稳定的链路：

1. 进入宇宙
2. 拖拽和缩放浏览
3. 点击星星打开阅读层
4. 复制坐标
5. 编辑自己的星
6. 发布新星
7. 从“我的星星”定位回宇宙
8. 删除故事并保留残影
9. 点亮并更新亮度
10. Supabase 缺失函数 / 缺失表时给出中文错误提示

## 11. 当前已知边界

虽然项目已经进入产品化阶段，但还没有到真正“可上线”的状态。

当前边界主要有：

- 手机号保护还没有正式打通
- Expo Go 只能做开发预览，不能作为最终性能判断
- 审核功能现在关闭
- 尚未做真正的上线监控
- 大规模故事量下的宇宙分区聚合还可以继续升级
- 还没有做正式发布包与 TestFlight 节奏

## 12. 接下来建议怎么推进

建议按这个顺序继续：

### 第一阶段：产品可用性收口

- 真机完整走发布 / 阅读 / 点亮 / 删除 / 定位
- 继续削减多余文案
- 统一错误提示风格
- 检查所有页面底部安全区和遮挡

### 第二阶段：账号保护落地

- 决定短信供应商
- 开启 phone auth
- 跑通绑定和找回

### 第三阶段：上线准备

- iOS development build 真机验收
- release build 检查
- 补充隐私与产品说明
- 准备首轮外部测试

## 13. 本地开发命令

安装依赖：

```powershell
npm install
```

启动：

```powershell
npx expo start
```

清缓存启动：

```powershell
npx expo start --clear
```

Supabase SQL 推送：

```powershell
npm run supabase:db:push
```

部署 moderation function：

```powershell
npm run supabase:functions:deploy
```

## 14. 每次交付前的纪律

当前项目固定交付验证为：

```powershell
cmd /c npx tsc --noEmit
cmd /c npm run lint
cmd /c npx expo export --platform web
```

如果这三项没有过，不应该把改动当成一个完整模块交付。
