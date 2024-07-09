module.exports = async function (RED) {
  "use strict";
  const { got } = await import("got");
  var getBody = require("raw-body");

  function createResponseWrapper(node, res) {
    var wrapper = {
      _res: res,
    };
    var toWrap = [
      "append",
      "attachment",
      "cookie",
      "clearCookie",
      "download",
      "end",
      "format",
      "get",
      "json",
      "jsonp",
      "links",
      "location",
      "redirect",
      "render",
      "send",
      "sendfile",
      "sendFile",
      "sendStatus",
      "set",
      "status",
      "type",
      "vary",
    ];
    toWrap.forEach(function (f) {
      wrapper[f] = function () {
        // node.warn(RED._("httpin.errors.deprecated-call", { method: "msg.res." + f }));
        var result = res[f].apply(res, arguments);
        if (result === res) {
          return wrapper;
        } else {
          return result;
        }
      };
    });
    return wrapper;
  }

  var cookieParser = function (req, res, next) {
    next();
  };

  var httpMiddleware = function (req, res, next) {
    next();
  };

  var corsHandler = function (req, res, next) {
    next();
  };

  var metricsHandler = function (req, res, next) {
    next();
  };

  var jsonParser = function (req, res, next) {
    next();
  };

  var urlencParser = function (req, res, next) {
    next();
  };

  var multipartParser = function (req, res, next) {
    next();
  };

  // sita funkcija yra butina
  function rawBodyParser(req, res, next) {
    getBody(
      req,
      {
        length: req.headers["content-length"],
        encoding: "utf8",
      },
      function (err, buf) {
        if (err) {
          return next(err);
        }
        try {
          req.body = buf;
        } catch (err) {
          req.body = "";
        }

        next();
      }
    );
  }

  function registerOnJung(xnode) {
    // prettier-ignore
    console.log("registerOnJung> Registering `" + xnode.name + "` (" + 
        xnode.datapointID + ") for active feedback from JUNG on listener URL=" + xnode.url);
    xnode.warn(
      "registerOnJung> Registering `" +
        xnode.name +
        "` (" +
        xnode.datapointID +
        ") for active feedback from JUNG on listener URL=" +
        xnode.url
    );

    const url = "https://open-api.prod.jung-hosting.de/api/v2/subscriptions";
    const method = "POST";
    var opts = {};
    opts.timeout = { request: 5000 };
    opts.throwHttpErrors = false;
    opts.decompress = false;
    opts.method = method;
    opts.retry = { limit: 0 };
    opts.responseType = "buffer";
    opts.ignoreInvalidCookies = true;
    let ctSet = "Content-Type";
    let clSet = "Content-Length";

    opts.headers = {};
    opts.body = `
    {
      "data": {
        "type": "subscription",
        "relationships": {
          "subscriptionDatapoints": {
            "data": [
              {
                "id": "${xnode.datapointID}",
                "type": "datapoint"
              }
            ]
          }
        },
        "attributes": {
          "url": "${xnode.url}"
        }
      }
    }`;
    opts.headers[ctSet] = "application/vnd.api+json";
    opts.headers.Authorization = `Bearer ${xnode.settings.authenticationToken}`;

    got(url, opts)
      .then((res) => {
        var msg = {};
        msg.statusCode = res.statusCode;
        msg.headers = res.headers;
        msg.responseUrl = res.url;
        msg.payload = res.body;
        msg.retry = 0;

        // console.log("after return> msg.statusCode=" + msg.statusCode);
        // 204 - ok
        // 401 - unauthorized

        if (msg.statusCode == 201) {
          var rez = JSON.parse(msg.payload);

          // console.log("subscriptionID=" + JSON.stringify(rez.data.type));  // turi buti subscription
          if (rez.data.type !== "subscription") {
            console.log("registerOnJung> Returned data type is not subscription (-> " + rez.data.type + ")");
            xnode.warn("registerOnJung> Returned data type is not subscription (-> " + rez.data.type + ")");
            return "";
          }
          // console.log("registerOnJung> got.subscriptionID=" + rez.data.id + " for " + xnode.name);
          xnode.subscriptionID = rez.data.id;
          return rez.data.id; // bet sito jau niekam nebereikia
        } else {
          console.log("registerOnJung> Registration failed with code != 201, possible reason: " + msg.payload);
          xnode.warn("registerOnJung> Registration failed with code != 201, possible reason: " + msg.payload);
        }
      })
      .catch((err) => {
        console.error(err);
        // msg.payload = err.toString() + " : " + url;
        // msg.statusCode = err.code || (err.response ? err.response.statusCode : undefined);
      });

    return "";
  }

  function unregisterFromJung(xnode) {
    if (xnode.subscriptionID == "") return "";
    console.log("unregisterFromJung> delete subscriptionID=" + xnode.subscriptionID);

    const url = "https://open-api.prod.jung-hosting.de/api/v2/subscriptions/" + xnode.subscriptionID;
    const method = "DELETE";
    var opts = {};
    opts.timeout = { request: 5000 };
    opts.throwHttpErrors = false;
    opts.decompress = false;
    opts.method = method;
    opts.retry = { limit: 0 };
    opts.responseType = "buffer";
    opts.ignoreInvalidCookies = true;
    let ctSet = "Content-Type";
    let clSet = "Content-Length";

    opts.headers = {};
    opts.body = "";
    opts.headers[ctSet] = "application/vnd.api+json";
    opts.headers.Authorization = `Bearer ${xnode.settings.authenticationToken}`;

    got(url, opts)
      .then((res) => {
        // console.log("result: " + res.statusCode);
        if (res.statusCode == 204) {
          // console.log(xnode.url + " disconnected successfully");
          return;
        }
        // 200 kai yra klaida - nenurodytas ID
        else {
          // 200 klaida jau zinau
          console.log(xnode.url + " result=" + res.statusCode);
        }
      })
      .catch((err) => {
        console.error(err);
        // msg.payload = err.toString() + " : " + url;
        // msg.statusCode = err.code || (err.response ? err.response.statusCode : undefined);
      });

    return;
  }

  function nodeErrorHandler(err, req, res, next) {
    console.log(err);
    res.sendStatus(500);
  }

  function HTTPIn(n) {
    RED.nodes.createNode(this, n);
    // n.name, n.id, n.settings

    var node = this;
    if (n.settings !== "") {
      node.settings = RED.nodes.getNode(n.settings);
    } else {
      console.log("jung-receive-status> no settings available, exiting...");
      return;
    }

    if (RED.settings.httpNodeRoot === false) {
      console.log(node.name + " jung-receive-status> httpNodeRoot is false, all node-based HTTP endpoints are disabled");
      return;
    }

    if (node.settings.authenticationToken === "") {
      console.log(node.name + " jung-receive-status> no authenticationToken provided in settings, cancelling registration...");
      return;
    }

    if (node.settings.callbackURL === "") {
      console.log(node.name + " jung-receive-status> no callbackURL provided in settings, cancelling registration...");
      return;
    }

    /* draft to identify node copy - if node is new or original?
    if (node.oldId !== node.id) {
      console.log("\n", " new node \n");
      node.oldId = node.id;
    } */

    node.url = n.url || "";
    node.datapointID = n.datapointID || "";
    node.subscriptionID = ""; // received from JUNG cloud

    if (node.datapointID === "" || node.url === "") {
      console.log(node.name + " jung-receive-status> no JUNG datapoint ID, no URL provided, cancelling registration...");
      return;
    }

    if (false) {
      // debug
      console.log("node.datapointID: " + node.datapointID);
      console.log("node.id: " + node.id);
    }

    //// end of setup, beginning function definition

    function callback(req, res) {
      // console.log("jung-receive-status> in callback");
      // console.log("jung-receive-status> req:");
      // console.log(req); // nes kitaip objekto neisskleidzia
      // console.log(typeof req); // object
      // console.log(typeof req.body); // string
      // console.log(JSON.parse(req.body));   // object

      var obody = [];
      var sbody = "";
      if (typeof req.body === "string") {
        sbody = req.body;
        obody = JSON.parse(req.body);
      } else {
        sbody = JSON.stringify(req.body);
        obody = req.body;
      }

      var msgid = RED.util.generateId();
      res._msgid = msgid;
      // Since Node 15, req.headers are lazily computed and the property
      // marked as non-enumerable.
      // That means it doesn't show up in the Debug sidebar.
      // This redefines the property causing it to be evaluated *and*
      // marked as enumerable again.
      Object.defineProperty(req, "headers", {
        value: req.headers,
        enumerable: true,
      });

      // debug
      if (false) {
        console.log("receive.js> in post. smsg received: " + sbody + ", type: " + typeof sbody);
        node.warn("receive.js> in post. smsg received: " + sbody + ", type: " + typeof sbody);
        // console.log("receive.js> in post. omsg received: " + obody + ", type: " + typeof obody);
        // console.log('receive.js> in post. sbody.includes("jung-hosting.de/api/"): ' + sbody.includes("jung-hosting.de/api/"));
        /* console.log(
            'receive.js> in post. sbody.includes(\'"type":"datapoint"\'): ' +
              sbody.replace(" ", "").includes('"type":"datapoint"')
          ); */
      }
      if (sbody.includes("jung-hosting.de/api/") && sbody.replace(" ", "").includes('"type":"datapoint"')) {
        // console.log("receive.js> ieskau datapointID=" + datapointID);
        node.warn("receive.js> in post. msg received: " + sbody);
        if (node.datapointID !== "") {
          if (sbody.includes('"id":"' + node.datapointID + '"')) {
            // console.log("receive.js> req.body=" + req.body);
            // console.log("receive.js> req.body.data=" + req.body.data); // undefined
            // console.log("receive.js> obody=" + JSON.stringify(obody));
            const rez = obody.data[0].attributes.value;
            // console.log("receive.js> radau, rez=" + JSON.stringify(rez));
            // this.send({ _msgid: msgid, req: req, res: createResponseWrapper(node, res), payload: rez });
            node.send({ _msgid: msgid, payload: rez });
            res.sendStatus(204);
            if (rez == "true") node.status({ fill: "green", shape: "dot", text: "on" });
            if (rez == "false") node.status({ fill: "gray", shape: "ring", text: "off" });
            return;
          }
        }
      }
      res.sendStatus(400);
    }

    this.on("close", function (done) {
      var node = this;
      if (node.subscriptionID !== "") {
        // console.log("closing `" + this.name + "` with subscriptionID: " + node.subscriptionID);
        unregisterFromJung(node);
      }
      console.log("waiting 1 seconds until everything closes...");
      setTimeout(() => {
        /* Code to run after 1 seconds */
        // console.log("*** really finished ***");
        done();
      }, 1000);
      RED.httpNode._router.stack.forEach(function (route, i, routes) {
        if (route.route && route.route.path === node.url) {
          routes.splice(i, 1);
        }
      });
    });

    //// end of function definition, beginning runtime

    registerOnJung(node);
    console.log("jung-receive-status> registered " + node.url + ", with subscriptionID " + this.subscriptionID);

    // metodas turi būti tik post - čia aš registruoju savo URL ir callback'ą NodeRed sistemoje
    let listenUrl = node.url.replace(node.settings.callbackURL, "");
    RED.httpNode.post(
      listenUrl,
      cookieParser,
      httpMiddleware,
      corsHandler,
      metricsHandler,
      jsonParser,
      urlencParser,
      multipartParser,
      rawBodyParser,
      callback,
      nodeErrorHandler
    );

    if (false) {
      // debug
      console.log("== Registered POST. Current routes ==");
      RED.httpNode._router.stack.forEach(function (route, i, routes) {
        console.log("route.route=" + JSON.stringify(route.route));
        // if (route.route && route.route.path === node.url) {
      });
      console.log("== routes end ==");
    }
  }
  RED.nodes.registerType("jung-receive-status", HTTPIn);
};
