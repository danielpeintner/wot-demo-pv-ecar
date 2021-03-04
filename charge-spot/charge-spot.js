// create a node-wot servient
const Servient = require('@node-wot/core').Servient
const HttpServer = require('@node-wot/binding-http').HttpServer

const HttpClientFactory = require("@node-wot/binding-http").HttpClientFactory
const Helpers = require("@node-wot/core").Helpers

// create Servient add HTTP binding with port configuration
let servient = new Servient();
servient.addServer(new HttpServer({
    port: 8082 // (default 8080)
}));

// Client
let client = new Servient();
client.addClientFactory(new HttpClientFactory({servient: {
        clientOnly: true,
    }}));
let wotHelper = new Helpers(client);


let connected = false;
let connectedPower = 0.0;
let connectedUrl;
let connectedPV;
let connectedError;

let status; // enum
let powerOutlet; // number

function connect() {
	connectedUrl = "http://localhost:8081/pv-system";
    console.log("Connect to " + connectedUrl + "...");
	connectedPower = 0;
    powerOutlet = 0;
	
	wotHelper.fetch(connectedUrl).then(async (td) => {
		// using await for serial execution (note 'async' in then() of fetch())
		try {
			client.start().then((WoT) => {
				WoT.consume(td).then((thing) => {
					connectedPV = thing;
					connected = true;
					connectedError = null;
					checkPVConnection();
				});
			});
		} catch (err) {
			let serr = "Script error:" + err;
			connectedError = new Date().toISOString() + ": " + serr; 
			console.error(serr);
		}
	}).catch((err) => {
		let serr = "Fetch error:" + err;
		connectedError = new Date().toISOString() + ": " + serr; 
		console.error(serr);
	});
}


function checkPVConnection() {
	setTimeout(function(){
		// get connectedPower 
		if (connectedPV) {
			connectedPV.readProperty("power").then((p) => {
				connectedPower = p;
				connectedError = null;
			}).catch((err) => {
				let serr = "Error:" + err;
				connectedError = new Date().toISOString() + ": " + serr; 
				console.error(serr);
				unconnect();
			});			
		} else {
			connected = false;
		}
		
		// check unless not connected any longer
		if (connected) {
			checkPVConnection();
		} else {
			connectedPower = 0;
		}
	}, 250);
}


function unconnect() {
    console.log("Unconnect ...");
	connected = false;
	connectedPower = 0;
	connectedPV = null;
	connectedUrl = null;
    powerOutlet = 0;
}


function plugIn() {
    console.log("Cable plugged in...");
	status = "plugIn";
    powerOutlet = 0;
}

function plugOut() {
    console.log("Cable plugged out...");
    status = "plugOut";
	powerOutlet = 0;
}

function error() {
	console.log("Charge Spot failure...");
	status = "error";
	powerOutlet = 0;
}


servient.start().then((WoT) => {
    WoT.produce({
        title: "Charge Spot",
        properties: {
			"status": {
				"type": "string",
				"enum": [
					"started",
					"stopped",
					"plugIn",
					"plugOut",
					"error"
				]
			},
			"connected": {
				"type": "boolean",
				"description": "Connected to PV",
			},
			"connectedPower": {
				"description": "Power possible",
				"type": "number",
				"unit": "W"
			},
			"connectedUrl": {
				"type": "string"
			},
			"connectedError": {
				"type": "string"
			},
			"powerOutlet": {
				"description": "power on outlet",
				"type": "number",
				"unit": "W"
			}
        },
        actions: {
			"connect": {
			},
			"unconnect": {
			},
			"plugIn": {
			},
			"plugOut": {
			},
			"error": {
			}
        }
    }).then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);
        // init property values
		connected = false;
		connectedPower = 0.0;
		
        status = "powerOff";
        powerOutlet = 0.0;
		
		// set property handlers (using async-await)
		thing.setPropertyReadHandler("connected", async () => connected);
		thing.setPropertyReadHandler("connectedPower", async () => connectedPower);
		thing.setPropertyReadHandler("connectedUrl", async () => connectedUrl);
		thing.setPropertyReadHandler("connectedError", async () => connectedError);
		
		thing.setPropertyReadHandler("status", async () => status);
        thing.setPropertyReadHandler("powerOutlet", async () => powerOutlet);


		// set action handlers (using async-await)
		thing.setActionHandler("connect", async (params, options) => {
            connect();
		});
		thing.setActionHandler("unconnect", async (params, options) => {
            unconnect();
		});
		thing.setActionHandler("plugIn", async (params, options) => {
            plugIn();
		});
		thing.setActionHandler("plugOut", async (params, options) => {
            plugOut();
		});
		thing.setActionHandler("error", async (params, options) => {
            error();
		});

        // expose the thing
        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
            thing.readProperty("status").then((c) => {
                console.log("status is " + c);
            });
            thing.readProperty("powerOutlet").then((c) => {
                console.log("powerOutlet is " + c);
            });
        });
    });
});
