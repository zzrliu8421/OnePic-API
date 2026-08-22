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
  <meta name="description" content="OnePic API —— 基于边缘计算的随机图片服务，WebP 格式，自动适配 PC 与移动端。">
  <meta name="theme-color" content="#161412">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='14' fill='%23cf5f45'/><text x='50' y='69' font-size='56' text-anchor='middle' fill='white' font-family='Georgia,serif'>P</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;700&family=Noto+Sans+SC:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --paper: #161412;
      --surface: #1d1b18;
      --sunken: #272420;
      --ink: #ece9e4;
      --ink-2: #a39d94;
      --ink-3: #6e6961;
      --line: #2c2925;
      --line-strong: #403c36;
      --accent: #cf5f45;
      --accent-ink: #e07a60;
      --accent-wash: rgba(207, 95, 69, 0.12);
      --ok: #85b194;
      --font-display: 'Noto Serif SC', 'Songti SC', serif;
      --font-body: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      --r-sm: 6px;
      --r-md: 8px;
      --r-lg: 10px;
      --shadow-modal: 0 24px 64px rgba(0, 0, 0, 0.6);
      --ease: 160ms ease;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }

    body {
      font-family: var(--font-body);
      font-size: 15px;
      background: var(--paper);
      color: var(--ink);
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    ::selection { background: rgba(207, 95, 69, 0.30); color: #f5f1ea; }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: var(--paper); }
    ::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 5px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--ink-3); }

    button { font-family: inherit; }
    a:focus-visible, button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      border-radius: 2px;
    }

    .container { max-width: 1080px; margin: 0 auto; padding: 0 24px; }

    /* ===== 顶栏 ===== */
    .topbar {
      position: sticky;
      top: 0;
      z-index: 50;
      background: var(--paper);
      border-bottom: 1px solid var(--line);
    }

    .topbar-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 0;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: var(--ink);
    }

    .logo-mark {
      width: 26px;
      height: 26px;
      border-radius: var(--r-sm);
      background: var(--accent);
      color: #fff;
      display: grid;
      place-items: center;
      font-family: var(--font-display);
      font-size: 15px;
      line-height: 1;
    }

    .logo-name {
      font-weight: 600;
      font-size: 17px;
      letter-spacing: -0.2px;
    }

    .nav { display: flex; gap: 28px; }

    .nav a {
      font-size: 14px;
      color: var(--ink-2);
      text-decoration: none;
      padding: 4px 0 6px;
      border-bottom: 2px solid transparent;
      transition: color var(--ease), border-color var(--ease);
    }

    .nav a:hover { color: var(--ink); }
    .nav a.active { color: var(--ink); border-color: var(--accent); }

    /* ===== Hero ===== */
    .hero { text-align: center; padding: 88px 0 64px; }

    .eyebrow {
      font-size: 12px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--ink-3);
      margin-bottom: 22px;
    }

    .hero h1 {
      font-family: var(--font-display);
      font-size: clamp(34px, 5vw, 52px);
      font-weight: 600;
      line-height: 1.25;
      color: var(--ink);
      margin-bottom: 20px;
    }

    .hero .lede {
      font-size: 16px;
      line-height: 1.85;
      color: var(--ink-2);
      max-width: 520px;
      margin: 0 auto;
    }

    .hero-actions {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 36px;
    }

    /* ===== 按钮 ===== */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 26px;
      border-radius: var(--r-sm);
      border: 1px solid transparent;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.5;
      cursor: pointer;
      text-decoration: none;
      transition: background-color var(--ease), border-color var(--ease), color var(--ease);
    }

    .btn-primary { background: var(--ink); color: #161412; }
    .btn-primary:hover { background: #dbd7cf; }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

    .btn-secondary {
      background: transparent;
      color: var(--ink);
      border-color: var(--line-strong);
    }
    .btn-secondary:hover { border-color: var(--ink); }

    /* ===== 数据事实行 ===== */
    .facts {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 22px 0;
      margin-top: 72px;
    }

    .fact-value {
      font-family: var(--font-mono);
      font-size: 20px;
      font-weight: 500;
      color: var(--ink);
      line-height: 1.3;
    }

    .fact-label {
      font-size: 12px;
      letter-spacing: 1px;
      color: var(--ink-3);
      margin-top: 2px;
    }

    /* ===== 区块标题 ===== */
    .section { padding-top: 64px; }

    .section-head { text-align: center; margin-bottom: 40px; }

    .section-head h2 {
      font-family: var(--font-display);
      font-size: 26px;
      font-weight: 600;
      color: var(--ink);
      margin-bottom: 8px;
    }

    .section-head p { font-size: 14px; color: var(--ink-3); }

    /* ===== Features ===== */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .feature-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--r-md);
      padding: 26px 24px;
      transition: border-color var(--ease);
    }

    .feature-card:hover { border-color: var(--line-strong); }

    .feature-icon { color: var(--accent); }
    .feature-icon svg { width: 26px; height: 26px; display: block; }

    .feature-card h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--ink);
      margin: 16px 0 6px;
    }

    .feature-card p {
      font-size: 13.5px;
      line-height: 1.75;
      color: var(--ink-2);
    }

    /* ===== 在线体验 ===== */
    .test-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--r-lg);
      padding: 48px 32px;
      text-align: center;
    }

    .test-card h2 {
      font-family: var(--font-display);
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .test-card .test-desc { font-size: 14px; color: var(--ink-3); margin-bottom: 28px; }

    .preview-image {
      display: block;
      max-width: 100%;
      max-height: 420px;
      margin: 36px auto 0;
      border: 1px solid var(--line);
      border-radius: var(--r-md);
    }

    .preview-meta {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 18px;
      font-size: 13px;
      color: var(--ink-2);
    }

    .preview-meta span + span::before {
      content: '·';
      margin: 0 12px;
      color: var(--ink-3);
    }

    /* ===== 三步流程 ===== */
    .process-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 40px;
    }

    .process-num {
      font-family: var(--font-display);
      font-size: 34px;
      font-weight: 600;
      line-height: 1;
      color: var(--accent);
    }

    .process-step::before {
      content: '';
      display: block;
      width: 32px;
      height: 2px;
      background: var(--accent);
      margin: 16px 0 18px;
    }

    .process-step h3 { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
    .process-step p { font-size: 13.5px; line-height: 1.75; color: var(--ink-2); }

    /* ===== 图库 ===== */
    .gallery-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--r-lg);
      overflow: hidden;
    }

    .gallery-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 18px 24px;
      border-bottom: 1px solid var(--line);
    }

    .gallery-toolbar h3 { font-size: 15px; font-weight: 600; }
    .gallery-toolbar .hint { font-size: 12.5px; color: var(--ink-3); margin-left: 10px; }

    .device-toggle {
      display: inline-flex;
      gap: 2px;
      background: var(--sunken);
      border-radius: var(--r-sm);
      padding: 3px;
    }

    .device-toggle button {
      padding: 7px 18px;
      border: 0;
      background: transparent;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      color: var(--ink-2);
      cursor: pointer;
      transition: color var(--ease), background-color var(--ease), box-shadow var(--ease);
    }

    .device-toggle button.active {
      background: var(--surface);
      color: var(--ink);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }

    .device-toggle button:not(.active):hover { color: var(--ink); }

    .gallery-body { padding: 24px; }

    .gallery-stats {
      display: flex;
      align-items: baseline;
      gap: 16px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--ink-3);
      margin-bottom: 16px;
    }

    .gallery-stats .stats-device { font-family: var(--font-body); font-size: 12.5px; }

    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 14px;
    }

    .gallery-item {
      aspect-ratio: 1;
      border-radius: var(--r-md);
      overflow: hidden;
      position: relative;
      background: var(--sunken);
      cursor: zoom-in;
    }

    .gallery-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: opacity var(--ease);
    }

    .gallery-item:hover img { opacity: 0.82; }

    .gallery-item-overlay {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 8px 10px;
      background: rgba(12, 10, 8, 0.82);
      color: #fff;
      font-family: var(--font-mono);
      font-size: 11px;
      opacity: 0;
      transition: opacity var(--ease);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .gallery-item:hover .gallery-item-overlay { opacity: 1; }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      margin-top: 24px;
    }

    .pagination .btn { padding: 8px 18px; font-size: 13px; }
    .pagination .btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .pagination .btn:disabled:hover { border-color: var(--line-strong); }

    .page-info {
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--ink-2);
      min-width: 64px;
      text-align: center;
    }

    /* ===== 模态框 ===== */
    .image-modal {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(10, 9, 8, 0.93);
      cursor: zoom-out;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }

    .image-modal.active { display: flex; animation: fadeIn 0.2s ease; }

    .image-modal img {
      max-width: 90%;
      max-height: 86vh;
      object-fit: contain;
      border-radius: var(--r-md);
      box-shadow: var(--shadow-modal);
    }

    .modal-close {
      position: absolute;
      top: 24px;
      right: 28px;
      width: 38px;
      height: 38px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: rgba(255, 255, 255, 0.85);
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background-color var(--ease);
    }

    .modal-close:hover { background: rgba(255, 255, 255, 0.12); }

    /* ===== 文档 ===== */
    .docs-stack { display: grid; gap: 16px; }

    .endpoint-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--r-md);
      overflow: hidden;
    }

    .endpoint-head {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding: 15px 22px;
      border-bottom: 1px solid var(--line);
    }

    .endpoint-method {
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 1px;
      color: var(--accent);
      background: var(--accent-wash);
      border: 1px solid rgba(207, 95, 69, 0.55);
      border-radius: var(--r-sm);
      padding: 2px 10px;
    }

    .endpoint-path {
      font-family: var(--font-mono);
      font-size: 14.5px;
      font-weight: 500;
      color: var(--ink);
    }

    .endpoint-desc { font-size: 13px; color: var(--ink-3); margin-left: auto; }

    .endpoint-body { padding: 20px 22px 24px; }

    .doc-label {
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--ink-3);
      margin: 22px 0 4px;
    }

    .endpoint-body .doc-label:first-child { margin-top: 0; }

    .param-row { padding: 13px 0; }
    .param-row + .param-row { border-top: 1px solid var(--line); }

    .param-line {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 10px;
    }

    .param-name {
      font-family: var(--font-mono);
      font-size: 13.5px;
      font-weight: 500;
      color: var(--ink);
    }

    .chip {
      font-family: var(--font-mono);
      font-size: 11px;
      padding: 1px 8px;
      border-radius: var(--r-sm);
      background: var(--sunken);
      color: var(--ink-2);
    }

    .param-desc { font-size: 13.5px; line-height: 1.7; color: var(--ink-2); margin-top: 5px; }
    .param-default { font-family: var(--font-mono); font-size: 12px; color: var(--ink-3); margin-top: 3px; }

    .code-block {
      background: var(--sunken);
      border: 1px solid var(--line);
      border-radius: var(--r-md);
      margin-top: 12px;
      overflow: hidden;
    }

    .code-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 14px;
      border-bottom: 1px solid var(--line);
    }

    .code-lang { font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); }

    .copy-btn {
      border: 0;
      background: transparent;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--ink-2);
      cursor: pointer;
      padding: 3px 8px;
      transition: color var(--ease);
    }

    .copy-btn:hover { color: var(--accent); }
    .copy-btn.copied { color: var(--ok); }

    .code-block pre {
      margin: 0;
      padding: 14px 16px;
      font-family: var(--font-mono);
      font-size: 12.5px;
      line-height: 1.75;
      color: #cbc6bd;
      overflow-x: auto;
    }

    /* ===== 参考卡片 ===== */
    .ref-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }

    .ref-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--r-md);
      padding: 18px;
    }

    .ref-card.error { border-left: 2px solid var(--accent); }

    .ref-card h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--ink);
    }

    .ref-card.error h4 { font-family: var(--font-mono); color: var(--accent); }
    .ref-card h4 svg { width: 16px; height: 16px; color: var(--ink-2); flex-shrink: 0; }
    .ref-card p { font-size: 13px; line-height: 1.7; color: var(--ink-2); margin-top: 6px; }

    /* ===== 页脚 ===== */
    .footer {
      margin-top: 88px;
      border-top: 1px solid var(--line);
      padding: 32px 0 40px;
      text-align: center;
    }

    .footer p { font-size: 12.5px; color: var(--ink-3); }
    .footer p + p { margin-top: 6px; font-size: 12px; }
    .footer a { color: var(--ink-2); text-decoration: none; transition: color var(--ease); }
    .footer a:hover { color: var(--ink); }

    /* ===== 页面切换与动效 ===== */
    .page { display: none; }
    .page.active { display: block; animation: fadeUp 0.24s ease; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation: none !important; transition: none !important; }
      html { scroll-behavior: auto; }
    }

    /* ===== 响应式 ===== */
    @media (max-width: 900px) {
      .features-grid { grid-template-columns: repeat(2, 1fr); }
      .process-grid { grid-template-columns: 1fr; gap: 32px; }
      .facts { grid-template-columns: repeat(2, 1fr); row-gap: 20px; }
    }

    @media (max-width: 768px) {
      .hero { padding: 60px 0 48px; }
      .topbar-inner { flex-direction: column; gap: 10px; }
      .test-card { padding: 36px 20px; }
      .gallery-body { padding: 18px; }
      .gallery-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
      .endpoint-head { align-items: flex-start; flex-direction: column; gap: 8px; }
      .endpoint-desc { margin-left: 0; }
      .hero-actions { flex-direction: column; align-items: stretch; }
      .hero-actions .btn { width: 100%; }
    }

    @media (max-width: 480px) {
      .container { padding: 0 16px; }
      .features-grid { grid-template-columns: 1fr; }
      .gallery-grid { grid-template-columns: repeat(2, 1fr); }
      .section { padding-top: 48px; }
    }
  </style>
