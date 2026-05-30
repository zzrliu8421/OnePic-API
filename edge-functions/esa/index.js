const IMAGE_LIST = __IMAGE_LIST_PLACEHOLDER__;

function detectDeviceType(userAgent) {
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(userAgent) ? 'pe' : 'pc';
}

function detectImageFormat(acceptHeader) {
  return 'webp';
}

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
  
  if (returnType === 'redirect') {
    const randomImage = files[Math.floor(Math.random() * fileCount)];
    const imageUrl = `${url.origin}/converted/${type}/${format}/${randomImage}.${format}`;
    
    return new Response(null, {
      status: 302,
      headers: { 'Location': imageUrl }
    });
  }
  
  const images = [];
  for (let i = 0; i < count; i++) {
    const randomImage = files[Math.floor(Math.random() * fileCount)];
    images.push({
      url: `${url.origin}/converted/${type}/${format}/${randomImage}.${format}`,
      format,
      type
    });
  }
  
  if (returnType === 'text') {
    return new Response(images.map(img => img.url).join('\n'), {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
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

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    if (pathname === '/api' || pathname.startsWith('/api?')) {
      return handleApi(request, url);
    }
    
    if (pathname === '/image' || pathname.startsWith('/image?')) {
      return handleImage(request, url);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
