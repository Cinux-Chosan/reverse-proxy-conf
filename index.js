const http = require("http");
const https = require("https");
const httpProxy = require("http-proxy");
const fs = require("fs");
const spdy = require("spdy");

let { URL } = require("url");

let util = require("util");

let cert = fs.readFileSync("/etc/letsencrypt/live/chosan.cn/fullchain.pem"),
  key = fs.readFileSync("/etc/letsencrypt/live/chosan.cn/privkey.pem");

let proxyOptions = {
  ssl: {
    cert,
    key
  },
  secure: true
};

let httpsOptions = {
  cert,
  key
};

let proxy = httpProxy.createProxyServer({});
let httpsProxy = httpProxy.createProxyServer();

// https
spdy
  .createServer(httpsOptions, (req, res) => {
    let host = req.headers.host;
    let url = req.url;

    console.log("https request\n", host, url);

    switch (host) {
      case "wx.chosan.cn":
        httpsProxy.web(req, res, { target: "http://localhost:9000" }); // 9000 用作 wxapi 端口
        break;
      case "mobile.chosan.cn":
        httpsProxy.web(req, res, { target: "http://localhost:9001" }); // 9001 用作测试 app-mobile
        break;
      case "chosan.cn":
      case "www.chosan.cn":
        httpsProxy.web(req, res, { target: "https://localhost:3000" }); // 3000 用作博客端口
      default:
        break;
    }
  })
  .listen(443, () => {
    console.log("443端口启动成功！");
  });

proxyMap = new Map();
proxyMap.set("ysd.kim", "http://www.atool.org");
proxyMap.set("mln.fun", "http://www.diaoyu123.com");
proxyMap.set("mlo.fun", "http://www.lkong.net");
proxyMap.set("mln.kim", "http://www.a5ks.com");

// 负责将 http 请求重定向到 https
http
  .createServer((req, res) => {
    let host = req.headers.host;
    let url = req.url;
    console.log("http request\n", host, url);
    let key = "";
    if ((key = [...proxyMap.keys()].find(el => host.includes(el)))) {
      let target = proxyMap.get(key);
      let hostIndex = req.rawHeaders.findIndex(
        el => el.toLowerCase() === "host"
      );
      req.headers.host = req.rawHeaders[hostIndex + 1] = target.replace( /(http|https):\/\//, "" );
      console.log(`重定向到\t${target}`);
      proxy.web(req, res, { target });
    } else {
      let redirectUrl = new URL(url, `https://${host}`);
      req.headers.origin &&
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      res.writeHead(301, { Location: redirectUrl.toString() });
      res.end();
    }
  })
  .listen(80, () => {
    console.log("重定向80端口启动成功！");
  });
