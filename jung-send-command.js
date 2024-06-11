module.exports = async function (RED) {
  "use strict";
  const { got } = await import("got");
  const { v4: uuid } = require("uuid");
  const crypto = require("crypto");

  const HTTPS_MODULE = require("https");
  const HTTPS_REQUEST = HTTPS_MODULE.request;

  function sendCommand(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    node.settings = RED.nodes.getNode(config.settings);

    const nodeUrl = config.url || this.settings.urlOutValues;
    const nodeMethod = "PUT"; // uppercase
    const datapointID = config.datapointID || "";
    node.headers = [];

    this.ret = "txt";
    this.reqTimeout = 120000;

    this.on("input", function (msg, nodeSend, nodeDone) {
      node.status({ fill: "blue", shape: "dot", text: "httpin.status.requesting" });
      var url = nodeUrl || msg.url;
      if (!url) {
        node.error(RED._("httpin.errors.no-url"), msg);
        nodeDone();
        return;
      }

      // url must start http:// or https:// so assume http:// if not set

      var method = nodeMethod.toUpperCase(); // PUT - to send the command
      var opts = {};
      opts.timeout = { request: node.reqTimeout || 5000 };
      opts.throwHttpErrors = false;
      opts.decompress = false;
      opts.method = method;
      opts.retry = { limit: 0 };
      opts.responseType = "buffer";
      opts.ignoreInvalidCookies = true;

      let ctSet = "Content-Type"; // set default camel case
      let clSet = "Content-Length";

      opts.headers = {};

      this.credentials = this.credentials || {};
      opts.headers.Authorization = `Bearer ${this.settings.authenticationToken || ""}`;

      //
      if (method === "PUT" && typeof msg.payload !== "undefined") {
        var cmd = msg.payload;
        // console.log("jung-sendCommand> sending PUT to=" + this.name + ", with cmd=" + cmd);
        node.warn("jung-sendCommand> sending PUT to=" + this.name + ", with cmd=" + cmd);

        opts.body = `{
            "data": [
              {
                "id": "${datapointID}",
                "type": "datapoint",
                "attributes": {
                  "value": "${cmd}"
                }
              }
            ]
          }`;
        opts.headers[ctSet] = "application/vnd.api+json";
      }

      got(url, opts)
        .then((res) => {
          msg.statusCode = res.statusCode;
          msg.headers = res.headers;
          msg.responseUrl = res.url;
          msg.payload = res.body;
          msg.retry = 0;

          if (msg.statusCode == 204 || msg.statusCode == 200) {
            // node.log("after return> msg.statusCode=" + msg.statusCode);
            node.warn("jung-sendCommand.after return> msg.statusCode=" + msg.statusCode + " -> ok");
            // 200 - ok
            // 204 - ok
            // 401 - unauthorized
          } else {
            node.warn("jung-sendCommand.after return> msg.statusCode=" + msg.statusCode);
          }

          // Convert the payload to the required return type
          if (node.ret !== "bin") {
            msg.payload = msg.payload.toString("utf8"); // txt

            if (node.ret === "obj" || node.ret === "txt") {
              if (msg.statusCode == 204) {
                msg.payload = "{}";
                node.status({});
              }
              if (msg.statusCode == 401) {
                console.log("jung-send-command error: " + msg.payload);
                var mm = JSON.parse(msg.payload);
                node.status({ fill: "red", shape: "ring", text: mm.errors[0].detail });
              }
              try {
                msg.payload = JSON.parse(msg.payload);
              } catch (e) {
                console.log(RED._("httpin.errors.json-error"));
              }
            } else {
              node.status({});
            }
          } else {
            node.status({});
          }

          nodeSend(msg);
          nodeDone();
        })
        .catch((err) => {
          node.error(err, msg);
          node.status({ fill: "red", shape: "ring", text: err.code });
          msg.payload = err.toString() + " : " + url;
          msg.statusCode = err.code || (err.response ? err.response.statusCode : undefined);
          nodeDone();
        });
    });

    this.on("close", function () {
      node.status({});
    });
  }

  RED.nodes.registerType("jung-send-command", sendCommand, {});

  const md5 = (value) => {
    return crypto.createHash("md5").update(value).digest("hex");
  };
  const sha256 = (value) => {
    return crypto.createHash("sha256").update(value).digest("hex");
  };
  const sha512 = (value) => {
    return crypto.createHash("sha512").update(value).digest("hex");
  };

  function digestCompute(algorithm, value) {
    var lowercaseAlgorithm = "";
    if (algorithm) {
      lowercaseAlgorithm = algorithm.toLowerCase().replace(/-sess$/, "");
    }

    if (lowercaseAlgorithm === "sha-256") {
      return sha256(value);
    } else if (lowercaseAlgorithm === "sha-512-256") {
      var hash = sha512(value);
      return hash.slice(0, 64); // Only use the first 256 bits
    } else {
      return md5(value);
    }
  }

  function ha1Compute(algorithm, user, realm, pass, nonce, cnonce) {
    /**
     * RFC 2617: handle both standard and -sess algorithms.
     *
     * If the algorithm directive's value ends with "-sess", then HA1 is
     *   HA1=digestCompute(digestCompute(username:realm:password):nonce:cnonce)
     *
     * If the algorithm directive's value does not end with "-sess", then HA1 is
     *   HA1=digestCompute(username:realm:password)
     */
    var ha1 = digestCompute(algorithm, user + ":" + realm + ":" + pass);
    if (algorithm && /-sess$/i.test(algorithm)) {
      return digestCompute(algorithm, ha1 + ":" + nonce + ":" + cnonce);
    } else {
      return ha1;
    }
  }

  function buildDigestHeader(user, pass, method, path, authHeader) {
    var challenge = {};
    var re = /([a-z0-9_-]+)=(?:"([^"]+)"|([a-z0-9_-]+))/gi;
    for (;;) {
      var match = re.exec(authHeader);
      if (!match) {
        break;
      }
      challenge[match[1]] = match[2] || match[3];
    }
    var qop = /(^|,)\s*auth\s*($|,)/.test(challenge.qop) && "auth";
    var nc = qop && "00000001";
    var cnonce = qop && uuid().replace(/-/g, "");
    var ha1 = ha1Compute(challenge.algorithm, user, challenge.realm, pass, challenge.nonce, cnonce);
    var ha2 = digestCompute(challenge.algorithm, method + ":" + path);
    var digestResponse = qop
      ? digestCompute(challenge.algorithm, ha1 + ":" + challenge.nonce + ":" + nc + ":" + cnonce + ":" + qop + ":" + ha2)
      : digestCompute(challenge.algorithm, ha1 + ":" + challenge.nonce + ":" + ha2);
    var authValues = {
      username: user,
      realm: challenge.realm,
      nonce: challenge.nonce,
      uri: path,
      qop: qop,
      response: digestResponse,
      nc: nc,
      cnonce: cnonce,
      algorithm: challenge.algorithm,
      opaque: challenge.opaque,
    };

    authHeader = [];
    for (var k in authValues) {
      if (authValues[k]) {
        if (k === "qop" || k === "nc" || k === "algorithm") {
          authHeader.push(k + "=" + authValues[k]);
        } else {
          authHeader.push(k + '="' + authValues[k] + '"');
        }
      }
    }
    authHeader = "Digest " + authHeader.join(", ");
    return authHeader;
  }
};
