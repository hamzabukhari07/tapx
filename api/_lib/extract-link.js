/**
 * Converts a pair of Google Maps 64-bit hexadecimal identifiers to a Google Place ID (base64url).
 */
export function hexPairToPlaceId(hex1, hex2) {
  try {
    const buf = Buffer.alloc(20);
    buf.writeUInt8(0x0a, 0);
    buf.writeUInt8(0x12, 1);
    buf.writeUInt8(0x09, 2);

    const h1 = hex1.padStart(16, '0');
    for (let i = 0; i < 8; i++) {
      buf.writeUInt8(parseInt(h1.slice(14 - i * 2, 16 - i * 2), 16), 3 + i);
    }

    buf.writeUInt8(0x11, 11);

    const h2 = hex2.padStart(16, '0');
    for (let i = 0; i < 8; i++) {
      buf.writeUInt8(parseInt(h2.slice(14 - i * 2, 16 - i * 2), 16), 12 + i);
    }

    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (err) {
    return null;
  }
}

/**
 * Extracts a direct Google Review Link from any Google Maps link or mobile share text.
 */
export async function extractReviewLink(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { status: 400, payload: { error: 'Please provide a valid Google Maps link.' } };
  }

  const trimmed = rawInput.trim();

  // 1. Extract URL if the user copied text along with the link (common on mobile Google Maps "Share")
  const urlMatch = trimmed.match(/https?:\/\/[^\s<>"'`\)\(]+/i);
  if (!urlMatch) {
    return { status: 400, payload: { error: 'No valid URL found. Please paste a valid Google Maps link.' } };
  }

  const extractedUrl = urlMatch[0];
  
  // If there is text before the URL (e.g. "Dental Clinic https://maps.app.goo.gl/..."), save as fallback name
  let fallbackName = '';
  const beforeUrl = trimmed.slice(0, urlMatch.index).trim();
  if (beforeUrl) {
    fallbackName = beforeUrl
      .replace(/^Check\s+out\s+/i, '')
      .replace(/\s+on\s+Google\s+Maps:?$/i, '')
      .replace(/[\r\n]+/g, ' ')
      .trim();
  }

  let currentUrl = extractedUrl;
  let collectedHtml = '';
  let finalUrl = extractedUrl;

  // 2. Follow redirects (up to 8 hops) to resolve mobile short links (maps.app.goo.gl, goo.gl/maps, etc.)
  let hops = 0;
  while (hops < 8) {
    hops++;
    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        const nextLoc = response.headers.get('location');
        currentUrl = new URL(nextLoc, currentUrl).href;
        finalUrl = currentUrl;
      } else {
        finalUrl = currentUrl;
        if (response.ok) {
          collectedHtml = await response.text();
        }
        break;
      }
    } catch (fetchErr) {
      console.error('Fetch hop error:', fetchErr);
      break;
    }
  }

  // 3. Extract Business Name
  let businessName = fallbackName;

  // Try extracting name from /maps/place/Business+Name/
  const nameInUrlMatch = finalUrl.match(/\/maps\/place\/([^/@?#]+)/);
  if (nameInUrlMatch && nameInUrlMatch[1]) {
    businessName = decodeURIComponent(nameInUrlMatch[1].replace(/\+/g, ' '));
  }

  // If still no name or fallback, inspect HTML title / meta tags
  if ((!businessName || businessName === 'Google Business') && collectedHtml) {
    const metaTitle = collectedHtml.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                      collectedHtml.match(/<meta\s+itemprop=["']name["']\s+content=["']([^"']+)["']/i) ||
                      collectedHtml.match(/<title>([^<]+)<\/title>/i);
    if (metaTitle && metaTitle[1]) {
      let title = metaTitle[1]
        .replace(/\s*-\s*Google Maps.*$/i, '')
        .replace(/\s*·\s*Google Maps.*$/i, '')
        .trim();
      if (title && !title.toLowerCase().includes('google maps') && !title.toLowerCase().includes('find local businesses')) {
        businessName = title;
      }
    }
  }

  // 4. Extract Hex Pair (!1s0x...:0x... or ftid=0x...:0x...)
  let hex1 = null;
  let hex2 = null;

  const hexRegex = /(?:!1s|ftid=|data=.*?)(0x[0-9a-fA-F]+):(0x[0-9a-fA-F]+)/;
  const hexMatchUrl = finalUrl.match(hexRegex) || extractedUrl.match(hexRegex);
  if (hexMatchUrl) {
    hex1 = hexMatchUrl[1].replace(/^0x/, '');
    hex2 = hexMatchUrl[2].replace(/^0x/, '');
  } else if (collectedHtml) {
    const hexMatchHtml = collectedHtml.match(/(?:!1s|ftid=|\["|\\")(0x[0-9a-fA-F]+):(0x[0-9a-fA-F]+)/);
    if (hexMatchHtml) {
      hex1 = hexMatchHtml[1].replace(/^0x/, '');
      hex2 = hexMatchHtml[2].replace(/^0x/, '');
    }
  }

  if (hex1 && hex2) {
    const placeId = hexPairToPlaceId(hex1, hex2);
    if (placeId) {
      return {
        status: 200,
        payload: {
          success: true,
          reviewLink: `https://search.google.com/local/writereview?placeid=${placeId}`,
          name: businessName || 'Google Business'
        }
      };
    }
  }

  // 5. Fallback: Direct Place ID (ChIJ...)
  const chijRegex = /(ChIJ[a-zA-Z0-9_-]{23,})/;
  const chijMatch = finalUrl.match(chijRegex) || (collectedHtml ? collectedHtml.match(chijRegex) : null);
  if (chijMatch && chijMatch[1]) {
    return {
      status: 200,
      payload: {
        success: true,
        reviewLink: `https://search.google.com/local/writereview?placeid=${chijMatch[1]}`,
        name: businessName || 'Google Business'
      }
    };
  }

  // 6. Fallback: CID parameter
  const cidRegex = /(?:cid=|_cid=|"cid":|data-cid=")([0-9]{15,})/;
  const cidMatch = finalUrl.match(cidRegex) || (collectedHtml ? collectedHtml.match(cidRegex) : null);
  if (cidMatch && cidMatch[1]) {
    return {
      status: 200,
      payload: {
        success: true,
        reviewLink: `https://search.google.com/local/writereview?cid=${cidMatch[1]}`,
        name: businessName || 'Google Business'
      }
    };
  }

  return {
    status: 404,
    payload: {
      error: 'Could not extract Google review link from this URL. Please ensure it is a valid Google Maps place link.'
    }
  };
}
