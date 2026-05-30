# OnePic API

基于边缘计算的随机图片API服务，支持多平台部署。

项目链接：<https://pic.api.sylv.top>

![OnePic API](https://pic.api.sylv.top/image)

## 项目简介

OnePic API 是一个轻量级的随机图片服务，利用边缘计算技术实现，支持WebP图片格式，自动适配PC端和移动端设备。

项目提供两个分支，分别适配不同的边缘计算平台：

| 分支 | 适配平台 | 说明 |
| --- | --- | --- |
| `main` | 腾讯云 EdgeOne Pages | 默认分支，使用 EdgeOne Pages 边缘函数 |
| `aliyun-esa` | 阿里云 ESA | 使用阿里云边缘安全加速平台 |

## 项目特性

### 核心功能

- **WebP格式**: 采用现代WebP图片格式，体积小、质量高
- **设备适配**: 自动检测客户端设备类型，返回PC端或移动端图片
- **随机返回**: 从图片池中随机选择图片，保证多样性
- **多返回格式**: 支持JSON响应、图片重定向、纯文本链接

### 技术优势

- **边缘计算**: 基于边缘函数，全球节点就近响应
- **零延迟缓存**: 图片列表构建时嵌入，运行时零额外请求
- **轻量架构**: 无需后端服务器，纯静态资源+边缘函数
- **简单部署**: 推送到Git仓库即可自动构建部署
- **多平台支持**: 同时支持腾讯云 EdgeOne Pages 和阿里云 ESA 平台

## 项目结构

### EdgeOne Pages 分支 (main)

```
onepic-api/
├── build.js                    # 构建脚本
├── package.json                # 项目配置
├── edgeone.json                # EdgeOne Pages配置
├── convert_images_fixed.bat    # 图片转换脚本(Windows)
├── README.md                   # 项目文档
├── .gitignore                  # Git忽略配置
├── images/                     # 原始图片目录
│   ├── pc/                     # PC端原始图片
│   └── pe/                     # 移动端原始图片
├── converted/                  # 转换后图片目录
│   ├── pc/webp/                # PC端WebP图片
│   └── pe/webp/                # 移动端WebP图片
└── edge-functions/             # 边缘函数目录
    ├── api/index.js            # /api 接口处理
    └── image/index.js          # /image 接口处理
```

### 阿里云 ESA 分支 (aliyun-esa)

```
onepic-api/
├── build.js                    # 构建脚本
├── package.json                # 项目配置
├── esa.jsonc                   # 阿里云 ESA 配置
├── convert_images_fixed.bat    # 图片转换脚本(Windows)
├── README.md                   # 项目文档
├── .gitignore                  # Git忽略配置
├── images/                     # 原始图片目录
│   ├── pc/                     # PC端原始图片
│   └── pe/                     # 移动端原始图片
├── converted/                  # 转换后图片目录
│   ├── pc/webp/                # PC端WebP图片
│   └── pe/webp/                # 移动端WebP图片
└── edge-functions/             # 边缘函数目录
    └── esa/index.js            # ESA 统一入口函数
```

## 快速开始

### 1. 准备图片

将图片放入以下目录：

```
images/
├── pc/    # 电脑端图片
└── pe/    # 移动端图片
```

### 2. 图片格式转换

使用ImageMagick将图片转换为WebP格式：

```bash
# Windows系统运行
convert_images_fixed.bat

# 或手动转换
magick input.jpg -quality 85 output.webp
```

### 3. 选择平台并部署

#### 方式一：部署到 EdgeOne Pages (使用 main 分支)

1. 切换到 main 分支：`git checkout main`
2. 推送代码到Git仓库
3. 在EdgeOne Pages创建站点并关联仓库
4. 设置构建配置：
   - 构建命令：`npm run build`
   - 输出目录：`dist`
   - Node版本：`20.18.0`
5. 触发构建，等待部署完成

#### 方式二：部署到阿里云 ESA (使用 aliyun-esa 分支)

1. 切换到 aliyun-esa 分支：`git checkout aliyun-esa`
2. 推送代码到Git仓库
3. 在阿里云 ESA 创建应用并关联仓库
4. 设置构建配置：
   - 构建命令：`node build.js`
   - 输出目录：`dist`
5. 触发构建，等待部署完成

## API 文档

### 接口列表

| 接口       | 描述                  | 方法  |
| -------- | ------------------- | --- |
| `/api`   | 获取随机图片（JSON/重定向/文本） | GET |
| `/image` | 直接重定向到随机图片          | GET |

### GET /api

获取随机图片，支持多种返回格式。

#### 请求参数

| 参数       | 类型  | 必填 | 默认值  | 说明                            |
| -------- | --- | -- | ---- | ----------------------------- |
| `count`  | 整数  | 否  | 1    | 返回图片数量，范围1-50                 |
| `type`   | 字符串 | 否  | 自动检测 | 设备类型：`pc` 或 `pe`              |
| `format` | 字符串 | 否  | webp | 图片格式，当前仅支持 `webp`             |
| `return` | 字符串 | 否  | json | 返回类型：`json`、`redirect`、`text` |

#### 返回类型

**JSON响应 (return=json)**

```json
{
  "success": true,
  "count": 2,
  "type": "pc",
  "format": "webp",
  "images": [
    {
      "url": "https://example.com/converted/pc/webp/xxx.webp",
      "format": "webp",
      "type": "pc"
    },
    {
      "url": "https://example.com/converted/pc/webp/yyy.webp",
      "format": "webp",
      "type": "pc"
    }
  ]
}
```

**重定向 (return=redirect)**

直接302重定向到图片URL，适用于`count=1`。

**纯文本 (return=text)**

每行一个图片URL，适用于批量获取链接。

```
https://example.com/converted/pc/webp/xxx.webp
https://example.com/converted/pc/webp/yyy.webp
```

### GET /image

直接重定向到一张随机图片，无需参数。

## 使用示例

```bash
# 获取1张随机图片（JSON）
GET /api

# 获取10张随机图片
GET /api?count=10

# 获取移动端图片
GET /api?type=pe

# 获取5张移动端图片
GET /api?type=pe&count=5

# 直接重定向到图片
GET /api?count=1&return=redirect

# 获取纯文本链接
GET /api?count=10&return=text

# 直接获取随机图片（重定向）
GET /image
```

## 设备检测

API会自动检测客户端设备类型：

- 检测到移动设备（Android、iOS等）时返回 `pe` 类型图片
- 其他情况返回 `pc` 类型图片

也可通过 `type` 参数手动指定。

## 构建说明

运行构建命令：

```bash
npm run build
```

构建过程会：

1. 清理 `dist` 目录
2. 复制图片文件到 `dist/converted/`
3. 扫描图片文件列表并嵌入到边缘函数代码
4. 生成包含API文档的首页

## 技术栈

- **运行时**: 边缘函数 (EdgeOne Pages / 阿里云 ESA)
- **构建工具**: Node.js
- **图片格式**: WebP
- **部署平台**: 
  - 腾讯云 EdgeOne Pages (main 分支)
  - 阿里云 ESA (aliyun-esa 分支)

## 平台差异说明

### EdgeOne Pages (main 分支)

- 使用 EdgeOne Pages 原生边缘函数格式
- 函数入口分布在 `edge-functions/api/index.js` 和 `edge-functions/image/index.js`
- 配置文件为 `edgeone.json`
- 支持自动 CORS 头部配置和缓存策略

### 阿里云 ESA (aliyun-esa 分支)

- 使用阿里云 ESA 边缘函数统一入口格式
- 函数入口为 `edge-functions/esa/index.js`
- 配置文件为 `esa.jsonc`
- 构建时生成 `dist/er/index.js` 作为函数入口

## 环境要求

- Node.js 20.x 或更高版本
- ImageMagick（用于图片转换，可选）
- Git仓库（用于部署）

## 许可证

MIT License
