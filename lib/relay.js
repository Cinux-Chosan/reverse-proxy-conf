/*
 * Project: reverse-proxy-conf
 * File Created: Saturday, 18th May 2019 12:34:32 pm
 * Author: zhangjianjun (179817004@qq.com)
 * -----
 * Last Modified: Saturday, 18th May 2019 7:29:04 pm
 * Modified By: zhangjianjun (179817004@qq.com>)
 */

const request = require('request');
const PassThrough = require('stream').PassThrough;
const { URL } = require("url");

const getSearchParams = (req, paramName) => {
  const host = req.headers.host;
  const url = req.url;
  const searchParams = new URL(url, `http://${host}`).searchParams;
  return paramName ? searchParams.get(paramName) : searchParams;
}

const isRelay = req => {
  return !!getSearchParams(req).get('toUrl');
}

const updateReq = (req) => {
  const toUrlEncoded = getSearchParams(req, 'toUrl');
  const interval = getSearchParams(req, 'interval');
  const url = decodeURIComponent(toUrlEncoded);
  return new Promise((res, rej) => {
    const delayReq = request({ url }).on('response', (response) => {
      const resCache = { data: new Buffer(''), interval };
      response
        .on('data', data => {
          resCache.data = Buffer.concat([resCache.data, data]);
        })
        .on('end', () => {
          resCache.response = response;
          resCache.lastTime = Date.now();
          res(resCache);
        });
    });
    req.pipe(delayReq);
  })
}

const reqCache = {
  // [toUrl]: {
  //   resList: [],  // 请求缓存列表
  //   resData: {     // 响应数据
  //     response,  // request 返回的响应对象
  //     data,     // buffer 数据
  //     lastTime  // 最新获取的时间，用于计算该响应缓存是否过期
  //   }
  // }
}

module.exports = (() => {
  // 如果需要缓存，需要在请求中携带 interval 字段，其值为请求间隔的毫秒时间
  // 注意，请求缓存不应该用于携带有敏感 cookie 的响应等，使用应考虑具体情况
  let reqLock = false;
  return async (req, res) => {
    const toUrlEncoded = getSearchParams(req, 'toUrl');
    const toUrl = decodeURIComponent(toUrlEncoded);
    const interval = getSearchParams(req, 'interval');
    if (interval) {
      // 设置了间隔时间，需要做请求缓存
      reqCache[toUrl] = reqCache[toUrl] || { resList: [], resData: {} }
      const urlData = reqCache[toUrl];
      const resCache = urlData.resData;
      const resList = urlData.resList;
      if (resCache && Date.now() - resCache.lastTime < interval) {
        // 有缓存并且缓存未过期，直接使用缓存进行响应
        const { statusCode, statusMessage, headers } = resCache.response;
        res.writeHead(statusCode, statusMessage, headers);
        res.end(resCache.data);
      } else {
        // 没有缓存或缓存已过期
        resList.push(res);
        // 执行更新
        if (!reqLock) {
          reqLock = true;
          const reqObj = await updateReq(req);
          reqCache[toUrl].resData = reqObj;
          reqLock = false;
          while (resList.length) {
            const res = resList.pop();
            const { data, response: { statusCode, statusMessage, headers }} = reqObj;
            res.writeHead(statusCode, statusMessage, headers);
            res.end(data);
          }
        }
      }
    } else {
      // 未设置间隔时间，直接请求，不需要缓存
      return req.pipe(request(toUrl)).pipe(res);
    }
  }
})()

// 定期清理过期缓存
setInterval(() => {
  for (const url in reqCache) {
    if (reqCache.hasOwnProperty(url)) {
      const { resData: { lastTime, interval } } = reqCache[url];
      if (Date.now() - lastTime > interval) {
        // 缓存过期，清理
        reqCache[url] = null;
      }
    }
  }
}, 60000);

module.exports.isRelay = isRelay;
