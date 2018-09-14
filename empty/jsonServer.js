let http = require("http"),
    fs   = require('fs'),
    url  = require('url');

let server = http.createServer(handleRequest);
server.listen(8080);

const ALBUMS_URL = /^\/albums.json$/;
const ALBUMS_ROOT = "albums";
const ALBUM_CONTENT_URL = /^\/albums\/content\/(\w*)\.json$/;
const CURRENT_DIR = ".";
const TYPE = ".json";
const DEFAULT_PAGE = "1";
const DEFAULT_PAGESIZE = "10";

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
    } else {
        sendFailure(res, 404, {code:"not_supported_url", message: "Provided URL is not supported."});
    }
}

function handleLoadAlbums(req, res, page, pageSize) {
    getAlbumList(page, pageSize, (err, albums) => {
        if (err) {
            sendFailure(res, 500, err);
        } else {
            sendSuccess(res, albums);
        }
    });
}

function handleLoadPhotos(req, res, page, pageSize) {
    let pathName = req.parsedUrl.pathname;
    let urlParts = pathName.split('/');
    let album = urlParts[3].slice(0, -TYPE.length);
    getFiles(album, page, pageSize, (err, photos) => {
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

function getAlbumList(page, pageSize, callback) {
    let albumsRoot = CURRENT_DIR + "/" + ALBUMS_ROOT;
    fs.readdir(albumsRoot, (err, files) => {
        let result = [];
        if (err) {
            callback(err);
        } else {
            let iterator = (index) => {
                if (index == files.length) {
                    let startIndex = page * pageSize;
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

function getFiles(albumName, page, pageSize, callback) {
    let albumDir = CURRENT_DIR + "/" + ALBUMS_ROOT + "/" + albumName;
    fs.readdir(albumDir, (err, files) => {
        let result = {album: albumName, photos: []};
        if (err) {
            callback(err);
        } else {
            let iterator = (index) => {
                if (index == files.length) {
                    let startIndex = page * pageSize;
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

