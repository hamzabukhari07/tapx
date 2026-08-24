export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    let longUrl = url;
    
    // Follow redirect if it's a short link
    if (url.includes("maps.app.goo.gl") || url.includes("goo.gl/maps")) {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        longUrl = response.headers.get('location');
      } else {
        return res.status(400).json({ error: "Could not resolve short link." });
      }
    }

    // Parse the long URL to extract the business name and LRD hex token
    const nameMatch = longUrl.match(/\/maps\/place\/([^/]+)\//);
    let businessName = "";
    if (nameMatch && nameMatch[1]) {
      businessName = decodeURIComponent(nameMatch[1].replace(/\+/g, " "));
    }

    const lrdMatch = longUrl.match(/!1s0x([0-9a-fA-F]+):0x([0-9a-fA-F]+)/);
    if (lrdMatch && lrdMatch[1] && lrdMatch[2]) {
      const hex1 = lrdMatch[1];
      const hex2 = lrdMatch[2];
      
      // Convert hex pair to Place ID (base64url of protobuf)
      const buf = Buffer.alloc(20);
      buf.writeUInt8(0x0a, 0); 
      buf.writeUInt8(0x12, 1); 
      buf.writeUInt8(0x09, 2); 
      
      const h1 = hex1.padStart(16, '0');
      for (let i=0; i<8; i++) {
        buf.writeUInt8(parseInt(h1.slice(14 - i*2, 16 - i*2), 16), 3 + i);
      }
      
      buf.writeUInt8(0x11, 11); 
      
      const h2 = hex2.padStart(16, '0');
      for (let i=0; i<8; i++) {
        buf.writeUInt8(parseInt(h2.slice(14 - i*2, 16 - i*2), 16), 12 + i);
      }
      
      const placeId = buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const reviewLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
      
      return res.status(200).json({ 
        success: true, 
        reviewLink, 
        name: businessName || 'Google Business'
      });
    }

    // Fallback: If we can't find LRD, try to find a CID
    const cidMatch = longUrl.match(/cid=([0-9]+)/);
    if (cidMatch && cidMatch[1]) {
      const reviewLink = `https://search.google.com/local/writereview?cid=${cidMatch[1]}`;
      return res.status(200).json({ success: true, reviewLink, name: businessName || 'Google Business' });
    }

    res.status(404).json({ error: "Could not extract business data from this link." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process the link" });
  }
}
