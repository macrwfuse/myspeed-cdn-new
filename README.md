# MySpeed-CN

基于 [MySpeed](https://github.com/gnmyt/myspeed) 的修改版，内置中国测速节点，支持 Windows 独立运行。

## ✨ 特性

- 🚀 内置 11 个中国测速节点（电信/联通/教育网/南京大学）
- 🖥️ Windows x64 独立可执行文件，无需安装依赖
- 🔧 移除原生模块依赖，避免 Windows 编译问题
- 📊 支持 Ookla Speedtest / LibreSpeed / Cloudflare 三种测速模式
- 🐳 Docker 镜像内置测速工具二进制文件，开箱即用

## 📥 下载

### Windows 可执行文件

从 [Releases](https://github.com/macrwfuse/myspeed-cn/releases) 页面下载 `MySpeed.exe`，直接双击运行。

### Docker 部署

```bash
# 方式一：Docker Compose (推荐)
docker compose up -d

# 方式二：Docker Run
docker run -d \
  --name myspeed-cn \
  -p 5216:5216 \
  -v myspeed-data:/myspeed/data \
  -e TZ=Asia/Shanghai \
  --restart unless-stopped \
  macrwfuse/myspeed-cn:latest

# 方式三：一键安装脚本
curl -fsSL https://raw.githubusercontent.com/macrwfuse/myspeed-cn/main/scripts/docker-install.sh | sudo bash
```

访问 http://localhost:5216 即可使用。

## 🇨🇳 内置中国测速节点

| ID | 城市 | 运营商 | 服务器地址 |
|---|---|---|---|
| 5396 | 苏州 | 江苏电信 5G | 4gsuzhou1.speedtest.jsinfo.net |
| 16204 | 苏州 | JSQY | speedtest.jsqiuying.com |
| 24447 | 上海 | 上海联通 5G | mobile.shunicomtest.com |
| 30852 | 昆山 | 昆山杜克大学 | speedtest.dukekunshan.edu.cn |
| 36663 | 镇江 | 江苏电信 5G | 5gzhenjiang.speedtest.jsinfo.net |
| 43752 | 北京 | 北京联通 | beijing.unicomtest.com |
| 59387 | 宁波 | 浙江电信 | cesu-nb.zjtelecom.com.cn |
| 17265 | 中和 | 远传电信 (台湾) | fetsz1.seed.net.tw |
| 73010 | 贺兰 | Arslan Telecom | arslantel.online |

节点来源: [spiritLHLS/speedtest.net-CN-ID](https://github.com/spiritLHLS/speedtest.net-CN-ID)

## 🔨 从源码编译

### 环境要求

- **操作系统**: Linux (推荐 Ubuntu 22.04+) 或 macOS
- **Bun**: v1.3.14+ (运行时和包管理器)
- **Node.js**: v18+ (仅用于前端构建)
- **Git**: 用于克隆仓库

### 安装 Bun

```bash
# 方式一：官方安装脚本
curl -fsSL https://bun.sh/install | bash

# 方式二：通过 npm 安装
npm install -g bun
```

### 克隆仓库

```bash
git clone https://github.com/macrwfuse/myspeed-cn.git
cd myspeed-cn
```

### 安装依赖

```bash
# 安装服务端依赖
bun install

# 安装客户端依赖
cd client && bun install && cd ..
```

### 构建前端

```bash
cd client && bun run build && cd ..
```

### 生成代码

```bash
# 生成数据库迁移文件
bun run generate-migrations

# 生成集成模块
bun run generate-integrations

# 嵌入前端资源到服务端
mv client/build .
bun run generate-client-embed
```

### 编译 Windows 可执行文件

```bash
# 交叉编译到 Windows x64
bun build --compile \
  --target=bun-windows-x64 \
  --compile-autoload-package-json \
  --external pg-hstore \
  --external pg \
  server/index.js \
  --outfile MySpeed.exe
```

编译产物: `MySpeed.exe` (约 104MB)

### 编译 Linux 可执行文件 (当前平台)

```bash
bun build --compile \
  --compile-autoload-package-json \
  --external pg-hstore \
  --external pg \
  server/index.js \
  --outfile MySpeed
```

### 完整构建脚本

```bash
#!/bin/bash
set -e

echo "=== 安装依赖 ==="
bun install
cd client && bun install && cd ..

echo "=== 构建前端 ==="
cd client && bun run build && cd ..

echo "=== 生成代码 ==="
bun run generate-migrations
bun run generate-integrations
mv client/build . 2>/dev/null || true
bun run generate-client-embed

echo "=== 编译 Windows EXE ==="
bun build --compile \
  --target=bun-windows-x64 \
  --compile-autoload-package-json \
  --external pg-hstore \
  --external pg \
  server/index.js \
  --outfile MySpeed.exe

echo "=== 完成 ==="
ls -lh MySpeed.exe
```

## ⚠️ 注意事项

### 1. 原生模块问题

原始 MySpeed 使用 `@resvg/resvg-js` 进行 OG 图片生成（PNG 格式），但该模块包含平台特定的原生二进制文件 (`.node`)，在交叉编译时无法正确打包。

**解决方案**: 本项目移除了 `@resvg/resvg-js` 依赖，OG 图片改为 SVG 格式输出。

如果需要 PNG 格式的 OG 图片，可以：
1. 在目标平台（Windows）上安装 `@resvg/resvg-js-win32-x64-msvc`
2. 恢复 `server/controller/opengraph.js` 中的 PNG 转换逻辑
3. 在 Windows 上本地编译（而非交叉编译）

### 2. 交叉编译限制

Bun 的 `--compile` 功能在交叉编译时有以下限制：

- **原生模块**: 不会自动嵌入 `.node` 文件，需要在运行时可用
- **文件路径**: `__dirname` 在编译后的可执行文件中指向临时目录
- **平台特定代码**: 需要确保代码在目标平台上可运行

### 3. 数据库

- 默认使用 SQLite（通过 Bun 内置的 `bun:sqlite`）
- 数据文件保存在 `data/storage.db`
- 首次运行时自动创建

### 4. 测速二进制文件

Docker 镜像已内置测速工具，开箱即用：
- **Ookla Speedtest CLI**: v1.2.0
- **LibreSpeed CLI**: v1.0.10
- **Cloudflare Speedtest**: v2.2.2

非 Docker 部署需手动下载测速工具并放入 `bin/` 目录。

### 5. 网络问题

在中国大陆环境下，可能遇到：
- GitHub 下载速度慢 → 测速二进制文件下载可能失败
- speedtest.net API 访问慢 → 服务器列表加载可能超时

解决方案：
- 使用代理
- 手动下载测速工具并放入 `bin/` 目录
- 使用内置的中国测速节点（已嵌入）

## 📁 项目结构

```
myspeed-cn/
├── client/                 # 前端 React 应用
│   ├── src/               # 源码
│   └── package.json
├── server/                # 后端 Express 服务
│   ├── controller/        # 控制器
│   │   ├── opengraph.js   # OG 图片生成 (已修改)
│   │   └── servers.js     # 服务器管理 (已修改)
│   ├── routes/            # API 路由
│   ├── tasks/             # 定时任务
│   ├── util/              # 工具函数
│   │   ├── loadServers.js # 服务器加载 (已修改)
│   │   └── speedtest.js   # 测速执行
│   └── index.js           # 入口文件
├── scripts/               # 构建脚本
│   ├── merge-cn-nodes.js  # CN 节点合并脚本 (新增)
│   └── docker-install.sh  # Docker 一键安装脚本
├── Dockerfile             # Docker 构建文件 (内置测速工具)
├── docker-compose.yml     # Docker Compose 配置
├── dist/                  # 编译产物
│   └── MySpeed.exe        # Windows 可执行文件
├── data/                  # 运行时数据 (自动生成)
│   ├── servers/           # 服务器列表缓存
│   ├── storage.db         # SQLite 数据库
│   └── bin/               # 测速工具二进制
└── package.json
```

## 🔧 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `SERVER_PORT` | 5216 | HTTP 端口 |
| `HTTPS_PORT` | 5217 | HTTPS 端口 |
| `DB_TYPE` | sqlite | 数据库类型 (sqlite/mysql) |
| `PREVIEW_MODE` | false | 预览模式 |
| `RUN_TEST_ON_STARTUP` | false | 启动时自动测速 |

### MySQL 配置 (可选)

```bash
export DB_TYPE=mysql
export DB_HOST=localhost
export DB_NAME=myspeed
export DB_USER=root
export DB_PASS=password
```

## 🐳 Docker 构建

### 本地构建镜像

```bash
# 克隆仓库
git clone https://github.com/macrwfuse/myspeed-cn.git
cd myspeed-cn

# 构建镜像
docker build -t myspeed-cn:latest .

# 运行容器
docker run -d \
  --name myspeed-cn \
  -p 5216:5216 \
  -v myspeed-data:/myspeed/data \
  -e TZ=Asia/Shanghai \
  myspeed-cn:latest
```

### 使用 Docker Compose

```bash
# 启动
docker compose up -d

# 查看日志
docker compose logs -f

# 停止
docker compose down
```

### Docker 数据持久化

Docker 部署时，以下数据会持久化到 Volume：

- `data/storage.db` - 测试记录数据库
- `data/servers/` - 服务器列表缓存
- `data/certs/` - SSL 证书（如配置）
- `bin/` - 测速工具二进制文件

```bash
# 查看 Volume 位置
docker volume inspect myspeed-data

# 备份数据
docker run --rm -v myspeed-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/myspeed-backup.tar.gz -C /data .
```

### 自定义端口

```bash
# 使用 8080 端口
docker run -d \
  --name myspeed-cn \
  -p 8080:5216 \
  -v myspeed-data:/myspeed/data \
  macrwfuse/myspeed-cn:latest
```

## 📝 与原版差异

| 项目 | 原版 MySpeed | MySpeed-CN |
|---|---|---|
| 中国测速节点 | ❌ 需手动添加 | ✅ 内置 11 个 |
| Docker 测速工具 | 运行时下载 | ✅ 镜像内置 |
| @resvg/resvg-js | ✅ 必需 | ❌ 已移除 |
| OG 图片格式 | PNG | SVG |
| Windows 编译 | 需处理原生模块 | ✅ 直接编译 |
| 交叉编译 | ⚠️ 可能失败 | ✅ 支持 |

## 📄 许可证

本项目基于原版 MySpeed 的许可证发布。详见 [LICENSE](LICENSE)。

## 🙏 致谢

- [gnmyt/myspeed](https://github.com/gnmyt/myspeed) - 原版 MySpeed
- [spiritLHLS/speedtest.net-CN-ID](https://github.com/spiritLHLS/speedtest.net-CN-ID) - 中国测速节点数据
- [oven-sh/bun](https://github.com/oven-sh/bun) - Bun 运行时
