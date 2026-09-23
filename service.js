var PBKDF2_ITERATIONS = 100000;
var PBKDF2_KEYLEN = 32;
var DAV_PREFIX = "/plugins/webdav/dav";

function parseBasic(req) {
    var h = req.headers["authorization"];
    if (!h || h.indexOf("Basic ") !== 0) return null;
    var b64 = h.substring(6).trim();
    var raw;
    try { raw = ts.crypto.base64decode(b64); } catch (e) { return null; }
    var idx = raw.indexOf(":");
    if (idx < 0) return null;
    return { username: raw.substring(0, idx), password: raw.substring(idx + 1) };
}

function findUser(username) {
    var users = ts.users.list();
    for (var i = 0; i < users.length; i++) {
        if (users[i].username === username && !users[i].is_banned) return users[i];
    }
    return null;
}

function getPasswordRecord(userID) {
    var raw = ts.storage.get("pass:" + userID);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

function verifyPassword(userID, password) {
    var rec = getPasswordRecord(userID);
    if (!rec || !rec.salt || !rec.hash) return false;
    var hash = ts.crypto.pbkdf2(password, rec.salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN);
    return ts.crypto.constantTimeCompare(hash, rec.hash);
}

function authenticate(req) {
    var creds = parseBasic(req);
    if (!creds) return null;
    var u = findUser(creds.username);
    if (!u) return null;
    if (!verifyPassword(u.id, creds.password)) return null;
    return u;
}

function unauthorized(res) {
    res.status(401).header("WWW-Authenticate", 'Basic realm="Silo WebDAV"').text("");
}

function davPath(fullPath) {
    if (fullPath.indexOf(DAV_PREFIX) === 0) {
        var rest = fullPath.substring(DAV_PREFIX.length);
        return rest.replace(/^\/+/, "").replace(/\/+$/, "");
    }
    return "";
}

function xmlEscape(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function hrefFor(path, isDir) {
    var parts = path ? path.split("/") : [];
    var encoded = parts.map(function(p) { return encodeURIComponent(p); }).join("/");
    var href = DAV_PREFIX + "/";
    if (encoded) href += encoded;
    if (isDir && href.charAt(href.length - 1) !== "/") href += "/";
    return href;
}

function rfc1123(unixSec) {
    return new Date(unixSec * 1000).toUTCString();
}

function propfindResponse(node) {
    var href = hrefFor(node.path, node.is_dir);
    var xml = "<D:response><D:href>" + xmlEscape(href) + "</D:href><D:propstat><D:prop>";
    if (node.is_dir) {
        xml += "<D:resourcetype><D:collection/></D:resourcetype>";
        xml += "<D:getlastmodified>" + rfc1123(node.mtime) + "</D:getlastmodified>";
    } else {
        xml += "<D:resourcetype/>";
        xml += "<D:getcontentlength>" + node.size + "</D:getcontentlength>";
        xml += "<D:getlastmodified>" + rfc1123(node.mtime) + "</D:getlastmodified>";
        xml += "<D:getcontenttype>" + xmlEscape(node.mime || "application/octet-stream") + "</D:getcontenttype>";
    }
    xml += "</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>";
    return xml;
}

function buildMultistatus(nodes) {
    var xml = '<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:">';
    for (var i = 0; i < nodes.length; i++) xml += propfindResponse(nodes[i]);
    xml += "</D:multistatus>";
    return xml;
}

function handleOptions(req, res) {
    res.status(200)
        .header("DAV", "1")
        .header("Allow", "OPTIONS, GET, HEAD, PROPFIND")
        .header("MS-Author-Via", "DAV")
        .text("");
}

function handlePropfind(req, res) {
    var user = authenticate(req);
    if (!user) return unauthorized(res);

    var path = davPath(req.path);
    var node = ts.torrfs.stat(user.id, path);
    if (!node) return res.status(404).text("not found");

    var depth = String(req.headers["depth"] || "1");
    var nodes = [node];
    if (node.is_dir && depth !== "0") {
        var children = ts.torrfs.list(user.id, path);
        if (children) {
            for (var i = 0; i < children.length; i++) nodes.push(children[i]);
        }
    }

    res.status(207)
        .header("Content-Type", "application/xml; charset=utf-8")
        .text(buildMultistatus(nodes));
}

function handleGet(req, res) {
    var user = authenticate(req);
    if (!user) return unauthorized(res);

    var path = davPath(req.path);
    var node = ts.torrfs.stat(user.id, path);
    if (!node) return res.status(404).text("not found");
    if (node.is_dir) return res.status(405).text("is a directory");

    var h = ts.torrfs.open(user.id, path);
    if (!h) return res.status(404).text("not found");

    res.header("Content-Type", node.mime || "application/octet-stream");
    res.stream(h, node.name);
}

function handleHead(req, res) {
    var user = authenticate(req);
    if (!user) return unauthorized(res);

    var path = davPath(req.path);
    var node = ts.torrfs.stat(user.id, path);
    if (!node) return res.status(404).text("not found");
    if (node.is_dir) return res.status(405).text("is a directory");

    res.status(200)
        .header("Content-Type", node.mime || "application/octet-stream")
        .header("Content-Length", String(node.size))
        .header("Accept-Ranges", "bytes")
        .header("Last-Modified", rfc1123(node.mtime))
        .end();
}

function handleStatus(req, res) {
    if (!req.user) return res.status(401).json({ error: "unauthorized" });
    var rec = getPasswordRecord(req.user.id);
    res.json({
        username: req.user.username,
        has_password: rec !== null,
        dav_url: DAV_PREFIX + "/"
    });
}

function handleSavePassword(req, res) {
    if (!req.user) return res.status(401).json({ error: "unauthorized" });
    var body = req.body || {};
    var password = String(body.password || "");
    if (password.length < 4) return res.status(400).json({ error: "password_too_short" });

    var salt = ts.crypto.randomBytes(16);
    var hash = ts.crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN);
    ts.storage.set("pass:" + req.user.id, JSON.stringify({ salt: salt, hash: hash }));
    res.json({ status: "ok" });
}

function handleRemovePassword(req, res) {
    if (!req.user) return res.status(401).json({ error: "unauthorized" });
    ts.storage.rem("pass:" + req.user.id);
    res.json({ status: "ok" });
}

ts.web.route("OPTIONS", "/dav/*path", handleOptions);
ts.web.route("PROPFIND", "/dav/*path", handlePropfind);
ts.web.get("/dav/*path", handleGet);
ts.web.head("/dav/*path", handleHead);

ts.web.get("/api/status", handleStatus);
ts.web.post("/api/password", handleSavePassword);
ts.web.post("/api/password/remove", handleRemovePassword);

ts.web.staticFile("/", "index.html");
ts.web.staticFile("/index.html", "index.html");
ts.web.staticDir("/js", "js");
ts.web.staticDir("/img", "img");

console.log("[WebDAV] Started");