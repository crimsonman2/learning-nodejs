/**
 * Created by vlitvinov on 11.12.2018.
 */

const http = require('http'),
      fs = require('fs'),
      url = require('url'),
      querystring = require('querystring');

const ALBUMS_ROOT = /^\/(albums)$/,
      OTHER_ALBUMS = /(\/albums){1}(\/[\w\.-_]+)/,
      SHOW_FILES = "showFiles",
      PAGE_SIZE = "pageSize",
      PAGE = "page";

function handleRequest(req, res) {
    let requestedUrl = url.parse(req.url),
        rawQueryParams = querystring.parse(requestedUrl.query),
        params = {};

    console.log(
        'Incoming request: ' +
        ' Headers: ' + JSON.stringify(req.headers) +
        ' Method: ' + req.method +
        ' URL: ' + req.url +
        ' Path: ' + requestedUrl.pathname +
        ' Raw Query: ' + JSON.stringify(rawQueryParams)
    );

    if (rawQueryParams) {
        if (rawQueryParams[SHOW_FILES]) {
            params.showFiles = (rawQueryParams[SHOW_FILES] === 'true');
        }
        if (rawQueryParams[PAGE_SIZE]) {
            let pageSize = parseInt(rawQueryParams[PAGE_SIZE]);
            params.pageSize = isNaN(pageSize) ? 25 : pageSize;
        }
        if (rawQueryParams[PAGE]) {
            let page = parseInt(rawQueryParams[PAGE]) - 1;
            params.page = isNaN(page) ? 0 : page;
        }
    }

    if (ALBUMS_ROOT.test(requestedUrl.pathname) || OTHER_ALBUMS.test(requestedUrl.pathname)) {
        readAlbums(requestedUrl.pathname, params, (err, data) => {
            if (err) {
                sendFailure(res, 500, err);
            } else {
                sendSuccess(res, data);
            }
        });
    } else {
        sendFailure(res, 404, {code:"BAD_REQUEST", message:"No such page"});
    }
}

function readAlbums(path, params, callback) {
    let dir = __dirname + path;
    fs.readdir(dir, (err, files) => {
        if (err) {
            err.code = "NO_SUCH_ALBUM";
            callback(err);
        } else {
            if (files && files.length === 0) {
                callback(null, files)
            } else {
                let result = [];

                let startIdx = params.page * params.pageSize;

                let iterator = (idx) => {
                    if (idx === files.length) {
                        let pathSplit = path.split("/");
                        callback(null, {
                            shortName: path.substring(path.lastIndexOf("/")+1),
                            content: result.slice(startIdx, startIdx + params.pageSize)
                        });
                    }
                    fs.stat(dir + "/" + files[idx], (err, stats) => {
                        if (err) {
                            callback(err);
                        } else {
                            if (stats.isDirectory()) {
                                result.push({name:files[idx], type:"D"});
                            } else if (params.showFiles && stats.isFile()) {
                                result.push({name:files[idx], type:"F"});
                            }
                            iterator(idx + 1);
                        }
                    });
                };

                iterator(0);
            }
        }
    })
}

function transformError(err) {
    return {code: (err.code ? err.code : err.name), message: err.message};
}

function sendSuccess (res, data) {
    res.writeHead(200, {'content-type': 'application/json'});
    res.end(JSON.stringify({"data": data}), 'utf8');
}

function sendFailure (res, errCode, err) {
    res.writeHead(errCode, {'content-type': 'application/json'});
    res.end(JSON.stringify(transformError(err)), 'utf8');
}

const server = http.createServer(handleRequest);
server.listen(9999);