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

// 主处理函数
export default function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
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
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const fileCount = files.length;
  
  // 处理重定向
  if (returnType === 'redirect') {
    const randomImage = files[Math.floor(Math.random() * fileCount)];
    const imageUrl = \`\${url.origin}/converted/\${type}/\${format}/\${randomImage}.\${format}\`;
    
    return new Response(null, {
      status: 302,
      headers: { 'Location': imageUrl }
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
      headers: { 'Content-Type': 'text/plain' }
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
    headers: { 'Content-Type': 'application/json' }
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

// 主处理函数
export default function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const userAgent = request.headers.get('User-Agent') || '';
  const acceptHeader = request.headers.get('Accept') || '';
  
  const type = detectDeviceType(userAgent);
  const format = detectImageFormat(acceptHeader);
  
  const files = IMAGE_LIST[type]?.[format];
  if (!files || files.length === 0) {
    return new Response('No images found', { status: 404 });
  }
  
  const randomImage = files[Math.floor(Math.random() * files.length)];
  const imageUrl = \`\${url.origin}/converted/\${type}/\${format}/\${randomImage}.\${format}\`;
  
  return new Response(null, {
    status: 302,
    headers: { 'Location': imageUrl }
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
  <title>OnePic API</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2358a6ff'/><text x='50' y='68' font-size='60' text-anchor='middle' fill='white'>P</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0f1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #1c2128;
      --bg-hover: #21262d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --text-tertiary: #6e7681;
      --text-muted: #484f58;
      --accent: #58a6ff;
      --accent-hover: #79b8ff;
      --accent-soft: rgba(88, 166, 255, 0.08);
      --border: #30363d;
      --border-hover: #3d444d;
      --success: #3fb950;
      --success-bg: rgba(63, 185, 80, 0.1);
      --warning: #d29922;
      --danger: #f85149;
      --danger-bg: rgba(248, 81, 73, 0.1);
      --shadow-xs: 0 1px 2px rgba(0,0,0,0.3);
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -2px rgba(0,0,0,0.4);
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.6), 0 4px 6px -4px rgba(0,0,0,0.5);
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-xl: 16px;
      --transition-fast: 0.15s ease;
      --transition-base: 0.2s ease;
      --transition-slow: 0.35s ease;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }

    body {
      font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-primary);
      min-height: 100vh;
      color: var(--text-primary);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* Header */
    .header {
      text-align: center;
      padding: 64px 0 40px;
    }

    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      background: var(--success-bg);
      border: 1px solid rgba(63, 185, 80, 0.2);
      border-radius: 50px;
      font-size: 0.82em;
      font-weight: 500;
      color: var(--success);
      margin-bottom: 20px;
      letter-spacing: 0.2px;
    }

    .header-badge::before {
      content: '';
      width: 5px; height: 5px;
      background: var(--success);
      border-radius: 50%;
      animation: pulse 2.5s ease infinite;
    }

    .header h1 {
      font-size: 2.6em;
      font-weight: 700;
      margin-bottom: 10px;
      color: var(--text-primary);
      letter-spacing: -0.5px;
      line-height: 1.2;
    }

    .header h1 span {
      color: var(--accent);
    }

    .header p {
      font-size: 1.05em;
      color: var(--text-tertiary);
      max-width: 440px;
      margin: 0 auto;
      line-height: 1.6;
    }

    /* Navigation */
    .nav {
      display: flex;
      justify-content: center;
      gap: 4px;
      margin-bottom: 36px;
      padding: 4px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 50px;
      width: fit-content;
      margin-left: auto;
      margin-right: auto;
      box-shadow: var(--shadow-xs);
    }

    .nav a {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 22px;
      color: var(--text-tertiary);
      text-decoration: none;
      border-radius: 50px;
      font-weight: 500;
      font-size: 0.92em;
      transition: all var(--transition-base);
      border: none;
      background: transparent;
      cursor: pointer;
      font-family: inherit;
    }

    .nav a:hover {
      color: var(--text-secondary);
      background: var(--bg-hover);
    }

    .nav a.active {
      background: var(--accent);
      color: #fff;
      box-shadow: var(--shadow-sm);
    }

    .nav a .nav-icon { font-size: 1em; opacity: 0.8; }

    /* Card */
    .card {
      background: var(--bg-secondary);
      border-radius: var(--radius-xl);
      overflow: hidden;
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      transition: box-shadow var(--transition-base);
    }

    .card:hover { box-shadow: var(--shadow-md); }

    .card-header {
      padding: 24px 28px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .card-header-icon {
      width: 36px; height: 36px;
      border-radius: var(--radius-md);
      background: var(--accent-soft);
      border: 1px solid rgba(88, 166, 255, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1em;
      flex-shrink: 0;
    }

    .card-header h2 {
      font-size: 1.15em;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: -0.2px;
    }

    .card-header p {
      color: var(--text-tertiary);
      font-size: 0.85em;
      margin-top: 2px;
    }

    .card-body { padding: 28px; }

    /* Status Section */
    .status-overview {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    .status-main {
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 22px;
      display: flex;
      align-items: center;
      gap: 16px;
      transition: all var(--transition-base);
    }

    .status-main:hover { border-color: var(--border-hover); }

    .status-icon-wrapper {
      width: 44px; height: 44px;
      border-radius: var(--radius-md);
      background: var(--success-bg);
      border: 1px solid rgba(63, 185, 80, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3em;
      flex-shrink: 0;
      position: relative;
    }

    .status-icon-wrapper .pulse-dot {
      position: absolute;
      top: 8px; right: 8px;
      width: 7px; height: 7px;
      background: var(--success);
      border-radius: 50%;
      border: 2px solid var(--bg-tertiary);
      animation: pulse 2.5s ease infinite;
    }

    .status-text { flex: 1; }

    .status-text .status-label {
      font-size: 0.78em;
      color: var(--text-muted);
      margin-bottom: 3px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-text .status-value {
      font-size: 1.1em;
      font-weight: 600;
      color: var(--success);
    }

    .status-uptime {
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 22px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      transition: all var(--transition-base);
    }

    .status-uptime:hover { border-color: var(--border-hover); }

    .uptime-value {
      font-size: 1.7em;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 3px;
      letter-spacing: -0.5px;
    }

    .uptime-label {
      font-size: 0.78em;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .info-item {
      background: var(--bg-tertiary);
      padding: 18px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      transition: all var(--transition-base);
    }

    .info-item:hover {
      border-color: var(--border-hover);
      background: var(--bg-secondary);
      box-shadow: var(--shadow-sm);
    }

    .info-item .label {
      font-size: 0.75em;
      color: var(--text-muted);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-item .value {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 0.98em;
    }

    .info-item .icon {
      font-size: 1.2em;
      margin-bottom: 8px;
      opacity: 0.6;
    }

    /* Test Section */
    .test-section {
      background: var(--bg-tertiary);
      border-radius: var(--radius-lg);
      padding: 28px;
      text-align: center;
      border: 1px solid var(--border);
    }

    .test-section-title {
      font-size: 1em;
      font-weight: 600;
      margin-bottom: 6px;
      color: var(--text-primary);
    }

    .test-section-desc {
      color: var(--text-tertiary);
      font-size: 0.88em;
      margin-bottom: 20px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 11px 28px;
      background: var(--accent);
      color: #fff;
      text-decoration: none;
      border-radius: var(--radius-md);
      font-weight: 500;
      font-size: 0.9em;
      border: 1px solid var(--accent);
      cursor: pointer;
      transition: all var(--transition-base);
      font-family: inherit;
    }

    .btn:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    .btn:active {
      transform: translateY(0);
      box-shadow: var(--shadow-xs);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-secondary {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--bg-hover);
      border-color: var(--border-hover);
    }

    .btn-group {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }

    /* Preview */
    .preview-container {
      margin-top: 24px;
      text-align: center;
    }

    .preview-image {
      max-width: 100%;
      max-height: 380px;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      display: block;
      margin: 0 auto;
      transition: all var(--transition-base);
      border: 1px solid var(--border);
    }

    .preview-image:hover { box-shadow: var(--shadow-lg); }

    .preview-info {
      margin-top: 14px;
      display: inline-flex;
      align-items: center;
      gap: 16px;
      padding: 8px 18px;
      background: var(--bg-tertiary);
      border-radius: 50px;
      border: 1px solid var(--border);
      font-size: 0.82em;
      color: var(--text-tertiary);
    }

    .preview-info span {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    /* Gallery */
    .gallery-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .device-toggle {
      display: flex;
      gap: 0;
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      padding: 3px;
    }

    .device-toggle button {
      padding: 7px 18px;
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
      background: var(--bg-secondary);
      color: var(--text-primary);
      box-shadow: var(--shadow-xs);
      border: 1px solid var(--border);
    }

    .device-toggle button:hover:not(.active) {
      color: var(--text-secondary);
    }

    .gallery-stats {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text-muted);
      font-size: 0.85em;
    }

    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
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
      background: linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%);
      opacity: 0;
      transition: opacity var(--transition-base);
    }

    .gallery-item:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: var(--border-hover);
    }

    .gallery-item:hover::after { opacity: 1; }

    .gallery-item img {
      width: 100%; height: 100%;
      object-fit: cover;
      transition: transform var(--transition-slow);
    }

    .gallery-item:hover img { transform: scale(1.05); }

    .gallery-item-overlay {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 10px;
      color: white;
      font-size: 0.75em;
      z-index: 2;
      opacity: 0;
      transform: translateY(6px);
      transition: all var(--transition-base);
    }

    .gallery-item:hover .gallery-item-overlay {
      opacity: 1;
      transform: translateY(0);
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      margin: 28px auto 0;
    }

    .pagination button {
      padding: 8px 18px;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-weight: 500;
      font-size: 0.85em;
      transition: all var(--transition-base);
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .pagination button:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--border-hover);
      color: var(--text-primary);
    }

    .pagination button:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .page-info {
      color: var(--text-tertiary);
      font-size: 0.88em;
      font-weight: 500;
      min-width: 60px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .image-modal {
      display: none;
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.88);
      z-index: 1000;
      cursor: pointer;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .image-modal.active {
      display: flex;
      animation: fadeIn 0.25s ease;
    }

    .image-modal img {
      max-width: 90%;
      max-height: 85vh;
      object-fit: contain;
      border-radius: var(--radius-md);
      box-shadow: 0 20px 50px rgba(0,0,0,0.4);
      animation: scaleIn 0.25s ease;
    }

    .modal-close {
      position: absolute;
      top: 20px; right: 28px;
      width: 38px; height: 38px;
      border-radius: 50%;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      transition: all var(--transition-base);
    }

    .modal-close:hover {
      color: #fff;
      background: rgba(255,255,255,0.2);
      border-color: rgba(255,255,255,0.3);
    }

    /* Docs */
    .docs-intro {
      background: var(--bg-tertiary);
      border-radius: var(--radius-lg);
      padding: 20px 22px;
      margin-bottom: 28px;
      border: 1px solid var(--border);
    }

    .docs-intro p {
      color: var(--text-secondary);
      line-height: 1.7;
      font-size: 0.92em;
    }

    .doc-section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 28px 0 16px;
      font-size: 1em;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: -0.2px;
    }

    .doc-section-title .section-number {
      width: 24px; height: 24px;
      border-radius: 50%;
      background: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75em;
      color: var(--bg-primary);
      flex-shrink: 0;
      font-weight: 600;
    }

    .endpoint {
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
      margin-bottom: 20px;
      border: 1px solid var(--border);
      overflow: hidden;
      transition: all var(--transition-base);
    }

    .endpoint:hover {
      border-color: var(--border-hover);
      box-shadow: var(--shadow-sm);
    }

    .endpoint-header {
      padding: 16px 20px;
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .endpoint-method {
      padding: 3px 10px;
      background: var(--accent);
      color: #fff;
      border-radius: var(--radius-sm);
      font-size: 0.75em;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.3px;
    }

    .endpoint-path {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.98em;
      color: var(--text-primary);
      font-weight: 500;
    }

    .endpoint-desc {
      color: var(--text-tertiary);
      font-size: 0.85em;
      margin-left: auto;
    }

    .endpoint-body { padding: 20px; }

    .endpoint-section-title {
      font-size: 0.78em;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 12px;
    }

    .parameter {
      margin: 10px 0;
      padding: 14px 16px;
      background: var(--bg-primary);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      transition: all var(--transition-base);
    }

    .parameter:hover { border-color: var(--border-hover); }

    .parameter-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }

    .parameter-name {
      font-weight: 600;
      color: var(--accent);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9em;
    }

    .parameter-type {
      padding: 2px 8px;
      background: var(--accent-soft);
      color: var(--accent);
      border-radius: 50px;
      font-size: 0.75em;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 500;
    }

    .parameter-optional {
      padding: 2px 8px;
      background: var(--bg-hover);
      color: var(--text-tertiary);
      border-radius: 50px;
      font-size: 0.75em;
    }

    .parameter-description {
      color: var(--text-secondary);
      font-size: 0.88em;
      line-height: 1.6;
    }

    .parameter-default {
      margin-top: 6px;
      font-size: 0.82em;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    .code-block {
      background: #0d1117;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      margin: 14px 0;
      overflow: hidden;
    }

    .code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid var(--border);
    }

    .code-lang {
      font-size: 0.75em;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    .code-copy {
      padding: 3px 10px;
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.75em;
      transition: all var(--transition-base);
      font-family: inherit;
    }

    .code-copy:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .code-copy.copied {
      border-color: var(--success);
      color: var(--success);
    }

    .code-block pre {
      padding: 16px 18px;
      margin: 0;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.84em;
      line-height: 1.7;
      color: #e2e8f0;
    }

    .response-block {
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 16px 18px;
      margin: 14px 0;
    }

    .response-block pre {
      color: var(--text-primary);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.84em;
      line-height: 1.7;
      margin: 0;
      overflow-x: auto;
    }

    .error-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }

    .error-item {
      padding: 14px 16px;
      background: var(--bg-primary);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      border-left: 3px solid var(--danger);
      transition: all var(--transition-base);
    }

    .error-item:hover {
      border-color: var(--danger);
      background: var(--danger-bg);
    }

    .error-code-value {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: var(--danger);
      font-size: 1em;
      margin-bottom: 3px;
    }

    .error-code-desc {
      color: var(--text-secondary);
      font-size: 0.85em;
    }

    .feature-list {
      list-style: none;
      padding: 0;
    }

    .feature-list li {
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: flex-start;
      gap: 10px;
      color: var(--text-secondary);
      font-size: 0.92em;
    }

    .feature-list li:last-child { border-bottom: none; }

    .feature-list .feature-icon {
      width: 20px; height: 20px;
      border-radius: 50%;
      background: var(--success-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7em;
      flex-shrink: 0;
      margin-top: 2px;
      color: var(--success);
    }

    .feature-list strong {
      color: var(--text-primary);
      font-weight: 600;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 36px 0;
      margin-top: 36px;
      border-top: 1px solid var(--border);
    }

    .footer p {
      color: var(--text-muted);
      font-size: 0.85em;
      margin-bottom: 6px;
    }

    .footer a {
      color: var(--text-tertiary);
      text-decoration: none;
      transition: color var(--transition-fast);
    }

    .footer a:hover { color: var(--accent); }

    /* Page transitions */
    .page {
      display: none;
      animation: fadeIn 0.3s ease;
    }

    .page.active { display: block; }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    ::-webkit-scrollbar-track { background: transparent; }

    ::-webkit-scrollbar-thumb {
      background: #3d444d;
      border-radius: 3px;
    }

    ::-webkit-scrollbar-thumb:hover { background: #484f58; }

    /* Responsive */
    @media (max-width: 768px) {
      .header h1 { font-size: 2em; }
      .header { padding: 48px 0 32px; }
      .nav {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: center;
        width: 100%;
      }
      .nav a { padding: 8px 18px; font-size: 0.88em; }
      .status-overview { grid-template-columns: 1fr; }
      .info-grid { grid-template-columns: repeat(2, 1fr); }
      .card-header { padding: 18px 20px; }
      .card-body { padding: 20px; }
      .gallery-grid {
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 10px;
      }
      .endpoint-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
      }
      .endpoint-desc { margin-left: 0; }
      .btn-group { flex-direction: column; align-items: center; }
      .btn { width: 100%; justify-content: center; }
    }

    @media (max-width: 480px) {
      .info-grid { grid-template-columns: 1fr; }
      .gallery-grid { grid-template-columns: repeat(2, 1fr); }
      .container { padding: 0 16px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>OnePic <span>API</span></h1>
      <p>基于边缘计算的随机图片服务，为 Web 应用提供高性能图片分发能力</p>
    </div>

    <div class="nav">
      <a href="#" class="active" onclick="showPage('home', this); return false;">
        <span>首页</span>
      </a>
      <a href="#" onclick="showPage('gallery', this); return false;">
        <span>图库</span>
      </a>
      <a href="#" onclick="showPage('docs', this); return false;">
        <span>文档</span>
      </a>
    </div>

    <!-- 首页 -->
    <div id="home-page" class="page active">
      <div class="card">
        <div class="card-header">
          <div class="card-header-icon">&#128640;</div>
          <div>
            <h2>服务状态</h2>
            <p>实时监控 API 服务运行状态</p>
          </div>
        </div>
        <div class="card-body">
          <div class="status-overview">
            <div class="status-main">
              <div class="status-icon-wrapper">
                <div class="pulse-dot"></div>
                &#10003;
              </div>
              <div class="status-text">
                <div class="status-label">系统状态</div>
                <div class="status-value">正常运行</div>
              </div>
            </div>
            <div class="status-uptime">
              <div class="uptime-value">99.9%</div>
              <div class="uptime-label">服务可用性</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <div class="icon">&#128225;</div>
              <div class="label">API 版本</div>
              <div class="value">v3.0</div>
            </div>
            <div class="info-item">
              <div class="icon">&#128444;</div>
              <div class="label">图片格式</div>
              <div class="value">WebP</div>
            </div>
            <div class="info-item">
              <div class="icon">&#128241;</div>
              <div class="label">设备支持</div>
              <div class="value">PC / 移动端</div>
            </div>
            <div class="info-item">
              <div class="icon">&#9729;</div>
              <div class="label">部署平台</div>
              <div class="value">EdgeOne Pages</div>
            </div>
          </div>

          <div class="test-section">
            <div class="test-section-title">API 测试</div>
            <div class="test-section-desc">点击下方按钮测试随机图片获取功能</div>
            <div class="btn-group">
              <button class="btn" id="testBtn" onclick="fetchRandomImage()">
                <span>获取随机图片</span>
              </button>
            </div>
          </div>

          <div class="preview-container">
            <img id="previewImage" class="preview-image" style="display:none;" alt="预览图片" />
            <div id="previewInfo" class="preview-info" style="display:none;">
              <span>&#128444; <span id="previewFormat"></span></span>
              <span>&#128187; <span id="previewType"></span></span>
              <span>&#128208; <span id="previewSize"></span></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图库页 -->
    <div id="gallery-page" class="page">
      <div class="card">
        <div class="card-header">
          <div class="card-header-icon">&#127912;</div>
          <div>
            <h2>图库浏览</h2>
            <p>浏览所有可用的图片资源</p>
          </div>
        </div>
        <div class="card-body">
          <div class="gallery-controls">
            <div class="device-toggle">
              <button class="active" onclick="switchDevice('pc', this)">PC 端</button>
              <button onclick="switchDevice('pe', this)">移动端</button>
            </div>
            <div class="gallery-stats">
              <span>&#128444;</span><span id="imageCount">加载中...</span>
            </div>
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
    </div>

    <!-- 图片预览模态框 -->
    <div id="imageModal" class="image-modal" onclick="closeModal()">
      <div class="modal-close">&#10005;</div>
      <img id="modalImage" src="" alt="图片预览" />
    </div>

    <!-- 文档页 -->
    <div id="docs-page" class="page">
      <div class="card">
        <div class="card-header">
          <div class="card-header-icon">&#128196;</div>
          <div>
            <h2>API 文档</h2>
            <p>完整的接口使用指南与参考</p>
          </div>
        </div>
        <div class="card-body">
          <div class="docs-intro">
            <p>OnePic API 是一个轻量级的随机图片服务，基于 EdgeOne Pages 边缘函数实现。支持 WebP 图片格式，自动适配不同设备类型，为 Web 应用提供高性能、低延迟的图片分发能力。</p>
          </div>

          <div class="doc-section-title">
            <span class="section-number">1</span><span>API 端点</span>
          </div>

          <div class="endpoint">
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

          <div class="endpoint">
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

          <div class="doc-section-title">
            <span class="section-number">2</span><span>错误码</span>
          </div>

          <div class="error-grid">
            <div class="error-item">
              <div class="error-code-value">404</div>
              <div class="error-code-desc">未找到图片资源</div>
            </div>
            <div class="error-item">
              <div class="error-code-value">500</div>
              <div class="error-code-desc">服务器内部错误</div>
            </div>
          </div>

          <div class="doc-section-title">
            <span class="section-number">3</span><span>自动检测机制</span>
          </div>

          <ul class="feature-list">
            <li>
              <span class="feature-icon">&#128241;</span>
              <div><strong>设备类型检测</strong> — 根据 User-Agent 自动识别 PC 或移动设备</div>
            </li>
            <li>
              <span class="feature-icon">&#128444;</span>
              <div><strong>图片格式优化</strong> — 自动返回 WebP 格式，兼顾质量与体积</div>
            </li>
            <li>
              <span class="feature-icon">&#128640;</span>
              <div><strong>零配置使用</strong> — 直接访问 /api 或 /image，无需任何参数</div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>&copy; 2026 <a href="https://www.sylv.top" target="_blank">Sylvy</a>. All rights reserved.</p>
    <p><a href="https://beian.miit.gov.cn/" target="_blank">豫ICP备2026013756号-1</a></p>
  </div>

  <script>
    function showPage(page, el) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
      document.getElementById(page + '-page').classList.add('active');
      el.classList.add('active');
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
        '<div class="gallery-item" onclick="openModal(this)" style="animation: fadeIn 0.3s ease ' + (index * 0.04) + 's both;">' +
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