import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

interface QrLinkData {
  id: string;
  destinationUrl: string;
  businessName: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// Path for permanent local JSON persistence
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "qr_links.json");

// Ensure data directory and storage file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStoredLinks(): Record<string, QrLinkData> {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading stored QR links:", err);
  }
  return {};
}

function writeStoredLinks(links: Record<string, QrLinkData>) {
  try {
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(links, null, 2), "utf-8");
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.error("Error writing stored QR links:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Route to extract and resolve map link without API keys
  app.post("/api/extract-link", async (req, res) => {
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
          longUrl = response.headers.get('location')!;
        } else {
          return res.status(400).json({ error: "Could not resolve short link." });
        }
      }

      // Parse the long URL to extract the business name and LRD hex token
      // Example: https://www.google.com/maps/place/Dental+Precision/...!1s0x391901dea1531113:0x6d6a9100384152bc!...
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
        
        return res.json({ 
          success: true, 
          reviewLink, 
          name: businessName || 'Google Business'
        });
      }

      // Fallback: If we can't find LRD, try to find a CID
      const cidMatch = longUrl.match(/cid=([0-9]+)/);
      if (cidMatch && cidMatch[1]) {
        const reviewLink = `https://search.google.com/local/writereview?cid=${cidMatch[1]}`;
        return res.json({ success: true, reviewLink, name: businessName || 'Google Business' });
      }

      res.status(404).json({ error: "Could not extract business data from this link." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to process the link" });
    }
  });

  // Admin Login Endpoint
  app.post("/api/admin-login", (req, res) => {
    const { username, password } = req.body;
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim().replace(/\s+/g, '');

    const isValidUser = cleanUser === 'admin';
    const isValidPass = cleanPass === 'admin1234' || cleanPass === 'admin';

    if (isValidUser && isValidPass) {
      return res.json({
        success: true,
        user: {
          uid: 'admin',
          username: 'admin',
          role: 'admin'
        }
      });
    }

    return res.status(401).json({ error: "Invalid username or password." });
  });

  // QR Links API Endpoints (Admin backed)
  app.get("/api/qr-links", (req, res) => {
    try {
      const allLinks = readStoredLinks();
      const links = Object.values(allLinks).sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      res.json({ success: true, links });
    } catch (error) {
      console.error("Fetch links error:", error);
      res.status(500).json({ error: "Failed to fetch QR links." });
    }
  });

  app.get("/api/qr-links/:id", (req, res) => {
    try {
      const { id } = req.params;
      const allLinks = readStoredLinks();
      const link = allLinks[id];
      if (!link) {
        return res.status(404).json({ error: "QR code not found." });
      }
      res.json({ success: true, link });
    } catch (error) {
      console.error("Fetch single link error:", error);
      res.status(500).json({ error: "Failed to load QR code." });
    }
  });

  app.post("/api/qr-links", (req, res) => {
    try {
      const { destinationUrl, businessName } = req.body;
      const id = "qr_" + crypto.randomBytes(6).toString("hex");
      const allLinks = readStoredLinks();
      const newLink: QrLinkData = {
        id,
        destinationUrl: destinationUrl || "",
        businessName: businessName || "Unassigned QR Code",
        userId: "admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      allLinks[id] = newLink;
      writeStoredLinks(allLinks);
      res.json({ success: true, id });
    } catch (error) {
      console.error("Create link error:", error);
      res.status(500).json({ error: "Failed to create QR link." });
    }
  });

  app.put("/api/qr-links/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { destinationUrl, businessName } = req.body;
      const allLinks = readStoredLinks();
      if (!allLinks[id]) {
        // If it doesn't exist, create it
        allLinks[id] = {
          id,
          destinationUrl: destinationUrl || "",
          businessName: businessName || "Unassigned QR Code",
          userId: "admin",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        if (destinationUrl !== undefined) allLinks[id].destinationUrl = destinationUrl;
        if (businessName !== undefined) allLinks[id].businessName = businessName;
        allLinks[id].updatedAt = new Date().toISOString();
      }

      writeStoredLinks(allLinks);
      res.json({ success: true });
    } catch (error) {
      console.error("Update link error:", error);
      res.status(500).json({ error: "Failed to update QR link." });
    }
  });

  app.delete("/api/qr-links/:id", (req, res) => {
    try {
      const { id } = req.params;
      const allLinks = readStoredLinks();
      delete allLinks[id];
      writeStoredLinks(allLinks);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete link error:", error);
      res.status(500).json({ error: "Failed to delete QR link." });
    }
  });

  // Server-side Redirect for QR Scans
  // Using a clean HTML redirect to avoid Referrer-based 403 errors from Google
  app.get("/scan/:id", (req, res) => {
    const { id } = req.params;

    try {
      const allLinks = readStoredLinks();
      const data = allLinks[id];
      
      if (!data) {
        return res.status(404).send("QR Code not found in database.");
      }
      
      if (!data.destinationUrl) {
        return res.redirect(`/setup/${id}`);
      }

      // Use a "Clean Redirect" page to strip the Referrer header.
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="referrer" content="no-referrer">
            <meta http-equiv="refresh" content="0; url=${data.destinationUrl}">
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
              // Javascript fallback if meta refresh fails
              window.onload = function() {
                window.location.replace("${data.destinationUrl}");
              }
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Redirect Error:", error);
      res.status(500).send("Error resolving QR code destination.");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
