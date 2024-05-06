module.exports = async function (RED) {
  const { got } = await import("got");
  var node = {};

  function jungCloudConfigNode(n) {
    RED.nodes.createNode(this, n);
    node = this;

    node.installationName = n.installationName || "myJUNG";
    node.authenticationToken = n.authenticationToken || "";
    node.urlOutDatapoints = "https://open-api.prod.jung-hosting.de/api/v2/datapoints";
    node.urlOutValues = "https://open-api.prod.jung-hosting.de/api/v2/datapoints/values";
    node.callbackURL = n.callbackURL || "";
    node.datapoints = n.datapoints || "";
    node.datapointsLastUpdate = n.datapointsLastUpdate || "";
  }

  RED.httpAdmin.post("/jung/getDatapoints", function (req, res) {
    var reqjson = JSON.parse(JSON.stringify(req.body));

    if (reqjson.force_refresh === undefined) {
      if (node.datapoints !== "") return node.datapoints;
    }

    const nUrlOutDatapoints = "https://open-api.prod.jung-hosting.de/api/v2/datapoints";

    var opts = {};
    opts.timeout = { request: 5000 };
    opts.throwHttpErrors = false;
    opts.decompress = false;
    opts.method = "GET";
    opts.retry = { limit: 0 };
    opts.responseType = "buffer";
    opts.ignoreInvalidCookies = true;
    opts.headers = {};
    // prettier-ignore
    if (reqjson.auth_token !== undefined) {
      opts.headers.Authorization = "Bearer " + reqjson.auth_token;
    }
    else if (node.authenticationToken !== undefined) {
      opts.headers.Authorization = "Bearer " + node.authenticationToken;
    }
    else {
      console.log("jungCloud-config error> no auth token available, exiting...");
      return;
    }
    // console.log("auth=" + opts.headers.Authorization);

    got(nUrlOutDatapoints, opts)
      .then((resG) => {
        // console.log("Received datapoints: " + JSON.stringify(JSON.parse(resG.body)));
        try {
          var dp = JSON.parse(resG.body);

          dp["data"].forEach((x, i) => {
            delete x["relationships"];
            delete x["links"];
          });

          dp["data"].sort((a, b) => {
            let fa = a.attributes.title.toLowerCase(),
              fb = b.attributes.title.toLowerCase();

            if (fa < fb) {
              return -1;
            }
            if (fa > fb) {
              return 1;
            }
            return 0;
          });

          res.json(dp["data"]);

          var d = new Date();
          node.datapointsLastUpdate = d;
          node.datapoints = dp["data"];
        } catch (err) {
          console.log("getDatapoints> error: " + err);
          res.json("{}");
          return;
        }
      })
      .catch((err) => {
        console.log("getDatapoints> error in request to server: " + err);
        res.json("{}");
        return;
      });
  });

  RED.nodes.registerType("jungcloud-config", jungCloudConfigNode);
};