</head>
<body>
  <!-- 顶栏 -->
  <header class="topbar">
    <div class="container topbar-inner">
      <a class="logo" href="#" onclick="showPage('home', document.querySelectorAll('.nav a')[0]); return false;">
        <span class="logo-mark">P</span>
        <span class="logo-name">OnePic</span>
      </a>
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
      <section class="hero">
        <p class="eyebrow">Edge Random Image Service</p>
        <h1>随机图片，边缘分发</h1>
        <p class="lede">基于边缘计算的高性能图片 API 服务，为 Web 应用提供低延迟、高质量的随机图片分发能力。</p>
        <div class="hero-actions">
          <button class="btn btn-primary" onclick="document.getElementById('testBtn').scrollIntoView({behavior:'smooth'});">立即体验</button>
          <a href="#" class="btn btn-secondary" onclick="showPage('docs', document.querySelectorAll('.nav a')[2]); return false;">查看文档</a>
        </div>
      </section>

      <!-- 真实数据（构建期注入） -->
      <div class="facts">
        <div class="fact">
          <div class="fact-value">${imageFileList.pc.webp.length}</div>
          <div class="fact-label">PC 图池 · 张</div>
        </div>
        <div class="fact">
          <div class="fact-value">${imageFileList.pe.webp.length}</div>
          <div class="fact-label">移动图池 · 张</div>
        </div>
        <div class="fact">
          <div class="fact-value">WebP</div>
          <div class="fact-label">图片格式</div>
        </div>
        <div class="fact">
          <div class="fact-value">v3.0</div>
          <div class="fact-label">API 版本</div>
        </div>
      </div>

      <!-- 特性 -->
      <section class="section">
        <div class="section-head">
          <h2>为速度而生</h2>
          <p>构建世界级产品所需的一切能力，协同工作，无缝衔接。</p>
        </div>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
            <h3>边缘计算</h3>
            <p>基于边缘函数，全球节点就近响应，零延迟缓存，运行时无额外请求。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg></div>
            <h3>设备适配</h3>
            <p>自动检测客户端设备类型，智能返回 PC 端或移动端适配图片。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 15-4.2-4.2a1.5 1.5 0 0 0-2.1 0L7 18"/></svg></div>
            <h3>WebP 优化</h3>
            <p>采用现代 WebP 格式，体积更小、质量更高，兼顾性能与体验。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none"/></svg></div>
            <h3>随机分发</h3>
            <p>从图片池随机选择，支持单张或批量获取，JSON、重定向、文本多种返回。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13.5 9 5 9-5"/></svg></div>
            <h3>多平台部署</h3>
            <p>同时支持腾讯云 EdgeOne Pages 和阿里云 ESA，灵活选择部署平台。</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></div>
            <h3>零配置使用</h3>
            <p>直接访问 /api 或 /image 即可获取图片，无需复杂参数配置。</p>
          </div>
        </div>
      </section>

      <!-- 在线体验 -->
      <section class="section">
        <div class="test-card">
          <h2>在线体验</h2>
          <p class="test-desc">点击按钮获取一张随机图片，感受边缘加速。</p>
          <button class="btn btn-primary" id="testBtn" onclick="fetchRandomImage()">获取随机图片</button>
          <img id="previewImage" class="preview-image" style="display:none;" alt="预览图片">
          <div id="previewMeta" class="preview-meta" style="display:none;">
            <span id="previewFormat"></span>
            <span id="previewType"></span>
            <span id="previewSize"></span>
          </div>
        </div>
      </section>

      <!-- 三步流程 -->
      <section class="section">
        <div class="section-head">
          <h2>三步开始使用</h2>
          <p>几分钟即可完成接入，无需复杂配置。</p>
        </div>
        <div class="process-grid">
          <div class="process-step">
            <div class="process-num">壹</div>
            <h3>调用接口</h3>
            <p>访问 /api 或 /image 端点，系统自动检测设备类型。</p>
          </div>
          <div class="process-step">
            <div class="process-num">贰</div>
            <h3>边缘响应</h3>
            <p>就近边缘节点处理请求，随机选择图片并返回。</p>
          </div>
          <div class="process-step">
            <div class="process-num">叁</div>
            <h3>集成使用</h3>
            <p>在 HTML、CSS 或应用中直接引用返回的图片 URL。</p>
          </div>
        </div>
      </section>
    </div>

    <!-- 图库页 -->
    <div id="gallery-page" class="page">
      <section class="section" style="padding-top: 48px;">
        <div class="section-head">
          <h2>图库</h2>
          <p>浏览所有可用图片资源，支持 PC 端与移动端切换。</p>
        </div>
        <div class="gallery-card">
          <div class="gallery-toolbar">
            <div>
              <h3 style="display:inline;">浏览图库</h3><span class="hint">点击缩略图查看大图</span>
            </div>
            <div class="device-toggle">
              <button class="active" onclick="switchDevice('pc', this)">PC 端</button>
              <button onclick="switchDevice('pe', this)">移动端</button>
            </div>
          </div>
          <div class="gallery-body">
            <div class="gallery-stats">
              <span id="imageCount">加载中…</span>
              <span class="stats-device">设备：<span id="currentDevice">PC 端</span></span>
            </div>
            <div id="galleryGrid" class="gallery-grid"></div>
            <div class="pagination">
              <button class="btn btn-secondary" id="prevBtn" onclick="prevPage()" disabled>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>
                上一页
              </button>
              <span class="page-info" id="pageInfo">1 / 1</span>
              <button class="btn btn-secondary" id="nextBtn" onclick="nextPage()">
                下一页
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10 6 6 6-6 6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 图片预览模态框 -->
    <div id="imageModal" class="image-modal" onclick="closeModal()">
      <button class="modal-close" aria-label="关闭">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <img id="modalImage" src="" alt="图片预览">
    </div>

    <!-- 文档页 -->
    <div id="docs-page" class="page">
      <section class="section" style="padding-top: 48px;">
        <div class="section-head">
          <h2>API 文档</h2>
          <p>完整的接口使用指南与参考，快速集成随机图片服务。</p>
        </div>

        <div class="docs-stack">
          <!-- /api -->
          <div class="endpoint-card">
            <div class="endpoint-head">
              <span class="endpoint-method">GET</span>
              <span class="endpoint-path">/api</span>
              <span class="endpoint-desc">获取随机图片，支持多种返回格式</span>
            </div>
            <div class="endpoint-body">
              <div class="doc-label">请求参数</div>

              <div class="param-row">
                <div class="param-line">
                  <span class="param-name">count</span>
                  <span class="chip">integer</span>
                  <span class="chip">可选</span>
                </div>
                <div class="param-desc">返回图片数量，范围 1–50。</div>
                <div class="param-default">默认值：1</div>
              </div>

              <div class="param-row">
                <div class="param-line">
                  <span class="param-name">type</span>
                  <span class="chip">string</span>
                  <span class="chip">可选</span>
                </div>
                <div class="param-desc">设备类型，决定返回图片的适配方向。</div>
                <div class="param-default">可选值：pc（横屏）、pe（竖屏）｜默认：自动检测</div>
              </div>

              <div class="param-row">
                <div class="param-line">
                  <span class="param-name">format</span>
                  <span class="chip">string</span>
                  <span class="chip">可选</span>
                </div>
                <div class="param-desc">图片格式。</div>
                <div class="param-default">可选值：webp｜默认：webp</div>
              </div>

              <div class="param-row">
                <div class="param-line">
                  <span class="param-name">return</span>
                  <span class="chip">string</span>
                  <span class="chip">可选</span>
                </div>
                <div class="param-desc">返回类型。</div>
                <div class="param-default">可选值：redirect、json、text｜默认：json</div>
              </div>

              <div class="doc-label">响应示例</div>
              <div class="code-block">
