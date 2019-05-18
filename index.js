const http = require("http");
const https = require("https");
const httpProxy = require("http-proxy");
const fs = require("fs");
const spdy = require("spdy");
const request = require('request');

const { URL } = require("url");

const util = require("util");
const relay = require('./lib/relay');

const proxy = httpProxy.createProxyServer({});
const httpsProxy = httpProxy.createProxyServer();

const cert = fs.readFileSync("/etc/letsencrypt/live/chosan.cn/fullchain.pem"),
  key = fs.readFileSync("/etc/letsencrypt/live/chosan.cn/privkey.pem");

const proxyOptions = {
  ssl: {
    cert,
    key
  },
  secure: true
};

const httpsOptions = {
  cert,
  key
};



// https
spdy
  .createServer(httpsOptions, (req, res) => {
    const host = req.headers.host;
    const url = req.url;

    console.log("https request\n", host, url);

    if (relay.isRelay(req)) {
      return relay(req, res);
    }
    try {
      switch (host) {
        case "wx.chosan.cn":
          httpsProxy.web(req, res, { target: "http://localhost:9000" }); // 9000 用作 wxapi 端口
          break;
        case "mobile.chosan.cn":
          httpsProxy.web(req, res, { target: "http://localhost:9001" }); // 9001 用作测试 app-mobile
          break;
        case "xtoken.ren":
        case "angel.xtoken.ren":
          httpsProxy.web(req, res, { target: "http://localhost:60001" }); // 60001 用作 xtoken 端口
          break;
        case "chosan.cn":
        case "www.chosan.cn":
          httpsProxy.web(req, res, { target: "https://localhost:3000" }); // 3000 用作博客端口
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(error)
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
    const host = req.headers.host;
    const url = req.url;
    console.log("http request\n", host, url, req.headers);

    let key = "";
    if ((key = [...proxyMap.keys()].find(el => host.includes(el)))) {
      console.log('代理到其他网站');
      const target = proxyMap.get(key);
      const hostIndex = req.rawHeaders.findIndex(
        el => el.toLowerCase() === "host"
      );
      req.headers.host = req.rawHeaders[hostIndex + 1] = target.replace(/(http|https):\/\//, "");
      console.log(`重定向到\t${target}`);
      proxy.web(req, res, { target });
    } else if (relay.isRelay(req)) {
      // 需要做请求代理
      relay(req, res);
    } else {
      console.log('重定向到 https');
      const redirectUrl = new URL(url, `https://${host}`);
      req.headers.origin &&
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      res.writeHead(301, { Location: redirectUrl.toString() });
      res.end();
    }
  })
  .listen(80, () => {
    console.log("重定向80端口启动成功！");
  });
