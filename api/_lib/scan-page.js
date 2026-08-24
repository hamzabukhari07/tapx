function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function isSafeRedirectUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// "Clean Redirect" page strips the Referrer header to avoid 403 errors from Google.
export function scanPage(destinationUrl) {
  const safeUrl = escapeHtml(destinationUrl);
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="refresh" content="0; url=${safeUrl}">
    <title>Redirecting...</title>
    <style>
      body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #ffffff; color: #64748b; }
      .container { text-align: center; }
      .loader { border: 2px solid #f1f5f9; border-top: 2px solid #3b82f6; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; margin: 0 auto 12px; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="loader"></div>
      <div style="font-size: 14px;">Connecting to Google...</div>
    </div>
    <script>
      window.onload = function() {
        window.location.replace("${safeUrl}");
      }
    </script>
  </body>
</html>`;
}
