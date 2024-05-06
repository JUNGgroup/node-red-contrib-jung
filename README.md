# Introduction

Integrate JUNG Smart Devices via JUNG OpenAPI to Node-RED.

Albrecht JUNG GmbH is German manufacturer (www.jung.de) of Smart Home devices. JUNG push buttons and relays/actuators are compatible with KNX standard (www.knx.org; https://www.jung-group.com/en-DE/Products/New-items/#knx) and with own JUNG HOME protocoll based on Bluetooth Mesh (https://www.jung-group.com/en-DE/Products/New-items/#junghome). Both can be integrated with Node-RED.

```

npm install @jung.group/node-red-contrib

```

### Nodes

There are 3 Nodes in the package:

1. “Send Command“ Node – to send commands to JUNG Smart Device;
2. “Receive Status” Node – so that changes at your home are pushed to Node-RED;
3. “Configuration” Node – here authentication token to your home is entered.

### Authenticating

Authentication Token can be obtained by registering to JUNG OpenAPI portal
https://open-api.prod.jung-hosting.de/.

### Connecting to your home

Connection to your home is established in the following process:

1. In your home you install gateway to myJUNG cloud. One of:
   - SV-SERVER
   - JUNG Visu Pro
   - JUNG HOME Gateway (BT S GATEWAY)
2. On JUNG website, you create an account “myJUNG”.
3. In configuration of SV-SERVER / JUNG Visu Pro / JUNG HOME Gateway – you enter your credentials of your MyJUNG account. In case of:
   - SV-SERVER (Version 1.2.1805):
     - all functions that have an IoT switch set to ON are visible in the OpenAPI
   - JVP-SERVER (Version 4.9.0.4):
     - all functions that are created in an IoT group
     - set OpenAPI checkbox in VisServer
   - JUNG HOME (Version 1.0):
     - all commissioned devices for the JUNG Home Gateway
4. Create an account on OpenAPI portal
5. On OpenAPI portal you create an “Installation”.
6. On OpenAPI portal you choose “Connect” to your created installation. A small dialog process will follow, where you will be asked again to authorize with your myJUNG account.

If all is correct, your SV-server / JUNG Visu Pro / JUNG HOME Gateway will be recognized, and you can authorize access to this device. The datapoints this device exports will be visible in OpenAPI portal and accessible to Node-RED.

If you have any problems, please consult a documentation of corresponding JUNG gateway.
