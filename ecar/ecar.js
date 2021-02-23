// create a node-wot servient
const Servient = require('@node-wot/core').Servient
const HttpServer = require('@node-wot/binding-http').HttpServer

// create Servient add HTTP binding with port configuration
let servient = new Servient();
servient.addServer(new HttpServer({
    // port: 8081 // (default 8080)
}));

let chargingStatus;
let driving;
let charging;

function driveCar() {
    console.log("Driving...");
    driving = true;
    charging = false;
    setTimeout(function(){
        //  code after time
        let decStep = 0.25;
        chargingStatus -= 1;
        if (chargingStatus < 0) {
            driving = false;
            chargingStatus = 0.0;
            console.log("Battery drained :-(");
        } else {
            // keep on driving ?
            if (driving) {
                driveCar();
            }
        }
        console.log("Charging status decreased by " + decStep + " -> " + chargingStatus);
    }, 250);
}

function stopCar() {
    console.log("STOP driving!");
    driving = false;
}

function chargeCar() {
    console.log("Charging...");
    charging = true;
    driving = false;
    setTimeout(function(){
        //  code after time
        let incStep = 0.25;
        chargingStatus += incStep;
        if (chargingStatus >= 100) {
            chargingStatus = 100.0;
            charging = false;
            console.log("Battery fully charged :-)");
        } else {
            // keep on charging ?
            if (charging) {
                chargeCar();
            }
        }
        console.log("Charging status increased by " + incStep + " -> " + chargingStatus);
    }, 250);
}

function stopCharging() {
    console.log("STOP charging!");
    charging = false;
}

servient.start().then((WoT) => {
    WoT.produce({
        title: "eCar",
        description: "eCarThing",
        properties: {
            chargingStatus: {
                type: "number",
                description: "Current chargingStatus in % (0 ... 100%)",
                observable: true,
                readOnly: true,
                minimum: 0.0,
                maximum: 100.0
            },
            driving: {
                type: "boolean",
                description: "Is car driving around",
                observable: true,
                readOnly: true
            },
            charging: {
                type: "boolean",
                description: "Is car charging",
                observable: true,
                readOnly: true
            }
        },
        actions: {
            startDriving: {
                description: "Starting to drive"
            },
            stopDriving: {
                description: "Stopping to drive"
            },
            startCharging: {
                description: "Starting to charge"
            },
            stopCharging: {
                description: "Stopping to charge"
            }
        }
    }).then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);
        // init property values
        chargingStatus = 85.25;
        driving = false;
        charging = false;
		// set property handlers (using async-await)
		thing.setPropertyReadHandler("chargingStatus", async () => chargingStatus);
        thing.setPropertyReadHandler("driving", async () => driving);
        thing.setPropertyReadHandler("charging", async () => charging);


		// set action handlers (using async-await)
		thing.setActionHandler("startDriving", async (params, options) => {
            driveCar();
		});
		thing.setActionHandler("stopDriving", async (params, options) => {
            stopCar();
		});
        thing.setActionHandler("startCharging", async (params, options) => {
            chargeCar();
		});
        thing.setActionHandler("stopCharging", async (params, options) => {
            stopCharging();
		});

        // expose the thing
        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
            thing.readProperty("chargingStatus").then((c) => {
                console.log("chargingStatus is " + c);
            });
        });
    });
});
