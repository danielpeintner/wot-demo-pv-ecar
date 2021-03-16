// create a node-wot servient
const Servient = require('@node-wot/core').Servient
const HttpServer = require('@node-wot/binding-http').HttpServer

// create Servient add HTTP binding with port configuration
let servient = new Servient();
servient.addServer(new HttpServer({
	port: 8081 // (default 8080)
}));

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

let status; // enum
let power; // number
let hourOfDay;

function start() {
	console.log("Starting PV System...");
	status = "powerOn";
	power = 0;
}

function stop() {
	console.log("Stopping PV System...");
	status = "powerOff";
	power = 0;
}

function error() {
	console.log("PV System failure...");
	status = "error";
	power = 0;
}


function sunMovesOn() {
	setTimeout(function () {
		// get current seconds and transform it into hours
		// 60 seconds ~ 24 hours -> 2.5 secs means 1 hour
		// --> 1 minute is one day
		let date = new Date();
		let secs = date.getSeconds();
		hourOfDay = Math.round(secs / 2.5);

		if (status == "powerOn") {
			if (hourOfDay >= 6 && hourOfDay <= 18) {
				// "power" hours
				let step = 1000;
				if (hourOfDay > 12) {
					power = (19 - hourOfDay) * step;
				} else {
					power = (hourOfDay - 5) * step;
				}
			} else {
				power = 0;
			}
		} else {
			power = 0;
		}
		console.log("Charging power at hour " + hourOfDay + " is " + power);

		// moves on all the time
		sunMovesOn();
	}, 500);
}

servient.start().then((WoT) => {
	WoT.produce({
		title: "PV system",
		description: "Solar power system",
		properties: {
			"status": {
				"title": "Operating status",
				"type": "string",
				"enum": [
					"powerOn",
					"powerOff",
					"error"
				]
			},
			"power": {
				"title": "Current power",
				"type": "number",
				"unit": "W"
			},
			"hourOfDay": {
				"type": "number"
			}
		},
		actions: {
			"start": {
			},
			"stop": {
			},
			"error": {
			}
		}
	}).then((thing) => {
		console.log("Produced " + thing.getThingDescription().title);
		// init property values
		status = "powerOn"; //  "powerOff";
		power = 0.0;
		hourOfDay = 6; // with morning hours

		// set property handlers (using async-await)
		thing.setPropertyReadHandler("status", async () => status);
		thing.setPropertyReadHandler("power", async () => power);
		thing.setPropertyReadHandler("hourOfDay", async () => hourOfDay);


		// set action handlers (using async-await)
		thing.setActionHandler("start", async (params, options) => {
			start();
		});
		thing.setActionHandler("stop", async (params, options) => {
			stop();
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
			thing.readProperty("power").then((c) => {
				console.log("power is " + c);
			});

			sunMovesOn();
		});
	});
});
