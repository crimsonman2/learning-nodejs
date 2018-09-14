/**
 * Created by vlitvinov on 06.09.2018.
 */

let http = require('http'),
    fs   = require('fs'),
    url  = require('url'),
    path = require('path');

    // contents = '',
    // rs = fs.createReadStream("./albums/readme.txt");

/*
rs.on("readable", () => {
    let chunk,
        d = rs.read();

    if (d) {
        if (typeof d === 'string') {
            chunk = d;
        } else if (typeof d === 'object' && d instanceof Buffer) {
            chunk = d.toString('utf8', 0, d.length);
        }
    }

    if (chunk) {
        contents += chunk;
    }
});

rs.on("end", () => {
     console.log("End up reading file contents.");
     console.log("----------------------------------------------------------");
     console.log(contents.toString("utf8"));
     console.log("----------------------------------------------------------");
 });

rs.on("error", (err) => {
     console.log("Can't read file contents:: " + err.code + ": " + err.message);
 });*/

const STATIC_CONTENT_URL = /^(\/content\/$)/;
const FILE_MATCHER =/^\w+\.\w+/;

let server = http.createServer(handleRequest);
server.listen(8080);

function handleRequest(req, res) {
    //req.pathname = new url.URL(req.url).pathname;

    if (req.method.toLowerCase() === 'get' && STATIC_CONTENT_URL.test(req.url)) {
        console.log("Static content requested.");
        let fileName = FILE_MATCHER.exec(req.url)[0].substring(0);
        serveStaticFile(fileName, res);
    } else {
        let out = {error: "not_found", message: "Not found"};

        res.writeHead(404, {"Content-Type" : "application/json"});
        res.end(JSON.stringify(out) + "\n");
    }
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
    rs.on("readable", () => {
        let data = rs.read(),
            chunk;

        if (data) {
            if (typeof data === 'string') {
                chunk = data;
            } else if (typeof data === 'object' && data instanceof Buffer) {
                chunk = data.toString('utf8'/*, 0, data.length*/);
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
    });
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