<pre>{
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
}</pre>
              </div>

              <div class="doc-label">使用示例</div>
              <div class="code-block">
                <div class="code-bar">
                  <span class="code-lang">HTTP</span>
                  <button class="copy-btn" onclick="copyCode(this)">复制</button>
                </div>
<pre># 获取 10 张随机图片
GET /api?count=10

# 获取移动端图片
GET /api?type=pe&amp;count=5

# 直接重定向到图片
GET /api?count=1&amp;return=redirect

# 获取纯文本链接
GET /api?count=5&amp;return=text</pre>
              </div>
            </div>
          </div>

          <!-- /image -->
          <div class="endpoint-card">
            <div class="endpoint-head">
              <span class="endpoint-method">GET</span>
              <span class="endpoint-path">/image</span>
              <span class="endpoint-desc">直接返回随机图片（302 重定向）</span>
            </div>
            <div class="endpoint-body">
              <div class="doc-label">使用示例</div>
              <div class="code-block">
                <div class="code-bar">
                  <span class="code-lang">HTTP / HTML / CSS</span>
                  <button class="copy-btn" onclick="copyCode(this)">复制</button>
                </div>
<pre># 直接获取随机图片
GET /image

# 在 HTML 中使用
&lt;img src="https://your-domain.com/image"&gt;

