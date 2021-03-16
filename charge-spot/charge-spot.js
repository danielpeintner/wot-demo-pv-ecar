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
client.addClientFactory(new HttpClientFactory({
	servient: {
		clientOnly: true,
	}
}));
let wotHelper = new Helpers(client);


// turn off some log messages
const debug = console.debug
console.debug = (package, ...args) => {
	// prune all debug messages?
	/*
	if (package !== "[core]" && package !== "[core/exposed-thing]" && package !== "[core/content-senders]" && package !== "[binding-http]") {
		debug(package,...args)
	}
	*/
}
console.warn = (package, ...args) => {
	if (package !== "[core/content-senders]" &&
		(package !== "[binding-http]" && args !== "LOCALHOST FIX")) {
		debug(package, ...args)
	}
}



let connected = false;
let connectedPower = 0.0;
let connectedUrl;
let connectedPV;
let connectedError;

let status; // enum

let connectedCar = null;

function connectPV() {
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
	setTimeout(function () {
		// get connectedPower 
		if (connectedPV && connected) {
			connectedPV.readProperty("power").then((p) => {
				connectedPower = connected ? p : 0;
				connectedError = null;
			}).catch((err) => {
				let serr = "Error:" + err;
				connectedError = new Date().toISOString() + ": " + serr;
				console.error(serr);
				unconnectPV();
			});
		} else {
			connected = false;
		}

		// check unless not connected any longer
		if (connected) {
			checkPVConnection();
		} else {
			connectedPV = null;
			connectedPower = 0;
		}
	}, 250);
}


function unconnectPV() {
	console.log("Unconnect ...");
	connected = false;
	connectedPower = 0;
	connectedPV = null;
	connectedUrl = null;
}

function plugInCar(carUrl) {
	console.log("Cable plugged in into " + carUrl + "...");
	connectedCar = null; // unset
	status = "plugIn";

	wotHelper.fetch(carUrl).then(async (td) => {
		// using await for serial execution (note 'async' in then() of fetch())
		try {
			client.start().then((WoT) => {
				WoT.consume(td).then((thing) => {
					connectedCar = thing;
					chargeCar();
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

function chargeCar() {
	setTimeout(function () {
		//  code after time
		if (connectedCar) {
			let powerToCharge = connectedPower / 10;
			connectedCar.invokeAction("charge", powerToCharge).then((p) => {
				console.log("Successful charged " + powerToCharge + " Watt");
				// -> charge again
				chargeCar();
			}).catch((err) => {
				let serr = "Error:" + err;
				connectedError = new Date().toISOString() + ": " + serr;
				console.error(serr);
				// in case of failure plug-out
				plugOutCar();
			});
		}
	}, 250);
}

function plugOutCar() {
	console.log("Cable plugged out...");
	connectedCar = null;
	status = "plugOut";
}

function error() {
	console.log("Charge Spot failure...");
	status = "error";
}


servient.start().then((WoT) => {
	WoT.produce({
		title: "Charge Spot",
		properties: {
			"status": {
				"type": "string",
				"enum": [
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
			}
		},
		actions: {
			"connectPV": {
			},
			"unconnectPV": {
			},
			"plugInCar": {
			},
			"plugOutCar": {
			},
			"error": {
			}
		}
	}).then((thing) => {
		console.log("Produced " + thing.getThingDescription().title);
		// init property values
		connected = false;
		connectedPower = 0.0;

		status = "plugOut";

		// set property handlers (using async-await)
		thing.setPropertyReadHandler("connected", async () => connected);
		thing.setPropertyReadHandler("connectedPower", async () => connectedPower);
		thing.setPropertyReadHandler("connectedUrl", async () => connectedUrl);
		thing.setPropertyReadHandler("connectedError", async () => connectedError);

		thing.setPropertyReadHandler("status", async () => status);

		// set action handlers (using async-await)
		thing.setActionHandler("connectPV", async (params, options) => {
			connectPV();
		});
		thing.setActionHandler("unconnectPV", async (params, options) => {
			unconnectPV();
		});
		thing.setActionHandler("plugInCar", async (params, options) => {
			plugInCar(params);
		});
		thing.setActionHandler("plugOutCar", async (params, options) => {
			plugOutCar();
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
		});
	});
});
