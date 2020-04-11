const http = require("http");
const httpProxy = require("http-proxy");
const fs = require("fs");
const spdy = require("spdy");

const { URL } = require("url");

const domainMap = require("./domainMap");

// const relay = require("./lib/relay");

const proxy = httpProxy.createProxyServer({});
const httpsProxy = httpProxy.createProxyServer();

const proxyErrorHandler = (err, req, res) => {
  res.writeHead(500, {
    "Content-Type": "text/plain",
  });
  res.end("Something went wrong. And we are reporting a custom error message.");
};

proxy.on("error", proxyErrorHandler);
httpsProxy.on("error", proxyErrorHandler);

if (process.argv[2] !== "dev") {
  const cert = fs.readFileSync("/etc/letsencrypt/live/chosan.cn/fullchain.pem"),
    key = fs.readFileSync("/etc/letsencrypt/live/chosan.cn/privkey.pem");

  const httpsOptions = {
    cert,
    key,
  };

  // https
  spdy
    .createServer(httpsOptions, (req, res) => {
      const host = req.headers.host;
      // if (relay.isRelay(req)) {
      //   return relay(req, res);
      // }
      const port = domainMap[host];
      console.log(host, port);
      if (port) {
        httpsProxy.web(req, res, {
          target: `http://localhost:${port}`,
        });
      }
    })
    .listen(443, () => {
      console.log("443端口启动成功！");
    });
}

const proxyMap = new Map();
// proxyMap.set("mln.fun", "http://www.diaoyu123.com");
// proxyMap.set("mlo.fun", "http://www.lkong.net");

// 负责将 http 请求重定向到 https
http
  .createServer((req, res) => {
    const host = req.headers.host;
    const url = req.url;
    console.log("http request\n", host, url, req.headers);

    let key = "";
    if ((key = [...proxyMap.keys()].find((el) => host.includes(el)))) {
      console.log("代理到其他网站");
      const target = proxyMap.get(key);
      const hostIndex = req.rawHeaders.findIndex((el) => el.toLowerCase() === "host");
      req.headers.host = req.rawHeaders[hostIndex + 1] = target.replace(/(http|https):\/\//, "");
      console.log(`重定向到\t${target}`);
      proxy.web(req, res, { target });
    // } else if (relay.isRelay(req)) {
    //   // 需要做请求代理
    //   relay(req, res);
    } else {
      console.log("重定向到 https");
      const redirectUrl = new URL(url, `https://${host}`);
      req.headers.origin && res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      res.writeHead(301, { Location: redirectUrl.toString() });
      res.end();
    }
  })
  .listen(80, () => {
    console.log("重定向80端口启动成功！");
  });