# 在 CSS 中使用
background-image: url('https://your-domain.com/image');</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 错误码与特性 -->
        <section class="section">
          <div class="section-head" style="margin-bottom: 28px;">
            <h2 style="font-size: 22px;">错误码与特性</h2>
          </div>
          <div class="ref-grid">
            <div class="ref-card error">
              <h4>404</h4>
              <p>未找到图片资源。</p>
            </div>
            <div class="ref-card error">
              <h4>500</h4>
              <p>服务器内部错误。</p>
            </div>
            <div class="ref-card">
              <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg>设备检测</h4>
              <p>根据 User-Agent 自动识别 PC 或移动设备。</p>
            </div>
            <div class="ref-card">
              <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 15-4.2-4.2a1.5 1.5 0 0 0-2.1 0L7 18"/></svg>格式优化</h4>
              <p>自动返回 WebP 格式，兼顾质量与体积。</p>
            </div>
            <div class="ref-card">
              <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>零配置</h4>
              <p>直接访问端点即可使用，无需任何参数。</p>
            </div>
            <div class="ref-card">
              <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>边缘加速</h4>
              <p>全球边缘节点就近响应，低延迟分发。</p>
            </div>
          </div>
        </section>
      </section>
    </div>
  </main>

  <!-- 页脚 -->
  <footer class="footer">
    <div class="container">
      <p>&copy; 2026 <a href="https://www.sylv.top" target="_blank" rel="noopener">Sylvy</a>. All rights reserved.</p>
      <p><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">豫ICP备2026013756号-1</a></p>
    </div>
  </footer>

  <script>
    function showPage(page, el) {
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      document.querySelectorAll('.nav a').forEach(function (a) { a.classList.remove('active'); });
      document.getElementById(page + '-page').classList.add('active');
      el.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (page === 'gallery') loadGallery('pc');
    }

    function fetchRandomImage() {
      var btn = document.getElementById('testBtn');
      var img = document.getElementById('previewImage');
      var meta = document.getElementById('previewMeta');
      var formatSpan = document.getElementById('previewFormat');
      var typeSpan = document.getElementById('previewType');
      var sizeSpan = document.getElementById('previewSize');

      var originalText = btn.textContent;
      btn.textContent = '获取中…';
      btn.disabled = true;

      fetch('/api?count=1&_t=' + Date.now())
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success && data.images.length > 0) {
            meta.style.display = 'flex';
            formatSpan.textContent = data.format.toUpperCase();
            typeSpan.textContent = data.type === 'pc' ? 'PC 端' : '移动端';
            sizeSpan.textContent = '读取尺寸…';
            img.onload = function () {
              sizeSpan.textContent = img.naturalWidth + ' × ' + img.naturalHeight;
            };
            img.onerror = function () {
              sizeSpan.textContent = '图片加载失败';
            };
            img.src = data.images[0].url + '?_t=' + Date.now();
          } else {
            meta.style.display = 'flex';
            typeSpan.textContent = '-';
            formatSpan.textContent = '-';
            sizeSpan.textContent = '获取失败，请重试';
          }
        })
        .catch(function () {
          meta.style.display = 'flex';
          typeSpan.textContent = '-';
          formatSpan.textContent = '-';
          sizeSpan.textContent = '加载失败，请重试';
        })
        .finally(function () {
          btn.textContent = originalText;
          btn.disabled = false;
        });
    }

    function copyCode(btn) {
      var pre = btn.closest('.code-block').querySelector('pre');
      navigator.clipboard.writeText(pre.textContent).then(function () {
        btn.textContent = '已复制';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = '复制';
          btn.classList.remove('copied');
        }, 1600);
      });
    }

    var imageData = null;
    var currentType = 'pc';
    var currentPage = 1;
    var imagesPerPage = 12;

    function switchDevice(type, btn) {
      document.querySelectorAll('.device-toggle button').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentType = type;
      currentPage = 1;
      document.getElementById('currentDevice').textContent = type === 'pc' ? 'PC 端' : '移动端';
      loadGallery(type);
    }

    function loadGallery(type) {
      if (!imageData) {
        fetch('/image-list.json')
          .then(function (r) { return r.json(); })
          .then(function (data) {
            imageData = data;
            renderGallery(type);
          });
      } else {
        renderGallery(type);
      }
    }

    function renderGallery(type) {
      var grid = document.getElementById('galleryGrid');
      var count = document.getElementById('imageCount');
      var images = (imageData[type] && imageData[type].webp) ? imageData[type].webp : [];

      count.textContent = '共 ' + images.length + ' 张';

      var totalPages = Math.max(1, Math.ceil(images.length / imagesPerPage));
      var startIndex = (currentPage - 1) * imagesPerPage;
      var endIndex = Math.min(startIndex + imagesPerPage, images.length);
      var pageImages = images.slice(startIndex, endIndex);

      grid.innerHTML = pageImages.map(function (name, index) {
        return '<div class="gallery-item" onclick="openModal(this)" style="animation:fadeUp 0.24s ease ' + (index * 0.04) + 's both;">'
          + '<img src="/converted/' + type + '/webp/' + name + '.webp" loading="lazy" alt="' + name + '">'
          + '<div class="gallery-item-overlay">' + name.substring(0, 20) + '</div>'
          + '</div>';
      }).join('');

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
      var images = (imageData[currentType] && imageData[currentType].webp) ? imageData[currentType].webp : [];
      var totalPages = Math.ceil(images.length / imagesPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderGallery(currentType);
      }
    }

    function openModal(element) {
      var img = element.querySelector('img');
      var modal = document.getElementById('imageModal');
      var modalImg = document.getElementById('modalImage');
      modalImg.src = img.src;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      var modal = document.getElementById('imageModal');
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    document.addEventListener('keydown', function (e) {
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