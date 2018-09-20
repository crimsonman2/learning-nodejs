let http = require("http"),
    fs   = require('fs'),
    url  = require('url'),
    path = require('path');

let server = http.createServer(handleRequest);
server.listen(8080);

const ALBUMS_URL = /^\/albums$/;
const ALBUM_CONTENT_URL = /^\/albums\/(\w|\d)*$/;
const STATIC_CONTENT_URL = /^(\/content\/)(\w+\.\w+)$/;
const FILE_MATCHER =/\w+\.\w+/;
const CURRENT_DIR = __dirname;
const DEFAULT_PAGE = "1";
const DEFAULT_PAGESIZE = "10";

//templates/some_template.html
//page/page_name/[optional_junk]

function handleRequest(req, res) {
    console.log("INCOMING REQUEST:: " + req.method + ": " + req.url);

    req.parsedUrl = url.parse(req.url, true);

    let pathName = req.parsedUrl.pathname;
    let queryParams = req.parsedUrl.query;
    let page = queryParams.page ? parseInt(queryParams.page) - 1 : DEFAULT_PAGE;
    let pageSize = queryParams.page_size ? parseInt(queryParams.page_size) : DEFAULT_PAGESIZE;

    if (isNaN(page)) {
        page = DEFAULT_PAGE;
    }
    if (isNaN(pageSize)) {
        pageSize = DEFAULT_PAGESIZE;
    }

    if (ALBUM_CONTENT_URL.test(pathName)) {
        handleLoadPhotos(req, res, page, pageSize);
    } else if (ALBUMS_URL.test(pathName)) {
        handleLoadAlbums(req, res, page, pageSize);
    } else if (req.method.toLowerCase() === 'get' && STATIC_CONTENT_URL.test(pathName)) {
        let matched = FILE_MATCHER.exec(pathName);

        if (matched) {
            let fileName = matched.pop();
            serveStaticFile(fileName, res)
        } else {
            sendFailure(res, 404, {code: "not_a_file", message:"Requested content is not a file."});
        }
    }
    else {
        sendFailure(res, 404, {code:"not_supported_url", message: "Provided URL is not supported."});
    }
}

function handleLoadAlbums(req, res, page, pageSize) {
    getAlbumList(req, page, pageSize, (err, albums) => {
        if (err) {
            sendFailure(res, 500, err);
        } else {
            sendSuccess(res, albums);
        }
    });
}

function handleLoadPhotos(req, res, page, pageSize) {
    let pathName = req.parsedUrl.pathname;
    getFiles(pathName, page, pageSize, (err, photos) => {
        if (err) {
            sendFailure(res, 500, err);
        } else {
            sendSuccess(res, photos);
        }
    });
}

function sendSuccess(res, data) {
    let output = {error: null, data: data};
    res.writeHead(200, {"Content-Type" : "application/json"});
    res.end(JSON.stringify(output) + "\n");
}

function sendFailure(res, httpCode, err) {
    res.writeHead(httpCode, {"Content-Type" : "application/json"});
    res.end(stringifyError(err));
}

function getAlbumList(req, page, pageSize, callback) {
    let albumsRoot = CURRENT_DIR + req.parsedUrl.pathname;
    fs.readdir(albumsRoot, (err, files) => {
        let result = [];
        if (err) {
            callback(err);
        } else {
            let iterator = (index) => {
                if (index == files.length) {
                    let startIndex = (page - 1) * pageSize;
                    callback(null, result.slice(startIndex, startIndex + pageSize));
                    return;
                }

                let path = albumsRoot + "/" + files[index];
                fs.stat(path, (err, stats) => {
                    if (err) {
                        callback(err);
                    } else {
                        if (stats.isDirectory()) {
                            result.push(files[index]);
                        }
                        iterator(index + 1);
                    }
                });
            };
            iterator(0);
        }
    });
}

function getFiles(albumPath, page, pageSize, callback) {
    let albumDir = CURRENT_DIR + albumPath;
    let albumName = albumPath.split("/").pop();
    fs.readdir(albumDir, (err, files) => {
        let result = {album: albumName, photos: []};
        if (err) {
            callback(err);
        } else {
            let iterator = (index) => {
                if (index == files.length) {
                    let startIndex = (page - 1) * pageSize;
                    result.photos = result.photos.slice(startIndex, startIndex + pageSize);
                    callback(null, result);
                    return;
                }

                let path = albumDir + "/" + files[index];
                fs.stat(path, (err, stats) => {
                    if (err) {
                        callback(err);
                    } else {
                        if (stats.isFile()) {
                            result.photos.push(files[index]);
                        }
                        iterator(index + 1);
                    }
                });
            };
            iterator(0);
        }
    });
}

function stringifyError(err) {
    return JSON.stringify({code: err.code ? err.code : err.name, message: err.message});
}

function serveStaticFile(fileName, res) {
    console.log("Requested file: " + fileName);

    res.writeHead(200, {"Content-Type" : getContentType(fileName)});

    let rs = fs.createReadStream(fileName);
    /*
     * "readable", "drain" and "end" events could be totally replaced by "pipe()" method of ReadStream
     *   rs.pipe(res); //by default you just provide WriteStream to ReadStream and that's all
     *   You only have to worry about "error" event. You also have to manually close each writable stream cause
     *   if the Readable stream emits an error during processing, the Writable destination is not closed automatically.
     *   i.e.
     *   rs.on("error", (err) => {
     *       //process an error
     *       res.end(JSON.stringify(err));S
     *   })
     * */
    /*    rs.on("readable", () => {
        let data = rs.read(),
            chunk;

        if (data) {
            if (typeof data === 'string') {
                chunk = data;
            } else if (typeof data === 'object' && data instanceof Buffer) {
                chunk = data.toString('utf8'/!*, 0, data.length*!/);
            }
        }

        if (chunk && !res.write(chunk)) {
            rs.pause();
        }
    });
    rs.on("drain", () => {
        rs.resume();
    });
    rs.on("end", () => {
        res.end("\n");
    });*/
    rs.pipe(res);
    rs.on("error", (err) => {
        res.writeHead(500, {"Content-Type" : "application/json"});
        res.end(JSON.stringify({name: err.name, message: err.message}) + "\n");
    });
}

function getContentType(fileName) {
    let parts = fileName.split(".");
    /*
     * can use 'path' module for this
     * let ext = path.extname(fileName); //returns extension with a "." sign
     * */

    switch (parts.pop().toLowerCase()) {
        case "html": return "text/html";
        case "css": return "text/css";
        case "jpeg": case "jpg": return "image/jpeg";
        default: return "text/plain";
    }
}