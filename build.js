import fs from 'node:fs';
import path from 'node:path';

// 清理dist目录
function cleanDist() {
  const distPath = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
  }
  fs.mkdirSync(distPath, { recursive: true });
}

// 复制目录
function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  const files = fs.readdirSync(source);
  for (const file of files) {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// 生成API边缘函数
function generateApiFunction(imageFileList) {
  const imageListJson = JSON.stringify(imageFileList);
  
  return `// 边缘函数 - API处理

// 图片文件列表（构建时嵌入）
const IMAGE_LIST = ${imageListJson};

// 检测设备类型
function detectDeviceType(userAgent) {
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(userAgent) ? 'pe' : 'pc';
}

// 检测浏览器支持的图片格式
function detectImageFormat(acceptHeader) {
  return 'webp';
}

// CORS 头部
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 主处理函数
export default function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  const userAgent = request.headers.get('User-Agent') || '';
  const acceptHeader = request.headers.get('Accept') || '';
  
  const params = new URLSearchParams(url.search);
  const count = Math.max(1, Math.min(50, parseInt(params.get('count') || '1')));
  const returnType = params.get('return') || 'json';
  const type = params.get('type') || detectDeviceType(userAgent);
  const format = params.get('format') || detectImageFormat(acceptHeader);
  
  // 获取图片列表
  const files = IMAGE_LIST[type]?.[format];
  if (!files || files.length === 0) {
    return new Response(JSON.stringify({
      success: false,
      message: 'No images found'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
  
  const fileCount = files.length;
  
  // 处理重定向
  if (returnType === 'redirect') {
    const randomImage = files[Math.floor(Math.random() * fileCount)];
    const imageUrl = \`\${url.origin}/converted/\${type}/\${format}/\${randomImage}.\${format}\`;
    
    return new Response(null, {
      status: 302,
      headers: { 'Location': imageUrl, ...CORS_HEADERS }
    });
  }
  
  // 生成图片URL列表
  const images = [];
  for (let i = 0; i < count; i++) {
    const randomImage = files[Math.floor(Math.random() * fileCount)];
    images.push({
      url: \`\${url.origin}/converted/\${type}/\${format}/\${randomImage}.\${format}\`,
      format,
      type
    });
  }
  
  // 处理文本返回类型
  if (returnType === 'text') {
    return new Response(images.map(img => img.url).join('\\n'), {
      headers: { 'Content-Type': 'text/plain', ...CORS_HEADERS }
    });
  }
  
  // 返回JSON响应
  return new Response(JSON.stringify({
    success: true,
    count: images.length,
    type,
    format,
    images
  }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}
`;
}

// 生成Image边缘函数
function generateImageFunction(imageFileList) {
  const imageListJson = JSON.stringify(imageFileList);
  
  return `// 边缘函数 - Image处理

// 图片文件列表（构建时嵌入）
const IMAGE_LIST = ${imageListJson};

// 检测设备类型
function detectDeviceType(userAgent) {
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(userAgent) ? 'pe' : 'pc';
}

// 检测浏览器支持的图片格式
function detectImageFormat(acceptHeader) {
  return 'webp';
}

// CORS 头部
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 主处理函数
export default function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  const userAgent = request.headers.get('User-Agent') || '';
  const acceptHeader = request.headers.get('Accept') || '';
  
  const type = detectDeviceType(userAgent);
  const format = detectImageFormat(acceptHeader);
  
  const files = IMAGE_LIST[type]?.[format];
  if (!files || files.length === 0) {
    return new Response('No images found', { status: 404, headers: CORS_HEADERS });
  }
  
  const randomImage = files[Math.floor(Math.random() * files.length)];
  const imageUrl = \`\${url.origin}/converted/\${type}/\${format}/\${randomImage}.\${format}\`;
  
  return new Response(null, {
    status: 302,
    headers: { 'Location': imageUrl, ...CORS_HEADERS }
  });
}
`;
}

// 构建函数
function build() {
  cleanDist();
  
  // 复制converted目录
  const convertedSource = path.join(process.cwd(), 'converted');
  const convertedTarget = path.join(process.cwd(), 'dist', 'converted');
  if (fs.existsSync(convertedSource)) {
    copyDirectory(convertedSource, convertedTarget);
    console.log('Copied converted directory');
  }
  
  // 复制images目录
  const imagesSource = path.join(process.cwd(), 'images');
  const imagesTarget = path.join(process.cwd(), 'dist', 'images');
  if (fs.existsSync(imagesSource)) {
    copyDirectory(imagesSource, imagesTarget);
    console.log('Copied images directory');
  }
  
  // 生成图片文件列表
  console.log('Generating image file list...');
  const imageFileList = {
    pc: {
      webp: []
    },
    pe: {
      webp: []
    }
  };

  // 扫描PC目录
  const pcWebpDir = path.join(convertedSource, 'pc', 'webp');
  const peWebpDir = path.join(convertedSource, 'pe', 'webp');

  // 处理PC目录
  if (fs.existsSync(pcWebpDir)) {
    try {
      const pcWebpFiles = fs.readdirSync(pcWebpDir);
      imageFileList.pc.webp = pcWebpFiles.map(file => path.basename(file, '.webp'));
      console.log(`Processed ${imageFileList.pc.webp.length} PC images`);
    } catch (error) {
      console.error('Error processing PC images:', error);
    }
  }

  // 处理PE目录
  if (fs.existsSync(peWebpDir)) {
    try {
      const peWebpFiles = fs.readdirSync(peWebpDir);
      imageFileList.pe.webp = peWebpFiles.map(file => path.basename(file, '.webp'));
      console.log(`Processed ${imageFileList.pe.webp.length} PE images`);
    } catch (error) {
      console.error('Error processing PE images:', error);
    }
  }

  // 保存图片文件列表到JSON文件
  try {
    const imageListPath = path.join(process.cwd(), 'dist', 'image-list.json');
    fs.writeFileSync(imageListPath, JSON.stringify(imageFileList, null, 2));
    console.log('Generated image-list.json');
  } catch (error) {
    console.error('Error saving image-list.json:', error);
  }
  
  // 生成API边缘函数（包含图片列表）
  try {
    const apiFunctionPath = path.join(process.cwd(), 'edge-functions', 'api', 'index.js');
    const apiFunctionContent = generateApiFunction(imageFileList);
    fs.writeFileSync(apiFunctionPath, apiFunctionContent);
    console.log('Generated API edge function');
  } catch (error) {
    console.error('Error generating API edge function:', error);
  }
  
  // 生成Image边缘函数（包含图片列表）
  try {
    const imageFunctionPath = path.join(process.cwd(), 'edge-functions', 'image', 'index.js');
    const imageFunctionContent = generateImageFunction(imageFileList);
    fs.writeFileSync(imageFunctionPath, imageFunctionContent);
    console.log('Generated Image edge function');
  } catch (error) {
    console.error('Error generating Image edge function:', error);
  }
  
  // 创建package.json文件
  const packageJsonPath = path.join(process.cwd(), 'dist', 'package.json');
  fs.writeFileSync(packageJsonPath, JSON.stringify({}, null, 2));
  console.log('Created package.json');
  
  // 创建index.html文件
  const indexHtmlPath = path.join(process.cwd(), 'dist', 'index.html');
  const indexHtmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OnePic API — 边缘随机图片服务</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='24' fill='%237c3aed'/><text x='50' y='70' font-size='58' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='bold'>P</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #050507;
      --bg-primary: #0a0a0f;
      --bg-secondary: #111118;
      --bg-tertiary: #16161f;
      --bg-elevated: #1d1d28;
      --bg-hover: #252532;
      --text-primary: #fafafa;
      --text-secondary: #a8a8b3;
      --text-tertiary: #74747f;
      --text-muted: #4a4a55;
      --accent: #7c3aed;
      --accent-hover: #8b5cf6;
      --accent-light: #a78bfa;
      --accent-soft: rgba(124, 58, 237, 0.12);
      --accent-glow: rgba(124, 58, 237, 0.4);
      --accent-2: #ec4899;
      --accent-2-soft: rgba(236, 72, 153, 0.12);
      --gradient-primary: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
      --gradient-soft: linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%);
      --gradient-text: linear-gradient(135deg, #a78bfa 0%, #f472b6 100%);
      --border: #25252e;
      --border-hover: #3a3a47;
      --border-light: #1a1a23;
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.1);
      --warning: #f59e0b;
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.1);
      --shadow-xs: 0 1px 2px rgba(0,0,0,0.4);
      --shadow-sm: 0 2px 6px rgba(0,0,0,0.5);
      --shadow-md: 0 8px 24px -6px rgba(0,0,0,0.6), 0 4px 8px -4px rgba(0,0,0,0.4);
      --shadow-lg: 0 24px 48px -16px rgba(0,0,0,0.8), 0 12px 24px -12px rgba(0,0,0,0.6);
      --shadow-glow: 0 0 40px rgba(124, 58, 237, 0.3);
      --shadow-glow-pink: 0 0 40px rgba(236, 72, 153, 0.25);
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --radius-xl: 20px;
      --radius-2xl: 24px;
      --radius-3xl: 32px;
      --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      --transition-base: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      --transition-slow: 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    *::selection { background: rgba(124, 58, 237, 0.3); color: #fff; }
    html { scroll-behavior: smooth; }

    body {
      font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-base);
      min-height: 100vh;
      color: var(--text-primary);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      position: relative;
      overflow-x: hidden;
    }

    /* 背景装饰 - 多层渐变光晕 */
    .bg-decoration {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .bg-decoration::before,
    .bg-decoration::after {
      content: '';
      position: absolute;
      border-radius: 50%;
      filter: blur(100px);
      animation: float 20s ease-in-out infinite;
    }

    .bg-decoration::before {
      top: -10%; left: -10%;
      width: 50%; height: 50%;
      background: radial-gradient(circle, rgba(124, 58, 237, 0.2) 0%, transparent 70%);
    }

    .bg-decoration::after {
      bottom: -10%; right: -10%;
      width: 45%; height: 45%;
      background: radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, transparent 70%);
      animation-delay: -10s;
    }

    .bg-grid {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background-image: 
        linear-gradient(rgba(124, 58, 237, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(124, 58, 237, 0.03) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
    }

    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 0 24px;
      position: relative;
      z-index: 1;
    }

    /* 顶部导航栏 */
    .topbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(10, 10, 15, 0.7);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border-light);
      padding: 14px 0;
    }

    .topbar-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 1.15em;
      letter-spacing: -0.5px;
    }

    .logo-icon {
      width: 32px; height: 32px;
      border-radius: var(--radius-sm);
      background: var(--gradient-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9em;
      color: #fff;
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
    }

    .logo-text { color: var(--text-primary); }
    .logo-text .accent { color: var(--accent-light); }

    .nav {
      display: flex;
      gap: 2px;
      padding: 4px;
      background: rgba(22, 22, 31, 0.6);
      border: 1px solid var(--border);
      border-radius: 50px;
    }

    .nav a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 18px;
      color: var(--text-tertiary);
      text-decoration: none;
      border-radius: 50px;
      font-weight: 500;
      font-size: 0.88em;
      transition: all var(--transition-base);
      cursor: pointer;
      font-family: inherit;
    }

    .nav a:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.05);
    }

    .nav a.active {
      background: var(--gradient-primary);
      color: #fff;
      box-shadow: 0 2px 10px rgba(124, 58, 237, 0.4);
    }

    /* Hero Section */
    .hero {
      text-align: center;
      padding: 80px 0 56px;
      position: relative;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      background: var(--accent-soft);
      border: 1px solid rgba(124, 58, 237, 0.25);
      border-radius: 50px;
      font-size: 0.82em;
      font-weight: 500;
      color: var(--accent-light);
      margin-bottom: 28px;
      letter-spacing: 0.3px;
      backdrop-filter: blur(10px);
    }

    .hero-badge::before {
      content: '';
      width: 6px; height: 6px;
      background: var(--success);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--success);
      animation: pulse 2.5s ease infinite;
    }

    .hero h1 {
      font-size: 4.5em;
      font-weight: 900;
      margin-bottom: 20px;
      color: var(--text-primary);
      letter-spacing: -3px;
      line-height: 1;
    }

    .hero h1 .gradient-text {
      background: var(--gradient-text);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      position: relative;
    }

    .hero p {
      font-size: 1.15em;
      color: var(--text-tertiary);
      max-width: 560px;
      margin: 0 auto 36px;
      line-height: 1.7;
      font-weight: 400;
    }

    .hero-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    /* Stats Bar */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: var(--border);
      border: 1px solid var(--border);
      border-radius: var(--radius-2xl);
      overflow: hidden;
      margin-bottom: 64px;
      box-shadow: var(--shadow-lg);
    }

    .stat-item {
      background: var(--bg-secondary);
      padding: 28px 20px;
      text-align: center;
      transition: all var(--transition-base);
      position: relative;
    }

    .stat-item:hover {
      background: var(--bg-tertiary);
    }

    .stat-value {
      font-size: 2.4em;
      font-weight: 900;
      background: var(--gradient-text);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 6px;
      letter-spacing: -1.5px;
      line-height: 1;
    }

    .stat-label {
      font-size: 0.78em;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 600;
    }

    .stat-sub {
      font-size: 0.72em;
      color: var(--success);
      margin-top: 4px;
      font-weight: 500;
    }

    /* Section */
    .section {
      padding: 32px 0;
    }

    .section-header {
      text-align: center;
      margin-bottom: 48px;
    }

    .section-tag {
      display: inline-block;
      padding: 4px 14px;
      background: var(--accent-soft);
      border: 1px solid rgba(124, 58, 237, 0.2);
      border-radius: 50px;
      font-size: 0.76em;
      font-weight: 600;
      color: var(--accent-light);
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .section-title {
      font-size: 2.6em;
      font-weight: 800;
      color: var(--text-primary);
      letter-spacing: -1.5px;
      line-height: 1.1;
      margin-bottom: 16px;
    }

    .section-title .gradient-text {
      background: var(--gradient-text);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .section-desc {
      font-size: 1.05em;
      color: var(--text-tertiary);
      max-width: 520px;
      margin: 0 auto;
      line-height: 1.7;
    }

    /* Features Grid */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .feature-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      padding: 28px 24px;
      transition: all var(--transition-base);
      position: relative;
      overflow: hidden;
    }

    .feature-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 2px;
      background: var(--gradient-primary);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform var(--transition-base);
    }

    .feature-card:hover {
      transform: translateY(-4px);
      border-color: var(--border-hover);
      background: var(--bg-tertiary);
      box-shadow: var(--shadow-md);
    }

    .feature-card:hover::before { transform: scaleX(1); }

    .feature-icon {
      width: 48px; height: 48px;
      border-radius: var(--radius-md);
      background: var(--gradient-soft);
      border: 1px solid rgba(124, 58, 237, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5em;
      margin-bottom: 18px;
    }

    .feature-title {
      font-size: 1.1em;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 8px;
      letter-spacing: -0.3px;
    }

    .feature-desc {
      color: var(--text-tertiary);
      font-size: 0.9em;
      line-height: 1.7;
    }

    /* API Test Section */
    .test-card {
      background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
      border: 1px solid var(--border);
      border-radius: var(--radius-3xl);
      padding: 48px;
      text-align: center;
      position: relative;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
    }

    .test-card::before {
      content: '';
      position: absolute;
      top: 0; left: 50%;
      transform: translateX(-50%);
      width: 70%; height: 1px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
    }

    .test-card::after {
      content: '';
      position: absolute;
      top: -50%; left: -50%;
      width: 200%; height: 200%;
      background: radial-gradient(circle at center, var(--accent-soft) 0%, transparent 50%);
      pointer-events: none;
      opacity: 0.6;
    }

    .test-card > * { position: relative; z-index: 1; }

    .test-title {
      font-size: 1.6em;
      font-weight: 800;
      margin-bottom: 10px;
      color: var(--text-primary);
      letter-spacing: -0.5px;
    }

    .test-desc {
      color: var(--text-tertiary);
      font-size: 1em;
      margin-bottom: 32px;
    }

    .preview-container {
      margin-top: 36px;
    }

    .preview-image {
      max-width: 100%;
      max-height: 420px;
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-lg);
      display: block;
      margin: 0 auto;
      transition: all var(--transition-base);
      border: 1px solid var(--border);
    }

    .preview-image:hover {
      box-shadow: var(--shadow-lg), var(--shadow-glow);
      transform: translateY(-4px);
    }

    .preview-info {
      margin-top: 20px;
      display: inline-flex;
      align-items: center;
      gap: 20px;
      padding: 12px 22px;
      background: rgba(22, 22, 31, 0.8);
      backdrop-filter: blur(10px);
      border-radius: 50px;
      border: 1px solid var(--border);
      font-size: 0.86em;
      color: var(--text-tertiary);
      font-weight: 500;
    }

    .preview-info span {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 13px 32px;
      background: var(--gradient-primary);
      color: #fff;
      text-decoration: none;
      border-radius: var(--radius-md);
      font-weight: 600;
      font-size: 0.95em;
      border: none;
      cursor: pointer;
      transition: all var(--transition-base);
      font-family: inherit;
      position: relative;
      overflow: hidden;
      box-shadow: 0 6px 20px rgba(124, 58, 237, 0.35);
    }

    .btn::before {
      content: '';
      position: absolute;
      top: 0; left: -100%;
      width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
      transition: left 0.7s ease;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(124, 58, 237, 0.5);
    }

    .btn:hover::before { left: 100%; }

    .btn:active {
      transform: translateY(0);
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .btn-secondary {
      background: var(--bg-elevated);
      color: var(--text-primary);
      border: 1px solid var(--border);
      box-shadow: none;
    }

    .btn-secondary:hover {
      background: var(--bg-hover);
      border-color: var(--border-hover);
      box-shadow: var(--shadow-sm);
    }

    .btn-lg {
      padding: 15px 36px;
      font-size: 1em;
    }

    /* Gallery Section */
    .gallery-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-2xl);
      overflow: hidden;
      box-shadow: var(--shadow-lg);
    }

    .gallery-header {
      padding: 28px 32px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      background: rgba(255, 255, 255, 0.02);
    }

    .gallery-header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .gallery-header-icon {
      width: 44px; height: 44px;
      border-radius: var(--radius-md);
      background: var(--gradient-soft);
      border: 1px solid rgba(124, 58, 237, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2em;
    }

    .gallery-header h2 {
      font-size: 1.25em;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.3px;
    }

    .gallery-header p {
      color: var(--text-tertiary);
      font-size: 0.86em;
      margin-top: 2px;
    }

    .device-toggle {
      display: flex;
      gap: 0;
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      padding: 4px;
    }

    .device-toggle button {
      padding: 8px 20px;
      border: none;
      background: transparent;
      color: var(--text-tertiary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-weight: 500;
      font-size: 0.88em;
      transition: all var(--transition-base);
      font-family: inherit;
    }

    .device-toggle button.active {
      background: var(--gradient-primary);
      color: #fff;
      box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
    }

    .device-toggle button:hover:not(.active) {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.05);
    }

    .gallery-body { padding: 28px 32px; }

    .gallery-stats {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      font-size: 0.86em;
      font-weight: 500;
      margin-bottom: 20px;
    }

    .gallery-stats .badge {
      padding: 3px 10px;
      background: var(--accent-soft);
      color: var(--accent-light);
      border-radius: 50px;
      font-size: 0.85em;
      border: 1px solid rgba(124, 58, 237, 0.2);
      font-weight: 600;
    }

    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 14px;
    }

    .gallery-item {
      aspect-ratio: 1;
      border-radius: var(--radius-md);
      overflow: hidden;
      cursor: pointer;
      transition: all var(--transition-base);
      position: relative;
      border: 1px solid var(--border);
      background: var(--bg-tertiary);
    }

    .gallery-item::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%);
      opacity: 0;
      transition: opacity var(--transition-base);
    }

    .gallery-item:hover {
      transform: translateY(-6px);
      box-shadow: var(--shadow-lg);
      border-color: rgba(124, 58, 237, 0.5);
    }

    .gallery-item:hover::after { opacity: 1; }

    .gallery-item img {
      width: 100%; height: 100%;
      object-fit: cover;
      transition: transform var(--transition-slow);
    }

    .gallery-item:hover img { transform: scale(1.1); }

    .gallery-item-overlay {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 14px;
      color: white;
      font-size: 0.78em;
      z-index: 2;
      opacity: 0;
      transform: translateY(10px);
      transition: all var(--transition-base);
      font-family: 'JetBrains Mono', monospace;
    }

    .gallery-item:hover .gallery-item-overlay {
      opacity: 1;
      transform: translateY(0);
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 14px;
      margin: 32px 0 0;
    }

    .pagination button {
      padding: 10px 22px;
      background: var(--bg-elevated);
      color: var(--text-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-weight: 500;
      font-size: 0.88em;
      transition: all var(--transition-base);
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pagination button:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--accent);
      color: var(--text-primary);
    }

    .pagination button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .page-info {
      color: var(--text-tertiary);
      font-size: 0.9em;
      font-weight: 600;
      min-width: 60px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    /* Modal */
    .image-modal {
      display: none;
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.94);
      backdrop-filter: blur(12px);
      z-index: 1000;
      cursor: pointer;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .image-modal.active {
      display: flex;
      animation: fadeIn 0.3s ease;
    }

    .image-modal img {
      max-width: 90%;
      max-height: 85vh;
      object-fit: contain;
      border-radius: var(--radius-lg);
      box-shadow: 0 40px 80px rgba(0,0,0,0.7), 0 0 80px rgba(124, 58, 237, 0.2);
      animation: scaleIn 0.3s ease;
    }

    .modal-close {
      position: absolute;
      top: 28px; right: 36px;
      width: 44px; height: 44px;
      border-radius: 50%;
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: rgba(255,255,255,0.8);
      cursor: pointer;
      transition: all var(--transition-base);
    }

    .modal-close:hover {
      color: #fff;
      background: rgba(255,255,255,0.2);
      border-color: rgba(255,255,255,0.3);
      transform: rotate(90deg);
    }

    /* Docs Section */
    .docs-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .endpoint-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      overflow: hidden;
      transition: all var(--transition-base);
    }

    .endpoint-card:hover {
      border-color: var(--border-hover);
      box-shadow: var(--shadow-md);
    }

    .endpoint-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      background: var(--bg-tertiary);
    }

    .endpoint-method {
      padding: 5px 14px;
      background: var(--gradient-primary);
      color: #fff;
      border-radius: var(--radius-sm);
      font-size: 0.78em;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
    }

    .endpoint-path {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.05em;
      color: var(--text-primary);
      font-weight: 600;
    }

    .endpoint-desc {
      color: var(--text-tertiary);
      font-size: 0.88em;
      margin-left: auto;
    }

    .endpoint-body { padding: 28px 24px; }

    .endpoint-section-title {
      font-size: 0.78em;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
    }

    .parameter {
      margin: 10px 0;
      padding: 18px 20px;
      background: var(--bg-primary);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      transition: all var(--transition-base);
    }

    .parameter:hover {
      border-color: rgba(124, 58, 237, 0.3);
      background: var(--bg-tertiary);
    }

    .parameter-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .parameter-name {
      font-weight: 700;
      background: var(--gradient-text);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.94em;
    }

    .parameter-type {
      padding: 3px 10px;
      background: var(--accent-soft);
      color: var(--accent-light);
      border-radius: 50px;
      font-size: 0.75em;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      border: 1px solid rgba(124, 58, 237, 0.2);
    }

    .parameter-optional {
      padding: 3px 10px;
      background: var(--bg-hover);
      color: var(--text-tertiary);
      border-radius: 50px;
      font-size: 0.75em;
      font-weight: 500;
    }

    .parameter-description {
      color: var(--text-secondary);
      font-size: 0.92em;
      line-height: 1.7;
    }

    .parameter-default {
      margin-top: 8px;
      font-size: 0.82em;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    .code-block {
      background: #06060a;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      margin: 16px 0;
      overflow: hidden;
    }

    .code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid var(--border);
    }

    .code-lang {
      font-size: 0.76em;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      font-weight: 500;
    }

    .code-copy {
      padding: 4px 12px;
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.76em;
      transition: all var(--transition-base);
      font-family: inherit;
      font-weight: 500;
    }

    .code-copy:hover {
      border-color: var(--accent);
      color: var(--accent-light);
      background: var(--accent-soft);
    }

    .code-copy.copied {
      border-color: var(--success);
      color: var(--success);
      background: var(--success-bg);
    }

    .code-block pre {
      padding: 18px 20px;
      margin: 0;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.86em;
      line-height: 1.8;
      color: #e4e4e7;
    }

    .response-block {
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 18px 20px;
      margin: 16px 0;
    }

    .response-block pre {
      color: var(--text-primary);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.86em;
      line-height: 1.8;
      margin: 0;
      overflow-x: auto;
    }

    /* FAQ / Errors */
    .faq-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px;
    }

    .faq-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 22px;
      transition: all var(--transition-base);
      position: relative;
      overflow: hidden;
    }

    .faq-card.error {
      border-left: 3px solid var(--danger);
    }

    .faq-card:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }

    .faq-card.error:hover {
      background: var(--danger-bg);
    }

    .faq-card-title {
      font-size: 1em;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .faq-card.error .faq-card-title {
      font-family: 'JetBrains Mono', monospace;
      color: var(--danger);
    }

    .faq-card-desc {
      color: var(--text-secondary);
      font-size: 0.88em;
      line-height: 1.7;
    }

    /* Process Steps */
    .process-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      position: relative;
    }

    .process-step {
      text-align: center;
      position: relative;
    }

    .process-number {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: var(--gradient-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3em;
      font-weight: 800;
      color: #fff;
      margin: 0 auto 18px;
      box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4);
      position: relative;
      z-index: 1;
    }

    .process-title {
      font-size: 1.05em;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    .process-desc {
      color: var(--text-tertiary);
      font-size: 0.9em;
      line-height: 1.7;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 48px 0 32px;
      margin-top: 64px;
      border-top: 1px solid var(--border);
      position: relative;
    }

    .footer::before {
      content: '';
      position: absolute;
      top: 0; left: 50%;
      transform: translateX(-50%);
      width: 240px; height: 1px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
    }

    .footer p {
      color: var(--text-muted);
      font-size: 0.86em;
      margin-bottom: 6px;
    }

    .footer a {
      color: var(--text-tertiary);
      text-decoration: none;
      transition: color var(--transition-fast);
      font-weight: 500;
    }

    .footer a:hover { color: var(--accent-light); }

    /* Page transitions */
    .page {
      display: none;
      animation: fadeInUp 0.5s ease;
    }

    .page.active { display: block; }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    @keyframes float {
      0%, 100% { transform: translate(0, 0); }
      50% { transform: translate(20px, -20px); }
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg-base); }
    ::-webkit-scrollbar-thumb { background: var(--border-hover); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

    /* Responsive */
    @media (max-width: 900px) {
      .features-grid { grid-template-columns: repeat(2, 1fr); }
      .stats-bar { grid-template-columns: repeat(2, 1fr); }
      .process-grid { grid-template-columns: 1fr; gap: 32px; }
    }

    @media (max-width: 768px) {
      .hero h1 { font-size: 3em; }
      .hero { padding: 56px 0 40px; }
      .section-title { font-size: 2em; }
      .topbar-inner { flex-direction: column; gap: 12px; }
      .nav { width: 100%; justify-content: center; }
      .nav a { padding: 8px 16px; font-size: 0.85em; }
      .card-body, .gallery-body, .endpoint-body { padding: 20px; }
      .test-card { padding: 32px 24px; }
      .gallery-grid {
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 10px;
      }
      .endpoint-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      .endpoint-desc { margin-left: 0; }
      .hero-actions { flex-direction: column; align-items: center; }
      .btn { width: 100%; justify-content: center; }
    }

    @media (max-width: 480px) {
      .hero h1 { font-size: 2.4em; }
      .stats-bar { grid-template-columns: 1fr; }
      .features-grid { grid-template-columns: 1fr; }
      .gallery-grid { grid-template-columns: repeat(2, 1fr); }
      .container { padding: 0 16px; }
      .section-title { font-size: 1.7em; }
    }
  </style>
</head>
<body>
  <div class="bg-decoration"></div>
  <div class="bg-grid"></div>

  <!-- 顶部导航 -->
  <header class="topbar">
    <div class="container topbar-inner">
      <div class="logo">
        <div class="logo-icon">P</div>
        <div class="logo-text">One<span class="accent">Pic</span></div>
      </div>
      <nav class="nav">
        <a href="#" class="active" onclick="showPage('home', this); return false;">首页</a>
        <a href="#" onclick="showPage('gallery', this); return false;">图库</a>
        <a href="#" onclick="showPage('docs', this); return false;">文档</a>
      </nav>
    </div>
  </header>

  <main class="container">
    <!-- 首页 -->
    <div id="home-page" class="page active">
      <!-- Hero -->
      <section class="hero">
        <div class="hero-badge">Edge Powered · 全球加速</div>
        <h1>随机图片<br><span class="gradient-text">边缘分发</span></h1>
        <p>基于边缘计算的高性能图片 API 服务，为 Web 应用提供低延迟、高质量的随机图片分发能力</p>
        <div class="hero-actions">
          <button class="btn btn-lg" onclick="document.getElementById('testBtn').scrollIntoView({behavior:'smooth'});">立即体验</button>
          <a href="#" class="btn btn-secondary btn-lg" onclick="showPage('docs', document.querySelectorAll('.nav a')[2]); return false;">查看文档</a>
        </div>
      </section>

      <!-- Stats Bar -->
      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-value">99.9%</div>
          <div class="stat-label">服务可用性</div>
          <div class="stat-sub">Enterprise grade</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">v3.0</div>
          <div class="stat-label">API 版本</div>
          <div class="stat-sub">最新版本</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">WebP</div>
          <div class="stat-label">图片格式</div>
          <div class="stat-sub">高效压缩</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">24/7</div>
          <div class="stat-label">全球加速</div>
          <div class="stat-sub">Global coverage</div>
        </div>
      </div>

      <!-- Features -->
      <section class="section">
        <div class="section-header">
          <div class="section-tag">Features</div>
          <h2 class="section-title">为速度<span class="gradient-text">而生</span></h2>
          <p class="section-desc">构建世界级产品所需的一切能力，协同工作，无缝衔接</p>
        </div>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">&#9889;</div>
            <div class="feature-title">边缘计算</div>
            <div class="feature-desc">基于边缘函数，全球节点就近响应，零延迟缓存，运行时无额外请求</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">&#128241;</div>
            <div class="feature-title">设备适配</div>
            <div class="feature-desc">自动检测客户端设备类型，智能返回 PC 端或移动端适配图片</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">&#128444;</div>
            <div class="feature-title">WebP 优化</div>
            <div class="feature-desc">采用现代 WebP 格式，体积更小、质量更高，兼顾性能与体验</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">&#127922;</div>
            <div class="feature-title">随机分发</div>
            <div class="feature-desc">从图片池随机选择，支持单张或批量获取，JSON/重定向/文本多种返回</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">&#128737;</div>
            <div class="feature-title">多平台部署</div>
            <div class="feature-desc">同时支持腾讯云 EdgeOne Pages 和阿里云 ESA，灵活选择部署平台</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">&#128640;</div>
            <div class="feature-title">零配置使用</div>
            <div class="feature-desc">直接访问 /api 或 /image 即可获取图片，无需复杂参数配置</div>
          </div>
        </div>
      </section>

      <!-- API Test -->
      <section class="section">
        <div class="test-card">
          <div class="test-title">在线体验</div>
          <div class="test-desc">点击按钮获取一张随机图片，感受边缘加速的力量</div>
          <button class="btn btn-lg" id="testBtn" onclick="fetchRandomImage()">
            <span>获取随机图片</span>
          </button>
          <div class="preview-container">
            <img id="previewImage" class="preview-image" style="display:none;" alt="预览图片" />
            <div id="previewInfo" class="preview-info" style="display:none;">
              <span>&#128444; <span id="previewFormat"></span></span>
              <span>&#128187; <span id="previewType"></span></span>
              <span>&#128208; <span id="previewSize"></span></span>
            </div>
          </div>
        </div>
      </section>

      <!-- Process -->
      <section class="section">
        <div class="section-header">
          <div class="section-tag">Process</div>
          <h2 class="section-title">三步<span class="gradient-text">开始使用</span></h2>
          <p class="section-desc">几分钟即可完成接入，无需复杂配置</p>
        </div>
        <div class="process-grid">
          <div class="process-step">
            <div class="process-number">1</div>
            <div class="process-title">调用接口</div>
            <div class="process-desc">访问 /api 或 /image 端点，系统自动检测设备类型</div>
          </div>
          <div class="process-step">
            <div class="process-number">2</div>
            <div class="process-title">边缘响应</div>
            <div class="process-desc">就近边缘节点处理请求，随机选择图片并返回</div>
          </div>
          <div class="process-step">
            <div class="process-number">3</div>
            <div class="process-title">集成使用</div>
            <div class="process-desc">在 HTML、CSS 或应用中直接引用返回的图片 URL</div>
          </div>
        </div>
      </section>
    </div>

    <!-- 图库页 -->
    <div id="gallery-page" class="page">
      <section class="section" style="padding-top: 48px;">
        <div class="section-header">
          <div class="section-tag">Gallery</div>
          <h2 class="section-title">图片<span class="gradient-text">图库</span></h2>
          <p class="section-desc">浏览所有可用的图片资源，支持 PC 端和移动端切换</p>
        </div>

        <div class="gallery-card">
          <div class="gallery-header">
            <div class="gallery-header-left">
              <div class="gallery-header-icon">&#127912;</div>
              <div>
                <h2>浏览图库</h2>
                <p>点击图片查看大图</p>
              </div>
            </div>
            <div class="device-toggle">
              <button class="active" onclick="switchDevice('pc', this)">PC 端</button>
              <button onclick="switchDevice('pe', this)">移动端</button>
            </div>
          </div>
          <div class="gallery-body">
            <div class="gallery-stats">
              <span class="badge" id="imageCount">加载中...</span>
              <span>设备类型：<span id="currentDevice">PC 端</span></span>
            </div>
            <div id="galleryGrid" class="gallery-grid"></div>
            <div class="pagination">
              <button id="prevBtn" onclick="prevPage()" disabled>
                <span>&#9664;</span><span>上一页</span>
              </button>
              <span class="page-info" id="pageInfo">1 / 1</span>
              <button id="nextBtn" onclick="nextPage()">
                <span>下一页</span><span>&#9654;</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 图片预览模态框 -->
    <div id="imageModal" class="image-modal" onclick="closeModal()">
      <div class="modal-close">&#10005;</div>
      <img id="modalImage" src="" alt="图片预览" />
    </div>

    <!-- 文档页 -->
    <div id="docs-page" class="page">
      <section class="section" style="padding-top: 48px;">
        <div class="section-header">
          <div class="section-tag">Documentation</div>
          <h2 class="section-title">API <span class="gradient-text">文档</span></h2>
          <p class="section-desc">完整的接口使用指南与参考，快速集成随机图片服务</p>
        </div>

        <div class="docs-grid">
          <!-- /api 端点 -->
          <div class="endpoint-card">
            <div class="endpoint-header">
              <span class="endpoint-method">GET</span>
              <span class="endpoint-path">/api</span>
              <span class="endpoint-desc">获取随机图片，支持多种返回格式</span>
            </div>
            <div class="endpoint-body">
              <div class="endpoint-section-title">请求参数</div>

              <div class="parameter">
                <div class="parameter-header">
                  <span class="parameter-name">count</span>
                  <span class="parameter-type">integer</span>
                  <span class="parameter-optional">可选</span>
                </div>
                <div class="parameter-description">返回图片数量，范围 1-50</div>
                <div class="parameter-default">默认值: 1</div>
              </div>

              <div class="parameter">
                <div class="parameter-header">
                  <span class="parameter-name">type</span>
                  <span class="parameter-type">string</span>
                  <span class="parameter-optional">可选</span>
                </div>
                <div class="parameter-description">设备类型，决定返回图片的适配方向</div>
                <div class="parameter-default">可选值: pc（横屏）、pe（竖屏） | 默认: 自动检测</div>
              </div>

              <div class="parameter">
                <div class="parameter-header">
                  <span class="parameter-name">format</span>
                  <span class="parameter-type">string</span>
                  <span class="parameter-optional">可选</span>
                </div>
                <div class="parameter-description">图片格式</div>
                <div class="parameter-default">可选值: webp | 默认: webp</div>
              </div>

              <div class="parameter">
                <div class="parameter-header">
                  <span class="parameter-name">return</span>
                  <span class="parameter-type">string</span>
                  <span class="parameter-optional">可选</span>
                </div>
                <div class="parameter-description">返回类型</div>
                <div class="parameter-default">可选值: redirect、json、text | 默认: json</div>
              </div>

              <div class="endpoint-section-title">响应示例</div>
              <div class="response-block">
                <pre>{\n  "success": true,\n  "count": 10,\n  "type": "pc",\n  "format": "webp",\n  "images": [\n    {\n      "url": "https://example.com/converted/pc/webp/xxx.webp",\n      "format": "webp",\n      "type": "pc"\n    }\n  ]\n}</pre>
              </div>

              <div class="endpoint-section-title">使用示例</div>
              <div class="code-block">
                <div class="code-header">
                  <span class="code-lang">HTTP</span>
                  <button class="code-copy" onclick="copyCode(this)">复制</button>
                </div>
                <pre># 获取10张随机图片\nGET /api?count=10\n\n# 获取移动设备图片\nGET /api?type=pe&count=5\n\n# 直接重定向到图片\nGET /api?count=1&return=redirect\n\n# 获取纯文本链接\nGET /api?count=5&return=text</pre>
              </div>
            </div>
          </div>

          <!-- /image 端点 -->
          <div class="endpoint-card">
            <div class="endpoint-header">
              <span class="endpoint-method">GET</span>
              <span class="endpoint-path">/image</span>
              <span class="endpoint-desc">直接返回随机图片（302 重定向）</span>
            </div>
            <div class="endpoint-body">
              <div class="endpoint-section-title">使用示例</div>
              <div class="code-block">
                <div class="code-header">
                  <span class="code-lang">HTTP / HTML / CSS</span>
                  <button class="code-copy" onclick="copyCode(this)">复制</button>
                </div>
                <pre># 直接获取随机图片\nGET /image\n\n# 在 HTML 中使用\n&lt;img src="https://your-domain.com/image" /&gt;\n\n# 在 CSS 中使用\nbackground-image: url('https://your-domain.com/image');</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 错误码 & 特性 -->
        <div class="section" style="padding-top: 48px;">
          <div class="section-header" style="margin-bottom: 32px;">
            <div class="section-tag">Reference</div>
            <h2 class="section-title" style="font-size: 2em;">错误码与<span class="gradient-text">特性</span></h2>
          </div>
          <div class="faq-grid">
            <div class="faq-card error">
              <div class="faq-card-title">404</div>
              <div class="faq-card-desc">未找到图片资源</div>
            </div>
            <div class="faq-card error">
              <div class="faq-card-title">500</div>
              <div class="faq-card-desc">服务器内部错误</div>
            </div>
            <div class="faq-card">
              <div class="faq-card-title">&#128241; 设备检测</div>
              <div class="faq-card-desc">根据 User-Agent 自动识别 PC 或移动设备</div>
            </div>
            <div class="faq-card">
              <div class="faq-card-title">&#128444; 格式优化</div>
              <div class="faq-card-desc">自动返回 WebP 格式，兼顾质量与体积</div>
            </div>
            <div class="faq-card">
              <div class="faq-card-title">&#128640; 零配置</div>
              <div class="faq-card-desc">直接访问端点即可使用，无需任何参数</div>
            </div>
            <div class="faq-card">
              <div class="faq-card-title">&#9889; 边缘加速</div>
              <div class="faq-card-desc">全球边缘节点就近响应，低延迟分发</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <p>&copy; 2026 <a href="https://www.sylv.top" target="_blank">Sylvy</a>. All rights reserved.</p>
      <p><a href="https://beian.miit.gov.cn/" target="_blank">豫ICP备2026013756号-1</a></p>
    </div>
  </footer>

  <script>
    function showPage(page, el) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
      document.getElementById(page + '-page').classList.add('active');
      el.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (page === 'gallery') loadGallery('pc');
    }

    function fetchRandomImage() {
      const btn = document.getElementById('testBtn');
      const img = document.getElementById('previewImage');
      const info = document.getElementById('previewInfo');
      const formatSpan = document.getElementById('previewFormat');
      const typeSpan = document.getElementById('previewType');
      const sizeSpan = document.getElementById('previewSize');

      const originalText = btn.innerHTML;
      btn.innerHTML = '<span>...</span><span>加载中</span>';
      btn.disabled = true;

      fetch('/api?count=1&_t=' + Date.now())
        .then(r => r.json())
        .then(data => {
          if (data.success && data.images.length > 0) {
            img.src = data.images[0].url + '?_t=' + Date.now();
            img.style.display = 'block';
            info.style.display = 'inline-flex';
            formatSpan.textContent = data.format.toUpperCase();
            typeSpan.textContent = data.type === 'pc' ? 'PC 端' : '移动端';
            sizeSpan.textContent = '计算中...';
            img.onload = function() {
              sizeSpan.textContent = img.naturalWidth + ' x ' + img.naturalHeight;
            };
          }
        })
        .catch(err => {
          info.style.display = 'inline-flex';
          info.innerHTML = '<span>!</span><span>加载失败，请重试</span>';
        })
        .finally(() => {
          btn.innerHTML = originalText;
          btn.disabled = false;
        });
    }

    function copyCode(btn) {
      const codeBlock = btn.closest('.code-block').querySelector('pre');
      const text = codeBlock.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.textContent;
        btn.textContent = '已复制';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove('copied');
        }, 2000);
      });
    }

    let imageData = null;
    let currentType = 'pc';
    let currentPage = 1;
    const imagesPerPage = 12;

    function switchDevice(type, btn) {
      document.querySelectorAll('.device-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = type;
      currentPage = 1;
      document.getElementById('currentDevice').textContent = type === 'pc' ? 'PC 端' : '移动端';
      loadGallery(type);
    }

    function loadGallery(type) {
      if (!imageData) {
        fetch('/image-list.json')
          .then(r => r.json())
          .then(data => {
            imageData = data;
            renderGallery(type);
          });
      } else {
        renderGallery(type);
      }
    }

    function renderGallery(type) {
      const grid = document.getElementById('galleryGrid');
      const count = document.getElementById('imageCount');
      const images = imageData[type]?.webp || [];

      count.textContent = '共 ' + images.length + ' 张图片';

      const totalPages = Math.ceil(images.length / imagesPerPage);
      const startIndex = (currentPage - 1) * imagesPerPage;
      const endIndex = Math.min(startIndex + imagesPerPage, images.length);
      const pageImages = images.slice(startIndex, endIndex);

      grid.innerHTML = pageImages.map((name, index) =>
        '<div class="gallery-item" onclick="openModal(this)" style="animation: fadeInUp 0.5s ease ' + (index * 0.04) + 's both;">' +
          '<img src="/converted/' + type + '/webp/' + name + '.webp" loading="lazy" alt="' + name + '" />' +
          '<div class="gallery-item-overlay">' + name.substring(0, 20) + '...</div>' +
        '</div>'
      ).join('');

      document.getElementById('pageInfo').textContent = currentPage + ' / ' + totalPages;
      document.getElementById('prevBtn').disabled = currentPage <= 1;
      document.getElementById('nextBtn').disabled = currentPage >= totalPages;
    }

    function prevPage() {
      if (currentPage > 1) {
        currentPage--;
        renderGallery(currentType);
      }
    }

    function nextPage() {
      const images = imageData[currentType]?.webp || [];
      const totalPages = Math.ceil(images.length / imagesPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderGallery(currentType);
      }
    }

    function openModal(element) {
      const img = element.querySelector('img');
      const modal = document.getElementById('imageModal');
      const modalImg = document.getElementById('modalImage');
      modalImg.src = img.src;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      const modal = document.getElementById('imageModal');
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>`;
  fs.writeFileSync(indexHtmlPath, indexHtmlContent);
  console.log('Created index.html');
  
  // 构建完成，不需要创建API和image目录，使用边缘函数处理这些路径
  console.log('Build completed successfully!');
}

// 执行构建
build();