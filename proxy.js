// MSG91 Email Proxy Server
// Bypasses CORS for browser-based API calls to MSG91
// Also serves static files so you only need ONE terminal

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3091;

// ─── Auto-detect Public IP on startup ───────────────────────────────────────
function detectPublicIP() {
    const options = {
        hostname: 'api.ipify.org',
        path: '/?format=json',
        method: 'GET'
    };
    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
            try {
                const ip = JSON.parse(data).ip;
                console.log('\n  ╔══════════════════════════════════════════════════╗');
                console.log('  ║         MSG91 PROXY SERVER — STARTED             ║');
                console.log('  ╠══════════════════════════════════════════════════╣');
                console.log(`  ║  App URL  : http://localhost:${PORT}                 ║`);
                console.log(`  ║  Your IP  : ${ip.padEnd(38)}║`);
                console.log('  ╠══════════════════════════════════════════════════╣');
                console.log('  ║  ⚠️  If you see apiError 418 (IP not whitelisted) ║');
                console.log(`  ║  Go to MSG91 → API → Whitelist IP → add above IP ║`);
                console.log('  ╚══════════════════════════════════════════════════╝\n');
            } catch(e) {
                console.log(`\n  Proxy running on http://localhost:${PORT}`);
                console.log('  Could not detect public IP.\n');
            }
        });
    });
    req.on('error', () => {
        console.log(`\n  MSG91 Proxy Server running at http://localhost:${PORT}`);
        console.log('  (Could not auto-detect public IP — check manually at whatismyip.com)\n');
    });
    req.end();
}

// ─── MIME types for static file serving ──────────────────────────────────────
const MIME_TYPES = {
    '.html': 'text/html',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff2':'font/woff2',
    '.woff': 'font/woff',
    '.ttf':  'font/ttf',
};

// ─── Main Server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
    // CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authkey, Accept');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ── MSG91 API Proxy ──────────────────────────────────────────────────────
    if (req.method === 'POST' && req.url === '/api/v5/email/send') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            const authkey = req.headers['authkey'] || '';

            console.log(`  [${new Date().toLocaleTimeString()}] Proxying email send request...`);

            const options = {
                hostname: 'control.msg91.com',
                path: '/api/v5/email/send',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'authkey': authkey
                }
            };

            const proxyReq = https.request(options, (proxyRes) => {
                let data = '';
                proxyRes.on('data', chunk => { data += chunk; });
                proxyRes.on('end', () => {
                    const statusCode = proxyRes.statusCode;
                    console.log(`  [${new Date().toLocaleTimeString()}] MSG91 response: ${statusCode}`);

                    // ── Detect IP Whitelist error (apiError 418) ──────────────
                    if (statusCode === 401) {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.apiError === '418' || parsed.apiError === 418) {
                                console.log('\n  ❌ IP WHITELIST ERROR (418) DETECTED!');
                                console.log('  ► Your IP is not whitelisted in MSG91.');
                                console.log('  ► Fix: Login to MSG91 → Profile → API → Whitelist IPs');
                                console.log('  ► Run this app again to see your current public IP.\n');
                            }
                        } catch(e) {}
                    }

                    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                    res.end(data);
                });
            });

            proxyReq.on('error', (err) => {
                console.log(`  [ERROR] Proxy request failed: ${err.message}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            });

            proxyReq.write(body);
            proxyReq.end();
        });
        return;
    }
    
    // ── SMTP Proxy ────────────────────────────────────────────────────────
    if (req.method === 'POST' && req.url === '/api/smtp/send') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            console.log(`  [${new Date().toLocaleTimeString()}] Proxying SMTP send request...`);
            try {
                const payload = JSON.parse(body);
                const { smtp, email } = payload;
                if (!smtp || !email) throw new Error('Missing smtp or email config');

                const nodemailer = require('nodemailer');
                
                const transporter = nodemailer.createTransport({
                    host: smtp.host,
                    port: parseInt(smtp.port),
                    secure: smtp.secure, // true for 465, false for other ports
                    auth: {
                        user: smtp.user,
                        pass: smtp.pass
                    }
                });

                const info = await transporter.sendMail({
                    from: email.from,
                    to: email.to,
                    subject: email.subject,
                    html: email.html
                });

                console.log(`  [${new Date().toLocaleTimeString()}] SMTP response: Success - ${info.messageId}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Email sent successfully via SMTP', messageId: info.messageId }));
            } catch (err) {
                console.log(`  [ERROR] SMTP request failed: ${err.message}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message, message: err.message }));
            }
        });
        return;
    }

    // ── Static File Server ───────────────────────────────────────────────────
    let filePath = req.url === '/' ? '/index.html' : req.url;
    // Strip query strings
    filePath = filePath.split('?')[0];
    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(fullPath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // Serve index.html for SPA fallback
                fs.readFile(path.join(__dirname, 'index.html'), (err2, indexContent) => {
                    if (err2) {
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('Not found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(indexContent);
                    }
                });
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    detectPublicIP();
});
