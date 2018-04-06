const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const fs = require('fs');

let { URL } = require('url');

let  cert = fs.readFileSync('/etc/letsencrypt/live/www.chosan.cn/fullchain.pem'),
key = fs.readFileSync('/etc/letsencrypt/live/www.chosan.cn/privkey.pem')

let proxyOptions = {
    ssl: {
        cert,
        key
    },
    secure: true
}

let httpsOptions = {
    cert,
    key
}

let proxy = httpProxy.createProxyServer(proxyOptions);

https.createServer(httpsOptions, (req, res) => {
    let url = req.url;

    console.log('https', req.headers.host, req.url);

    if (url.startsWith('/wxapi')) {
        proxy.web(req, res, { target: 'https://localhost:9000' });  // 9000 用作 wxapi 端口
    } 
    if (url.startsWith('/api')) {
        proxy.web(req, res, { target: 'https://localhost:3000' });  // 3000 用作博客端口
    }

}).listen(443, () => {
    console.log('443端口启动成功！')
})


// 负责将 http 请求重定向到 https
http.createServer((req, res) => { 
    console.log('http', req.headers.host, req.url);
    let redirectUrl = new URL(req.url, `https://${req.headers.host}`);
    res.writeHead(301, { 'Location': redirectUrl.toString() });
    res.end();
}).listen(80, () => {
    console.log('重定向80端口启动成功！')
});