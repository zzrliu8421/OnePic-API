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
  <title>OnePic API — 随机图片，边缘显影</title>
  <meta name="description" content="OnePic API —— 一台架在全球边缘节点上的随机图片机。一次请求，随机显影：WebP 直出、PC 与移动双胶卷适配、零配置接入。">
  <meta name="theme-color" content="#f2ede3">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23d2401e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='4' y='3' width='16' height='18' rx='2.5'/><path d='M7.5 6.5h9V14h-9z'/><circle cx='10' cy='9' r='1' fill='%23d2401e' stroke='none'/><path d='M8 14l2.5-3.5 2 2 2-2.5 2 4'/><path d='M8.5 17.5h7'/></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@600;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --paper: #f2ede3;
      --paper-2: #faf6ec;
      --paper-3: #e7dfcd;
      --ink: #1b1712;
      --ink-2: #57503f;
      --muted: #8d8471;
      --line: #ddd4bf;
      --line-2: #c8bda1;
      --red: #d2401e;
      --red-deep: #a93312;
      --amber: #e8a33d;
      --dark: #17130e;
      --cream: #f2ede3;
      --cream-2: #cfc6b2;
      --font-display: 'Noto Serif SC', 'Songti SC', serif;
      --font-latin: 'Fraunces', Georgia, serif;
      --font-body: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --font-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      --ease: cubic-bezier(.22, .61, .36, 1);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }

    body {
      font-family: var(--font-body);
      font-size: 15px;
      line-height: 1.75;
      color: var(--ink);
      background: var(--paper);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      overflow-x: hidden;
    }

    body::before { content: ''; display: block; height: 4px; background: var(--red); }

    ::selection { background: var(--red); color: var(--cream); }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: var(--paper); }
    ::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 5px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--muted); }

    :focus-visible { outline: 2px solid var(--red); outline-offset: 2px; border-radius: 2px; }
    a { color: inherit; }
    button { font-family: inherit; cursor: pointer; }
    img { display: block; max-width: 100%; }

    .container { max-width: 1140px; margin: 0 auto; padding: 0 28px; }
    .mono { font-family: var(--font-mono); }

    /* ===== 相纸颗粒 ===== */
    .grain {
      position: fixed; inset: 0; z-index: 2000; pointer-events: none; opacity: .05;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
      background-size: 160px 160px;
    }

    /* ===== 快门闪光 ===== */
    .flash { position: fixed; inset: 0; z-index: 1900; background: #fff; opacity: 0; pointer-events: none; }
    .flash.on { animation: flashBlink .5s var(--ease); }
    @keyframes flashBlink { 0% { opacity: 0; } 10% { opacity: .9; } 100% { opacity: 0; } }

    /* ===== 顶栏 ===== */
    .topbar {
      position: sticky; top: 0; z-index: 900;
      background: rgba(242, 237, 227, .92);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--line);
    }

    .topbar-inner { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 13px 0; }

    .logo { display: flex; align-items: center; gap: 11px; text-decoration: none; }
    .logo svg { width: 27px; height: 27px; color: var(--red); transition: transform .7s var(--ease); flex-shrink: 0; }
    .logo:hover svg { transform: rotate(120deg); }
    .logo-name { font-family: var(--font-latin); font-weight: 700; font-size: 19px; letter-spacing: -.01em; line-height: 1; }
    .logo-name em { display: block; font-style: normal; font-family: var(--font-mono); font-size: 10px; font-weight: 400; letter-spacing: .3em; color: var(--muted); margin-top: 4px; }

    .nav { display: flex; gap: 6px; }
    .nav a { font-size: 14px; color: var(--ink-2); text-decoration: none; padding: 7px 15px; border-radius: 999px; transition: color .18s, background-color .18s; }
    .nav a:hover { color: var(--ink); background: var(--paper-3); }
    .nav a.active { color: var(--cream); background: var(--ink); }

    .top-right { display: flex; align-items: center; gap: 18px; }
    .clock { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); letter-spacing: .08em; }
    .api-link { font-family: var(--font-mono); font-size: 12px; color: var(--red); text-decoration: none; border-bottom: 1px solid var(--red); padding-bottom: 1px; transition: .15s; }
    .api-link:hover { background: var(--red); color: var(--cream); }

    /* ===== Hero ===== */
    .hero { position: relative; display: grid; grid-template-columns: 1.05fr .95fr; gap: 56px; align-items: center; padding: 72px 0 88px; }

    .hero-ghost {
      position: absolute; top: 30px; right: -50px; z-index: 0;
      font-family: var(--font-latin); font-style: italic; font-weight: 900;
      font-size: clamp(120px, 17vw, 220px); line-height: 1;
      color: transparent; -webkit-text-stroke: 1.5px rgba(27, 23, 18, .09);
      pointer-events: none; user-select: none;
    }

    .hero-copy { position: relative; z-index: 1; }

    .kicker { font-family: var(--font-mono); font-size: 12px; letter-spacing: .24em; color: var(--red); margin-bottom: 22px; }

    .hero h1 {
      font-family: var(--font-display); font-weight: 900;
      font-size: clamp(36px, 4.8vw, 58px); line-height: 1.24; letter-spacing: .01em;
      margin-bottom: 18px;
    }

    .hero h1 em { font-style: normal; color: var(--red); position: relative; z-index: 1; }
    .hero h1 em::after {
      content: ''; position: absolute; left: 1%; bottom: 5px; z-index: -1;
      width: 98%; height: 11px; background: var(--amber); opacity: .42;
    }

    .lede { font-size: 15.5px; color: var(--ink-2); max-width: 32em; margin-bottom: 30px; }

    .hero-links { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }

    .btn-line {
      display: inline-flex; align-items: center; gap: 8px;
      font-size: 14px; font-weight: 500; color: var(--ink);
      text-decoration: none; border: 1px solid var(--ink);
      padding: 11px 24px; border-radius: 999px; background: transparent;
      transition: background-color .18s, color .18s, border-color .18s;
    }
    .btn-line:hover { background: var(--ink); color: var(--cream); }
    .btn-line.red { border-color: var(--red); color: var(--red); }
    .btn-line.red:hover { background: var(--red); color: var(--cream); }

    .facts { display: grid; grid-template-columns: repeat(4, auto); justify-content: start; gap: 36px; margin-top: 46px; padding-top: 26px; border-top: 1px solid var(--line-2); }
    .fact { border-left: 1px solid var(--line); padding-left: 18px; }
    .fact:first-child { border-left: 0; padding-left: 0; }
    .fact .v { font-family: var(--font-latin); font-size: 27px; font-weight: 600; line-height: 1.15; }
    .fact .l { font-family: var(--font-mono); font-size: 11px; letter-spacing: .1em; color: var(--muted); margin-top: 5px; }

    /* ===== 拍立得机器 ===== */
    .hero-machine { position: relative; z-index: 1; justify-self: center; width: min(430px, 100%); }

    .polaroid {
      position: relative; background: #fbf7ee;
      border: 1px solid #e3dcc9; padding: 13px 13px 0;
      transform: rotate(-2.4deg);
      box-shadow: 10px 12px 0 rgba(210, 64, 30, .9), 26px 38px 56px rgba(27, 23, 18, .22);
      transition: transform .3s var(--ease);
    }
    .polaroid:hover { transform: rotate(-1.2deg) translateY(-3px); }
    .polaroid.draw { animation: poloIn .55s var(--ease); }
    @keyframes poloIn {
      0% { transform: rotate(3deg) translateY(-14px) scale(.97); }
      60% { transform: rotate(-3.4deg); }
      100% { transform: rotate(-2.4deg); }
    }

    .tape { position: absolute; width: 96px; height: 26px; background: rgba(226, 213, 180, .85); box-shadow: 0 2px 6px rgba(27, 23, 18, .12); top: -13px; }
    .tape-l { left: 8%; transform: rotate(-8deg); }
    .tape-r { right: 8%; transform: rotate(6deg); }

    .photo-area { position: relative; aspect-ratio: 4 / 3; background: var(--dark); overflow: hidden; display: grid; place-items: center; }
    .photo-area img { width: 100%; height: 100%; object-fit: cover; opacity: 0; }
    .photo-area img.shown { opacity: 1; animation: develop 1.15s ease .05s both; }
    @keyframes develop {
      0% { opacity: 0; filter: blur(18px) brightness(1.7) contrast(.75) sepia(.5); transform: scale(1.05); }
      100% { opacity: 1; filter: blur(0) brightness(1) contrast(1) sepia(0); transform: scale(1); }
    }

    .photo-empty { color: #8a7d63; text-align: center; padding: 20px; }
    .photo-empty svg { width: 46px; height: 46px; margin: 0 auto 14px; color: #4d4433; animation: sway 5s ease-in-out infinite; display: block; }
    @keyframes sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
    .photo-empty p { font-family: var(--font-mono); font-size: 11px; letter-spacing: .32em; }
    .photo-empty i { display: block; font-style: normal; font-size: 10px; letter-spacing: .2em; color: #5d5442; margin-top: 7px; }

    .photo-caption {
      display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
      padding: 13px 4px 15px; font-family: var(--font-mono); font-size: 12px; color: var(--ink-2);
    }
    .photo-caption .serial { color: var(--red); font-weight: 600; white-space: nowrap; }
    .photo-caption .stamp { color: #c65a2e; white-space: nowrap; }
    .photo-caption .meta { font-size: 11px; color: var(--muted); text-align: right; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .machine-controls { display: flex; align-items: center; gap: 20px; margin-top: 36px; justify-content: center; }

    .shutter {
      width: 74px; height: 74px; border-radius: 50%; flex-shrink: 0;
      border: 2px solid var(--ink); background: var(--paper-2);
      display: grid; place-items: center;
      box-shadow: 5px 5px 0 var(--ink);
      transition: transform .08s, box-shadow .08s, opacity .2s;
    }
    .shutter-core {
      width: 48px; height: 48px; border-radius: 50%;
      background: radial-gradient(circle at 34% 32%, #ef6a45, var(--red) 55%, var(--red-deep));
      display: grid; place-items: center; color: #fbf7ee;
      transition: transform .15s var(--ease);
    }
    .shutter-core svg { width: 22px; height: 22px; }
    .shutter:hover .shutter-core { transform: scale(1.07); }
    .shutter:active { transform: translate(4px, 4px); box-shadow: 1px 1px 0 var(--ink); }
    .shutter:active .shutter-core { transform: scale(.88); }
    .shutter:disabled { opacity: .55; cursor: wait; }

    .machine-copy { text-align: left; }
    .machine-hint { font-family: var(--font-mono); font-size: 11px; letter-spacing: .3em; color: var(--ink); }
    .machine-counter { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); margin-top: 6px; }
    .machine-counter b { color: var(--red); font-weight: 600; }

    /* ===== 胶片跑马灯 ===== */
    .filmstrip { background: var(--dark); color: var(--cream); padding: 28px 0 40px; }

    .film-head {
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;
      font-family: var(--font-mono); font-size: 11px; letter-spacing: .22em; color: #8f8672;
      margin-bottom: 22px;
    }
    .film-head .live { color: var(--red); display: inline-flex; align-items: center; gap: 9px; }
    .live::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--red); animation: blink 1.6s infinite; }
    @keyframes blink { 50% { opacity: .25; } }

    .film-row { position: relative; overflow: hidden; padding: 18px 0; }
    .film-row::before, .film-row::after {
      content: ''; position: absolute; left: 0; right: 0; height: 8px;
      background-image: repeating-linear-gradient(90deg, rgba(242, 237, 227, .32) 0 16px, transparent 16px 30px);
    }
    .film-row::before { top: 5px; }
    .film-row::after { bottom: 5px; }

    .film-track { display: flex; width: max-content; animation: filmScroll 52s linear infinite; }
    .film-track.rev { animation-direction: reverse; animation-duration: 58s; }
    .film-row:hover .film-track { animation-play-state: paused; }
    @keyframes filmScroll { to { transform: translateX(-33.3333%); } }

    .film-frame {
      position: relative; flex: 0 0 auto; width: 158px; aspect-ratio: 3 / 2; margin-right: 12px;
      background: #000; border: 1px solid rgba(242, 237, 227, .12);
      overflow: hidden; padding: 0;
    }
    .film-frame img { width: 100%; height: 100%; object-fit: cover; filter: grayscale(.35); opacity: .88; transition: filter .25s, opacity .25s, transform .25s; }
    .film-frame:hover img { filter: none; opacity: 1; transform: scale(1.06); }
    .film-frame b { position: absolute; left: 6px; top: 5px; font-family: var(--font-mono); font-weight: 500; font-size: 9.5px; letter-spacing: .08em; color: var(--red); background: rgba(242, 237, 227, .92); padding: 1px 5px; }
    .film-frame i { position: absolute; right: 6px; bottom: 5px; font-style: normal; font-family: var(--font-mono); font-size: 9.5px; color: rgba(242, 237, 227, .8); background: rgba(23, 19, 14, .55); padding: 1px 5px; }

    /* ===== 通用区块 ===== */
    .section { padding-top: 88px; }
    .section-head { margin-bottom: 44px; max-width: 660px; }
    .section-head .kicker { margin-bottom: 12px; }
    .section-head h2 { font-family: var(--font-display); font-weight: 900; font-size: clamp(26px, 3.4vw, 36px); line-height: 1.32; }
    .section-head p { font-size: 14px; color: var(--muted); margin-top: 10px; }

    /* ===== 档案卡片（特性） ===== */
    .plates { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

    .plate { position: relative; background: var(--paper-2); border: 1px solid var(--line); padding: 26px 24px 24px; transition: transform .22s var(--ease), box-shadow .22s var(--ease), border-color .22s; }
    .plate::before { content: attr(data-plt); position: absolute; top: 14px; right: 16px; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; color: var(--muted); }
    .plate::after { content: ''; position: absolute; left: 0; top: 0; width: 0; height: 3px; background: var(--red); transition: width .35s var(--ease); }
    .plate:hover { transform: translateY(-5px); box-shadow: 0 18px 36px rgba(27, 23, 18, .1); }
    .plate:hover::after { width: 100%; }
    .plate svg { width: 24px; height: 24px; color: var(--red); }
    .plate h3 { font-family: var(--font-display); font-weight: 700; font-size: 16.5px; margin: 15px 0 6px; }
    .plate p { font-size: 13.5px; color: var(--ink-2); }

    /* ===== 三步流程 ===== */
    .process { display: grid; grid-template-columns: repeat(3, 1fr); gap: 36px; }
    .step { border-top: 2px solid var(--ink); padding-top: 22px; }
    .step .num { font-family: var(--font-latin); font-style: italic; font-weight: 900; font-size: 58px; line-height: 1; color: transparent; -webkit-text-stroke: 1.6px var(--red); }
    .step h3 { font-family: var(--font-display); font-weight: 700; font-size: 16.5px; margin: 15px 0 6px; }
    .step p { font-size: 13.5px; color: var(--ink-2); }

    /* ===== 印样图库 ===== */
    .sheet { background: var(--paper-2); border: 1px solid var(--line); padding: 24px; }
    .sheet-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px dashed var(--line-2); }

    .roll-tabs { display: inline-flex; border: 1px solid var(--ink); border-radius: 999px; overflow: hidden; }
    .roll { font-family: var(--font-mono); font-size: 12.5px; padding: 9px 20px; background: transparent; border: 0; color: var(--ink-2); transition: background-color .16s, color .16s; }
    .roll + .roll { border-left: 1px solid var(--ink); }
    .roll.active { background: var(--ink); color: var(--cream); }
    .roll .rc { color: var(--red); margin-left: 5px; }
    .roll.active .rc { color: var(--amber); }

    .sheet-meta { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); letter-spacing: .08em; }

    .contact-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 18px; }

    .print { position: relative; background: #fff; border: 1px solid var(--line); padding: 8px 8px 30px; text-align: left; transition: transform .2s var(--ease), box-shadow .2s var(--ease); }
    .print .ph { display: block; aspect-ratio: 1; overflow: hidden; background: var(--paper-3); }
    .print img { width: 100%; height: 100%; object-fit: cover; }
    .print .no { position: absolute; left: 9px; bottom: 8px; font-family: var(--font-mono); font-size: 10px; color: var(--muted); letter-spacing: .06em; }
    .print:hover { transform: rotate(1.6deg) translateY(-4px); box-shadow: 0 14px 28px rgba(27, 23, 18, .16), 0 0 0 2px var(--red); }

    .pager { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 30px; }
    .pager button { font-family: var(--font-mono); font-size: 12.5px; border: 1px solid var(--ink); background: transparent; color: var(--ink); padding: 9px 20px; border-radius: 999px; transition: background-color .16s, color .16s; }
    .pager button:hover:not(:disabled) { background: var(--ink); color: var(--cream); }
    .pager button:disabled { opacity: .35; cursor: not-allowed; }
    .pager .pg { font-family: var(--font-mono); font-size: 12.5px; color: var(--ink-2); min-width: 70px; text-align: center; }

    /* ===== 文档档案夹 ===== */
    .folders { display: grid; gap: 18px; }

    .folder { background: var(--paper-2); border: 1px solid var(--line); }
    .folder-head { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; padding: 16px 24px; border-bottom: 1px dashed var(--line-2); }
    .method { font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em; background: var(--red); color: var(--cream); padding: 3px 10px; }
    .fpath { font-family: var(--font-mono); font-size: 15.5px; font-weight: 600; }
    .fdesc { margin-left: auto; font-size: 12.5px; color: var(--muted); }
    .folder-body { padding: 22px 24px 26px; }

    .dlabel { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .22em; color: var(--muted); margin: 26px 0 6px; }
    .folder-body .dlabel:first-child { margin-top: 0; }

    .prow { padding: 13px 0; border-bottom: 1px dotted var(--line); }
    .pline { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; }
    .pname { font-family: var(--font-mono); font-size: 13.5px; font-weight: 600; }
    .chip { font-family: var(--font-mono); font-size: 10.5px; border: 1px solid var(--line-2); color: var(--ink-2); padding: 1px 9px; border-radius: 999px; }
    .pdesc { font-size: 13.5px; color: var(--ink-2); margin-top: 4px; }
    .pdefault { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); margin-top: 2px; }

    .codeblock { background: var(--dark); border: 1px solid var(--dark); margin-top: 12px; }
    .codebar { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-bottom: 1px solid rgba(242, 237, 227, .12); }
    .codebar span { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .16em; color: #8f8672; }
    .copybtn { font-family: var(--font-mono); font-size: 11.5px; background: transparent; border: 0; color: var(--cream-2); padding: 2px 6px; transition: color .15s; }
    .copybtn:hover { color: var(--amber); }
    .copybtn.ok { color: #7fb069; }
    .codeblock pre { margin: 0; padding: 15px 16px; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.8; color: #e6ddc8; overflow-x: auto; }

    .refs { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-top: 22px; }
    .ref { background: var(--paper-2); border: 1px solid var(--line); padding: 18px; }
    .ref.err { border-top: 3px solid var(--red); }
    .ref h4 { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
    .ref.err h4 { font-family: var(--font-mono); color: var(--red); }
    .ref h4 svg { width: 16px; height: 16px; color: var(--ink-2); flex-shrink: 0; }
    .ref p { font-size: 12.5px; color: var(--ink-2); margin-top: 5px; }

    /* ===== 模态框 ===== */
    .modal { display: none; position: fixed; inset: 0; z-index: 1200; background: rgba(20, 16, 11, .95); padding: 24px; }
    .modal.open { display: grid; place-items: center; animation: fade .2s ease; }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

    .modal-figure { position: relative; margin: 0; }
    .modal-figure img { max-width: 86vw; max-height: 78vh; border: 8px solid #fbf7ee; box-shadow: 0 30px 80px rgba(0, 0, 0, .6); background: #fbf7ee; }
    .modal-figure figcaption { font-family: var(--font-mono); font-size: 12px; color: var(--cream-2); text-align: center; margin-top: 16px; letter-spacing: .06em; }

    .modal-close { position: fixed; top: 22px; right: 26px; width: 42px; height: 42px; border-radius: 50%; border: 1px solid rgba(242, 237, 227, .4); background: transparent; color: var(--cream); display: grid; place-items: center; transition: background-color .15s; }
    .modal-close:hover { background: rgba(242, 237, 227, .15); }

    .modal-nav { position: fixed; top: 50%; transform: translateY(-50%); width: 46px; height: 46px; border-radius: 50%; border: 1px solid rgba(242, 237, 227, .4); background: rgba(23, 19, 14, .5); color: var(--cream); display: grid; place-items: center; transition: background-color .15s, border-color .15s; }
    .modal-nav:hover { background: var(--red); border-color: var(--red); }
    .modal-nav.prev { left: 22px; }
    .modal-nav.next { right: 22px; }

    /* ===== 页脚 ===== */
    .footer { margin-top: 100px; background: var(--dark); color: var(--cream); padding: 44px 0 40px; }
    .footer-inner { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; flex-wrap: wrap; }

    .fbrand { display: flex; align-items: center; gap: 10px; font-family: var(--font-latin); font-weight: 700; font-size: 17px; }
    .fbrand svg { width: 22px; height: 22px; color: var(--red); }
    .fbrand em { font-style: normal; font-family: var(--font-body); font-weight: 400; font-size: 12.5px; color: #8f8672; margin-left: 4px; }

    .fnote { font-family: var(--font-mono); font-size: 11px; letter-spacing: .18em; color: #8f8672; text-align: right; }
    .fnote b { color: var(--amber); font-weight: 600; }

    .legal { width: 100%; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 28px; padding-top: 20px; border-top: 1px solid rgba(242, 237, 227, .14); font-size: 12px; color: #8f8672; }
    .legal a { color: #b5ac97; text-decoration: none; transition: color .15s; }
    .legal a:hover { color: var(--cream); }

    /* ===== 动效与响应 ===== */
    .page { display: none; }
    .page.active { display: block; animation: fadeUp .28s var(--ease); }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

    .reveal { opacity: 0; transform: translateY(20px); transition: opacity .7s var(--ease), transform .7s var(--ease); }
    .reveal.in { opacity: 1; transform: none; }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation: none !important; transition: none !important; }
      .reveal { opacity: 1; transform: none; }
      html { scroll-behavior: auto; }
    }

    @media (max-width: 980px) {
      .hero { grid-template-columns: 1fr; gap: 54px; padding: 56px 0 66px; }
      .hero-machine { justify-self: center; }
      .hero-ghost { display: none; }
      .plates { grid-template-columns: repeat(2, 1fr); }
      .process { grid-template-columns: 1fr; gap: 28px; }
      .facts { grid-template-columns: repeat(2, auto); gap: 22px; }
    }

    @media (max-width: 640px) {
      .container { padding: 0 18px; }
      .clock { display: none; }
      .logo-name em { display: none; }
      .nav a { padding: 7px 11px; font-size: 13px; }
      .plates { grid-template-columns: 1fr; }
      .sheet { padding: 16px; }
      .contact-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .section { padding-top: 64px; }
      .facts { gap: 16px; }
      .film-frame { width: 122px; }
      .modal-nav.prev { left: 10px; }
      .modal-nav.next { right: 10px; }
    }
  </style>
</head>
<body>
  <div class="grain" aria-hidden="true"></div>
  <div class="flash" id="flash" aria-hidden="true"></div>

  <!-- 顶栏 -->
  <header class="topbar">
    <div class="container topbar-inner">
      <a class="logo" href="#" onclick="showPage('home', document.querySelectorAll('.nav a')[0]); return false;" aria-label="OnePic 首页">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M7.5 6.5h9V14h-9z"/><circle cx="10" cy="9" r="1" fill="currentColor" stroke="none"/><path d="M8 14l2.5-3.5 2 2 2-2.5 2 4"/><path d="M8.5 17.5h7"/></svg>
        <span class="logo-name">OnePic<em>RANDOM IMAGE ARCHIVE</em></span>
      </a>
      <nav class="nav" aria-label="主导航">
        <a href="#" class="active" onclick="showPage('home', this); return false;">首页</a>
        <a href="#" onclick="showPage('gallery', this); return false;">图库</a>
        <a href="#" onclick="showPage('docs', this); return false;">文档</a>
      </nav>
      <div class="top-right">
        <span class="clock" id="clock" aria-hidden="true">SHA --:--:--</span>
        <a class="api-link" href="/api" target="_blank" rel="noopener">GET /api ↗</a>
      </div>
    </div>
  </header>

  <main>
    <!-- 首页 -->
    <div id="home-page" class="page active">
      <section class="hero container">
        <p class="hero-ghost" aria-hidden="true">RANDOM</p>

        <div class="hero-copy">
          <p class="kicker">EDGE RANDOM IMAGE SERVICE — EST. 2026</p>
          <h1>每一次快门，<br>都是一张<em>没见过</em>的照片。</h1>
          <p class="lede">OnePic 是一台架在全球边缘节点上的随机图片机。一次请求，随机显影：WebP 直出、PC 与移动双胶卷适配、零配置接入。</p>
          <div class="hero-links">
            <a href="#" class="btn-line" onclick="showPage('gallery', document.querySelectorAll('.nav a')[1]); return false;">浏览图库</a>
            <a href="#" class="btn-line red" onclick="showPage('docs', document.querySelectorAll('.nav a')[2]); return false;">接口文档 →</a>
          </div>

          <!-- 构建期注入的真实数据 -->
          <div class="facts">
            <div class="fact">
              <div class="v" data-count="${imageFileList.pc.webp.length}">${imageFileList.pc.webp.length}</div>
              <div class="l">PC 图池 · ROLL A</div>
            </div>
            <div class="fact">
              <div class="v" data-count="${imageFileList.pe.webp.length}">${imageFileList.pe.webp.length}</div>
              <div class="l">移动图池 · ROLL B</div>
            </div>
            <div class="fact">
              <div class="v">WebP</div>
              <div class="l">图片格式 · FORMAT</div>
            </div>
            <div class="fact">
              <div class="v">v3.0</div>
              <div class="l">接口版本 · VERSION</div>
            </div>
          </div>
        </div>

        <div class="hero-machine">
          <div class="polaroid" id="polaroid">
            <span class="tape tape-l" aria-hidden="true"></span>
            <span class="tape tape-r" aria-hidden="true"></span>
            <div class="photo-area">
              <div class="photo-empty" id="photoPlaceholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M7.5 6.5h9V14h-9z"/><circle cx="10" cy="9" r="1" fill="currentColor" stroke="none"/><path d="M8 14l2.5-3.5 2 2 2-2.5 2 4"/><path d="M8.5 17.5h7"/></svg>
                <p>WAITING FOR EXPOSURE</p>
                <i>等待曝光 · 按下快门随机显影一张</i>
              </div>
              <img id="previewImage" alt="随机显影的图片" style="display:none;">
            </div>
            <div class="photo-caption">
              <span class="serial" id="photoSerial">NO.0000</span>
              <span class="stamp" id="photoStamp">--.--.--</span>
              <span class="meta" id="previewMeta">尚未曝光</span>
            </div>
          </div>

          <div class="machine-controls">
            <button class="shutter" id="testBtn" onclick="fetchRandomImage()" aria-label="随机抽取一张图片">
              <span class="shutter-core">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m14.31 8 5.74 9.94"/><path d="M9.69 8h11.48"/><path d="m7.38 12 5.74-9.94"/><path d="M9.69 16 3.95 6.06"/><path d="M14.31 16H2.83"/><path d="m16.62 12-5.74 9.94"/></svg>
              </span>
            </button>
            <div class="machine-copy">
              <div class="machine-hint">按 下 快 门 · 随 机 显 影</div>
              <div class="machine-counter">本机已按快门 <b class="shutter-out">0000</b> 次</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 胶片跑马灯（图池现场） -->
      <section class="filmstrip" id="filmstrip" aria-label="图池现场预览">
        <div class="container film-head">
          <span class="live">LIVE FROM THE POOL — 图池现场</span>
          <span id="filmCount">LOADING FILM…</span>
        </div>
        <div class="film-row">
          <div class="film-track" id="filmTrackA"></div>
        </div>
        <div class="film-row">
          <div class="film-track rev" id="filmTrackB"></div>
        </div>
      </section>

      <!-- 特性 -->
      <section class="section container">
        <div class="section-head reveal">
          <p class="kicker">— 01 / CAPABILITIES</p>
          <h2>一卷胶片的自我修养</h2>
          <p>把随机图片这件小事做到极致：更快的节点、更小的体积、更少的配置。</p>
        </div>
        <div class="plates reveal">
          <div class="plate" data-plt="PLT.01">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <h3>边缘显影</h3>
            <p>请求打到最近的边缘节点，随机挑选与分发在函数内完成，运行时零额外请求。</p>
          </div>
          <div class="plate" data-plt="PLT.02">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg>
            <h3>双胶卷适配</h3>
            <p>自动识别 PC 与移动设备，分别从对应图池取片，横竖屏各得其所。</p>
          </div>
          <div class="plate" data-plt="PLT.03">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 15-4.2-4.2a1.5 1.5 0 0 0-2.1 0L7 18"/></svg>
            <h3>WebP 直出</h3>
            <p>全池预转 WebP，体积更小、画质更高，首屏加载更快一步。</p>
          </div>
          <div class="plate" data-plt="PLT.04">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none"/></svg>
            <h3>随机算法</h3>
            <p>每次请求独立抽取，支持 count=1–50 批量补货，重定向与纯文本任选。</p>
          </div>
          <div class="plate" data-plt="PLT.05">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13.5 9 5 9-5"/></svg>
            <h3>多平台部署</h3>
            <p>EdgeOne Pages 与阿里云 ESA 双分支就绪，推送到仓库即自动构建。</p>
          </div>
          <div class="plate" data-plt="PLT.06">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
            <h3>零配置接入</h3>
            <p>记住一个地址 /image，剩下的——选图、适配、加速——都交给边缘。</p>
          </div>
        </div>
      </section>

      <!-- 三步流程 -->
      <section class="section container">
        <div class="section-head reveal">
          <p class="kicker">— 02 / HOW IT WORKS</p>
          <h2>三次曝光，完成接入</h2>
          <p>无需注册、无需密钥，一个 GET 请求即可开始。</p>
        </div>
        <div class="process reveal">
          <div class="step">
            <div class="num">1.</div>
            <h3>按下快门</h3>
            <p>向 /api 或 /image 发起一次 GET 请求，无需携带任何参数。</p>
          </div>
          <div class="step">
            <div class="num">2.</div>
            <h3>边缘抽片</h3>
            <p>就近边缘节点从图池随机抽片，JSON、302 重定向或纯文本任你选择。</p>
          </div>
          <div class="step">
            <div class="num">3.</div>
            <h3>上墙展出</h3>
            <p>把返回的 URL 贴进 img 标签、CSS 背景或任意客户端，即刻展出。</p>
          </div>
        </div>
      </section>
    </div>

    <!-- 图库页 -->
    <div id="gallery-page" class="page">
      <section class="section container">
        <div class="section-head reveal">
          <p class="kicker">— 03 / CONTACT SHEET</p>
          <h2>印样集</h2>
          <p>全部图池在此展出，支持 PC 与 PE 双胶卷切换，点击任意一张查看大图。</p>
        </div>

        <div class="sheet reveal">
          <div class="sheet-bar">
            <div class="roll-tabs" role="tablist" aria-label="胶卷切换">
              <button class="roll active" onclick="switchDevice('pc', this)">PC 胶卷<span class="rc">${imageFileList.pc.webp.length}</span></button>
              <button class="roll" onclick="switchDevice('pe', this)">PE 胶卷<span class="rc">${imageFileList.pe.webp.length}</span></button>
            </div>
            <span class="sheet-meta" id="sheetCount">LOADING…</span>
          </div>
          <div id="galleryGrid" class="contact-grid"></div>
          <div class="pager">
            <button id="prevBtn" onclick="prevPage()" disabled>← PREV</button>
            <span class="pg" id="pageInfo">01 / 01</span>
            <button id="nextBtn" onclick="nextPage()">NEXT →</button>
          </div>
        </div>
      </section>
    </div>

    <!-- 文档页 -->
    <div id="docs-page" class="page">
      <section class="section container">
        <div class="section-head reveal">
          <p class="kicker">— 04 / DOCUMENTATION</p>
          <h2>接口档案</h2>
          <p>完整的接口使用指南与参考，快速集成随机图片服务。</p>
        </div>

        <div class="folders">
          <!-- /api -->
          <div class="folder reveal">
            <div class="folder-head">
              <span class="method">GET</span>
              <span class="fpath">/api</span>
              <span class="fdesc">获取随机图片，支持多种返回格式</span>
            </div>
            <div class="folder-body">
              <div class="dlabel">请求参数 · PARAMETERS</div>

              <div class="prow">
                <div class="pline">
                  <span class="pname">count</span>
                  <span class="chip">integer</span>
                  <span class="chip">可选</span>
                </div>
                <div class="pdesc">返回图片数量，范围 1–50。</div>
                <div class="pdefault">默认值：1</div>
              </div>

              <div class="prow">
                <div class="pline">
                  <span class="pname">type</span>
                  <span class="chip">string</span>
                  <span class="chip">可选</span>
                </div>
                <div class="pdesc">设备类型，决定返回图片的适配方向。</div>
                <div class="pdefault">可选值：pc（横屏）、pe（竖屏）｜默认：自动检测</div>
              </div>

              <div class="prow">
                <div class="pline">
                  <span class="pname">format</span>
                  <span class="chip">string</span>
                  <span class="chip">可选</span>
                </div>
                <div class="pdesc">图片格式。</div>
                <div class="pdefault">可选值：webp｜默认：webp</div>
              </div>

              <div class="prow">
                <div class="pline">
                  <span class="pname">return</span>
                  <span class="chip">string</span>
                  <span class="chip">可选</span>
                </div>
                <div class="pdesc">返回类型。</div>
                <div class="pdefault">可选值：redirect、json、text｜默认：json</div>
              </div>

              <div class="dlabel">响应示例 · RESPONSE</div>
              <div class="codeblock">
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

              <div class="dlabel">使用示例 · EXAMPLES</div>
              <div class="codeblock">
                <div class="codebar">
                  <span>HTTP</span>
                  <button class="copybtn" onclick="copyCode(this)">复制</button>
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
          <div class="folder reveal">
            <div class="folder-head">
              <span class="method">GET</span>
              <span class="fpath">/image</span>
              <span class="fdesc">直接返回随机图片（302 重定向）</span>
            </div>
            <div class="folder-body">
              <div class="dlabel">使用示例 · EXAMPLES</div>
              <div class="codeblock">
                <div class="codebar">
                  <span>HTTP / HTML / CSS</span>
                  <button class="copybtn" onclick="copyCode(this)">复制</button>
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
          <div class="section-head reveal" style="margin-bottom: 20px;">
            <p class="kicker">— 05 / REFERENCE</p>
            <h2 style="font-size: 24px;">错误码与特性</h2>
          </div>
          <div class="refs reveal">
            <div class="ref err">
              <h4>404</h4>
              <p>未找到图片资源。</p>
            </div>
            <div class="ref err">
              <h4>500</h4>
              <p>服务器内部错误。</p>
            </div>
            <div class="ref">
              <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg>设备检测</h4>
              <p>根据 User-Agent 自动识别 PC 或移动设备。</p>
            </div>
            <div class="ref">
              <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 15-4.2-4.2a1.5 1.5 0 0 0-2.1 0L7 18"/></svg>格式优化</h4>
              <p>自动返回 WebP 格式，兼顾质量与体积。</p>
            </div>
            <div class="ref">
              <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>零配置</h4>
              <p>直接访问端点即可使用，无需任何参数。</p>
            </div>
            <div class="ref">
              <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>边缘加速</h4>
              <p>全球边缘节点就近响应，低延迟分发。</p>
            </div>
          </div>
        </section>
      </section>
    </div>
  </main>

  <!-- 图片预览模态框 -->
  <div id="imageModal" class="modal" onclick="closeModal()">
    <figure class="modal-figure" onclick="event.stopPropagation()">
      <img id="modalImage" src="" alt="图片预览">
      <figcaption id="modalCaption"></figcaption>
    </figure>
    <button class="modal-close" aria-label="关闭" onclick="closeModal()">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
    <button class="modal-nav prev" aria-label="上一张" onclick="event.stopPropagation(); modalNav(-1)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>
    </button>
    <button class="modal-nav next" aria-label="下一张" onclick="event.stopPropagation(); modalNav(1)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>
    </button>
  </div>

  <!-- 页脚 -->
  <footer class="footer">
    <div class="container footer-inner">
      <div class="fbrand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M7.5 6.5h9V14h-9z"/><circle cx="10" cy="9" r="1" fill="currentColor" stroke="none"/><path d="M8 14l2.5-3.5 2 2 2-2.5 2 4"/><path d="M8.5 17.5h7"/></svg>
        OnePic<em>— 随机图片 · 边缘显影</em>
      </div>
      <div class="fnote">SHUTTER RELEASED × <b class="shutter-out">0000</b> — 本页快门记录</div>
      <div class="legal">
        <span>&copy; 2026 <a href="https://www.sylv.top" target="_blank" rel="noopener">Sylvy</a>. All rights reserved.</span>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">豫ICP备2026013756号-1</a>
      </div>
    </div>
  </footer>

  <script>
    var state = {
      imageData: null,
      type: 'pc',
      page: 1,
      perPage: 12,
      modal: { type: 'pc', index: 0, list: [] }
    };

    function pad2(n) { return String(n).padStart(2, '0'); }
    function pad4(n) { return String(n).padStart(4, '0'); }

    /* ===== 页面切换 ===== */
    function showPage(page, el) {
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      document.querySelectorAll('.nav a').forEach(function (a) { a.classList.remove('active'); });
      document.getElementById(page + '-page').classList.add('active');
      if (el) el.classList.add('active');
      closeModal();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (page === 'gallery') loadGallery();
    }

    /* ===== 快门抽片 ===== */
    var shutterCount = 0;
    try { shutterCount = parseInt(localStorage.getItem('onepic-shutter') || '0', 10) || 0; } catch (e) {}

    function renderShutter() {
      document.querySelectorAll('.shutter-out').forEach(function (el) {
        el.textContent = pad4(shutterCount);
      });
    }
    renderShutter();

    function fetchRandomImage() {
      var btn = document.getElementById('testBtn');
      var polo = document.getElementById('polaroid');
      var img = document.getElementById('previewImage');
      var ph = document.getElementById('photoPlaceholder');
      var flash = document.getElementById('flash');
      var serial = document.getElementById('photoSerial');
      var stamp = document.getElementById('photoStamp');
      var meta = document.getElementById('previewMeta');

      btn.disabled = true;
      flash.classList.remove('on');
      void flash.offsetWidth;
      flash.classList.add('on');

      fetch('/api?count=1&_t=' + Date.now())
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success && data.images && data.images.length) {
            shutterCount++;
            try { localStorage.setItem('onepic-shutter', String(shutterCount)); } catch (e) {}
            renderShutter();

            var d = new Date();
            serial.textContent = 'NO.' + pad4(shutterCount);
            stamp.textContent = pad2(d.getFullYear() % 100) + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate());

            var rollName = data.type === 'pc' ? 'PC 胶卷' : 'PE 胶卷';
            meta.textContent = data.format.toUpperCase() + ' · ' + rollName;
            img.onload = function () {
              meta.textContent = data.format.toUpperCase() + ' · ' + rollName + ' · ' + img.naturalWidth + '×' + img.naturalHeight;
            };
            img.onerror = function () {
              meta.textContent = '显影失败，请再按一次';
            };

            img.classList.remove('shown');
            void img.offsetWidth;
            img.src = data.images[0].url + '?_t=' + Date.now();
            img.style.display = 'block';
            ph.style.display = 'none';

            polo.classList.remove('draw');
            void polo.offsetWidth;
            polo.classList.add('draw');
          } else {
            meta.textContent = '获取失败，请重试';
          }
        })
        .catch(function () {
          meta.textContent = '网络异常，请重试';
        })
        .finally(function () {
          btn.disabled = false;
        });
    }

    /* ===== 复制代码 ===== */
    function copyCode(btn) {
      var pre = btn.closest('.codeblock').querySelector('pre');
      navigator.clipboard.writeText(pre.textContent).then(function () {
        btn.textContent = '已复制';
        btn.classList.add('ok');
        setTimeout(function () {
          btn.textContent = '复制';
          btn.classList.remove('ok');
        }, 1600);
      });
    }

    /* ===== 图库（印样） ===== */
    function switchDevice(type, btn) {
      document.querySelectorAll('.roll').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      state.type = type;
      state.page = 1;
      loadGallery();
    }

    function loadGallery() {
      if (state.imageData) {
        renderGallery();
      } else {
        fetch('/image-list.json')
          .then(function (r) { return r.json(); })
          .then(function (data) {
            state.imageData = data;
            buildFilmstrip();
            renderGallery();
          });
      }
    }

    function renderGallery() {
      var grid = document.getElementById('galleryGrid');
      var info = document.getElementById('pageInfo');
      var images = (state.imageData[state.type] && state.imageData[state.type].webp) ? state.imageData[state.type].webp : [];
      var total = images.length;
      var totalPages = Math.max(1, Math.ceil(total / state.perPage));
      if (state.page > totalPages) state.page = totalPages;

      var start = (state.page - 1) * state.perPage;
      var pageImages = images.slice(start, start + state.perPage);

      var html = '';
      pageImages.forEach(function (name, i) {
        var idx = start + i;
        html += '<button class="print" onclick="openModalAt(\\'' + state.type + '\\',' + idx + ')" title="' + name + '">'
          + '<span class="ph"><img src="/converted/' + state.type + '/webp/' + name + '.webp" loading="lazy" alt=""></span>'
          + '<span class="no">NO.' + state.type.toUpperCase() + '-' + pad4(idx + 1) + '</span>'
          + '</button>';
      });
      grid.innerHTML = html;

      info.textContent = pad2(state.page) + ' / ' + pad2(totalPages);
      document.getElementById('prevBtn').disabled = state.page <= 1;
      document.getElementById('nextBtn').disabled = state.page >= totalPages;
      document.getElementById('sheetCount').textContent = '共 ' + total + ' 帧 · ' + state.type.toUpperCase() + ' ROLL';
    }

    function prevPage() {
      if (state.page > 1) {
        state.page--;
        renderGallery();
      }
    }

    function nextPage() {
      var images = (state.imageData[state.type] && state.imageData[state.type].webp) ? state.imageData[state.type].webp : [];
      var totalPages = Math.max(1, Math.ceil(images.length / state.perPage));
      if (state.page < totalPages) {
        state.page++;
        renderGallery();
      }
    }

    /* ===== 胶片跑马灯 ===== */
    function buildFilmstrip() {
      var strip = document.getElementById('filmstrip');
      if (!strip || !state.imageData) return;
      var pc = (state.imageData.pc && state.imageData.pc.webp) ? state.imageData.pc.webp : [];
      var pe = (state.imageData.pe && state.imageData.pe.webp) ? state.imageData.pe.webp : [];
      var cnt = document.getElementById('filmCount');
      if (cnt) cnt.textContent = 'TOTAL ' + pad4(pc.length + pe.length) + ' FRAMES';
      fillTrack('filmTrackA', 'pc', pc.slice(0, 14));
      fillTrack('filmTrackB', 'pe', pe.slice(0, 14));
    }

    function fillTrack(id, type, arr) {
      var track = document.getElementById(id);
      if (!track || !arr.length) return;
      var html = '';
      for (var c = 0; c < 3; c++) {
        arr.forEach(function (name, i) {
          html += '<button class="film-frame" onclick="openModalAt(\\'' + type + '\\',' + i + ')" aria-label="查看图片">'
            + '<img src="/converted/' + type + '/webp/' + name + '.webp" loading="lazy" alt="">'
            + '<b>' + type.toUpperCase() + '</b><i>' + pad4(i + 1) + '</i>'
            + '</button>';
        });
      }
      track.innerHTML = html;
    }

    /* ===== 模态框 ===== */
    function openModalAt(type, index) {
      if (!state.imageData) return;
      var list = (state.imageData[type] && state.imageData[type].webp) ? state.imageData[type].webp : [];
      if (!list.length) return;
      state.modal = { type: type, index: index, list: list };
      updateModal();
      document.getElementById('imageModal').classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function updateModal() {
      var m = state.modal;
      var name = m.list[m.index];
      document.getElementById('modalImage').src = '/converted/' + m.type + '/webp/' + name + '.webp';
      document.getElementById('modalCaption').textContent = 'NO.' + m.type.toUpperCase() + '-' + pad4(m.index + 1) + ' · ' + name;
    }

    function modalNav(dir) {
      var m = state.modal;
      if (!m.list.length) return;
      m.index = (m.index + dir + m.list.length) % m.list.length;
      updateModal();
    }

    function closeModal() {
      var m = document.getElementById('imageModal');
      if (m.classList.contains('open')) {
        m.classList.remove('open');
        document.body.style.overflow = '';
      }
    }

    document.addEventListener('keydown', function (e) {
      var open = document.getElementById('imageModal').classList.contains('open');
      if (e.key === 'Escape') closeModal();
      else if (open && e.key === 'ArrowLeft') modalNav(-1);
      else if (open && e.key === 'ArrowRight') modalNav(1);
    });

    /* ===== 暗房时钟 ===== */
    function tickClock() {
      var d = new Date();
      var el = document.getElementById('clock');
      if (el) el.textContent = 'SHA ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    }
    tickClock();
    setInterval(tickClock, 1000);

    /* ===== 数字滚动 ===== */
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var t0 = null, dur = 1100;
      function step(ts) {
        if (!t0) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur);
        k = 1 - Math.pow(1 - k, 3);
        el.textContent = String(Math.round(target * k));
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });

    /* ===== 滚动显影 ===== */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

    /* ===== 初始化图池数据 ===== */
    fetch('/image-list.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.imageData = data;
        buildFilmstrip();
        if (document.getElementById('gallery-page').classList.contains('active')) renderGallery();
      })
      .catch(function () {
        var strip = document.getElementById('filmstrip');
        if (strip) strip.style.display = 'none';
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