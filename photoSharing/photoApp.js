/**
 * Created by vlitvinov on 11.12.2018.
 */

const http = require('http'),
      fs = require('fs'),
      url = require('url'),
      qs = require('querystring'); //can also be used to parse form-data from http <form>. Just collect all chunks and then call qs.parse(form_data) and you'll have form data in associative array (or simply Object).

const ALBUMS_ROOT = /^\/(albums)$/,
      OTHER_ALBUMS = /(\/albums){1}(\/[\w\.-_]+)/,
      SHOW_FILES = "showFiles",
      PAGE_SIZE = "pageSize",
      PAGE = "page";

function handleRequest(req, res) {
    let requestedUrl = url.parse(req.url),
        rawQueryParams = qs.parse(requestedUrl.query),
        params = {};

    console.log(
        '----------------------- ------------------------------------------' + '\n' +
        'Incoming request: ' + '\n' +
        ' Headers: ' + JSON.stringify(req.headers) + '\n' +
        ' Method: ' + req.method + '\n' +
        ' URL: ' + req.url + '\n' +
        ' Path: ' + requestedUrl.pathname + '\n' +
        ' Raw Query: ' + JSON.stringify(rawQueryParams) + '\n' +
        '-----------------------------------------------------------------'
    );

    switch (req.method) {
        case "POST":
            let json_data = '';

            //By default, no encoding is assigned and stream data will be returned as Buffer objects. Setting an encoding causes the stream data to be returned as strings of the specified encoding rather than as Buffer objects.
            //The Readable stream will properly handle multi-byte characters delivered through the stream that would otherwise become improperly decoded if simply pulled from the stream as Buffer objects.
            req.setEncoding('utf8');

            //process incoming POST data
            req.on('data',
                (chunk) => {
                //if chunk is string, if chunk is Buffer
                //we set encoding before subscribing to stream events, so the chunk data will always be represented as String
                    json_data += chunk;
            });
            req.on('end',
                () => {
                let output = '';
                if (!json_data || json_data.length === 0) {
                    output = "Nothing to process.";
                    }
                else {
                    try {
                        let json = JSON.parse(json_data);
                        output = "Received JSON data: " + JSON.stringify(json);
                    } catch (error) {
                        output = "Error parsing JSON: " + error.message;
                    }
                }
                res.end(output);
            });
            req.on('error',
                (error) => {
                //Error object goes here
                    sendFailure(res, "error_processing_post_data", error);
            });
            break;

        case "GET":
        default:
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