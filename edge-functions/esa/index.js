// 阿里云ESA EdgeRoutine 入口文件
// 统一处理 /api 和 /image 路由请求

// 图片文件列表（构建时嵌入）
const IMAGE_LIST = __IMAGE_LIST_PLACEHOLDER__;

// 检测设备类型
function detectDeviceType(userAgent) {
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(userAgent) ? 'pe' : 'pc';
}

// 检测浏览器支持的图片格式
function detectImageFormat(acceptHeader) {
  return 'webp';
}

// 处理 /api 请求
function handleApi(request, url) {
  const userAgent = request.headers.get('User-Agent') || '';
  const acceptHeader = request.headers.get('Accept') || '';
  
  const params = new URLSearchParams(url.search);
  const count = Math.max(1, Math.min(50, parseInt(params.get('count') || '1')));
  const returnType = params.get('return') || 'json';
  const type = params.get('type') || detectDeviceType(userAgent);
  const format = params.get('format') || detectImageFormat(acceptHeader);
  
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
    const imageUrl = `${url.origin}/converted/${type}/${format}/${randomImage}.${format}`;
    
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
      url: `${url.origin}/converted/${type}/${format}/${randomImage}.${format}`,
      format,
      type
    });
  }
  
  // 处理文本返回类型
  if (returnType === 'text') {
    return new Response(images.map(img => img.url).join('\n'), {
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

// 处理 /image 请求
function handleImage(request, url) {
  const userAgent = request.headers.get('User-Agent') || '';
  const acceptHeader = request.headers.get('Accept') || '';
  
  const type = detectDeviceType(userAgent);
  const format = detectImageFormat(acceptHeader);
  
  const files = IMAGE_LIST[type]?.[format];
  if (!files || files.length === 0) {
    return new Response('No images found', { status: 404 });
  }
  
  const randomImage = files[Math.floor(Math.random() * files.length)];
  const imageUrl = `${url.origin}/converted/${type}/${format}/${randomImage}.${format}`;
  
  return new Response(null, {
    status: 302,
    headers: { 'Location': imageUrl }
  });
}

// EdgeRoutine 标准入口
addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  if (pathname === '/api' || pathname.startsWith('/api?')) {
    return handleApi(request, url);
  }
  
  if (pathname === '/image' || pathname.startsWith('/image?')) {
    return handleImage(request, url);
  }
  
  // 其他请求交给静态资源处理（返回404由静态托管接管）
  return new Response('Not Found', { status: 404 });
}
