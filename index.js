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
    let host = req.headers.host;
    let url = req.url;

    console.log('https request\n', host, url);
    
    switch (host) {
        case 'wx.chosan.cn':
            proxy.web(req, res, { target: 'http://localhost:9000' });  // 9000 用作 wxapi 端口
        break;
        case 'chosan.cn':
            proxy.web(req, res, { target: 'https://localhost:3000' });  // 3000 用作博客端口
        default:
            break;
    }
}).listen(443, () => {
    console.log('443端口启动成功！')
})


// 负责将 http 请求重定向到 https
http.createServer((req, res) => { 
    let host = req.headers.host;
    let url = req.url;
    console.log('http request\n', host, url);
    let redirectUrl = new URL(url, `https://${ host}`);
    res.writeHead(301, { 'Location': redirectUrl.toString() });
    res.end();
}).listen(80, () => {
    console.log('重定向80端口启动成功！')
});