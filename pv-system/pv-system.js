// create a node-wot servient
const Servient = require('@node-wot/core').Servient
const HttpServer = require('@node-wot/binding-http').HttpServer

// create Servient add HTTP binding with port configuration
let servient = new Servient();
servient.addServer(new HttpServer({
    // port: 8081 // (default 8080)
}));

let status; // enum
let power; // number
let hour;

function start() {
    console.log("Starting PV System...");
	status = "powerOn";
    power = 0;
}

function stop() {
    console.log("Starting PV System...");
    status = "powerOff";
	power = 0;
}

function error() {
	console.log("PV System failure...");
	status = "error";
	power = 0;
}


function sunMovesOn() {
	setTimeout(function(){
		if (hour <= 22) {
			hour += 1;
		} else {
			hour = 0;
		}
		if (status == "powerOn") {
			if (hour >= 6 && hour <= 18) {
				// "power" hours
				let step = 1000;
				if (hour > 12) {
					power = (19-hour) * step;
				} else {
					power = (hour-5) * step;
				}
			} else {
				power = 0;
			}
		} else {
			power = 0;
		}
		console.log("Charging power is " + power);
		
		// moves on all the time
		sunMovesOn();
	}, 1000);
}

servient.start().then((WoT) => {
    WoT.produce({
        title: "PV system",
        description: "Solar power system",
        properties: {
			"status": {
				"title": "Betriebszustand",
				"description": "Mögliche Zustände (Strom Produktion, Nachtmodus, Fehler)",
				"type": "string",
				"enum": [
					"powerOn",
					"powerOff",
					"error"
				]
			},
			"power": {
				"title": "Aktuelle Leistung",
				"description": "Leistung in Watt",
				"type": "number",
				"unit": "W"
			},
			"hour": {
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
        status = "powerOff";
        power = 0.0;
		hour = 6; // with morning hours
		
		// set property handlers (using async-await)
		thing.setPropertyReadHandler("status", async () => status);
        thing.setPropertyReadHandler("power", async () => power);
		thing.setPropertyReadHandler("hour", async () => hour);


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
