// create a node-wot servient
const Servient = require('@node-wot/core').Servient
const HttpServer = require('@node-wot/binding-http').HttpServer

const HttpClientFactory = require("@node-wot/binding-http").HttpClientFactory
const Helpers = require("@node-wot/core").Helpers

// create Servient add HTTP binding with port configuration
let servient = new Servient();
servient.addServer(new HttpServer({
    port: 8083 // (default 8080)
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
    if (package !== "[core]" && package !== "[core/wot-impl]" && package !== "[core/servient]" && package !== "[core/exposed-thing]" && package !== "[core/helpers]" && package !== "[core/consumed-thing]" && package !== "[core/content-senders]" && package !== "[binding-http]") {
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

const maxPower = 50000; // 50 kW

const chargeSpotUrl = "http://localhost:8082/charge-spot";
let chargeSpot = null;

let power;
let chargingStatus;
let driving;
let pluggedIn;

function driveCar() {
    console.log("Driving...");
    driving = true;
    plugOutCar();
    setTimeout(function () {
        //  code after time
        let decStep = 250;
        power -= decStep;
        updateChargingStatus();
        if (power <= 0) {
            driving = false;
            power = 0.0;
            console.log("Battery drained :-(");
        } else {
            // keep on driving ?
            if (driving) {
                driveCar();
            }
        }
        console.log("Power decreased by " + decStep + " -> " + power);
    }, 250);
}

function updateChargingStatus() {
    if (power <= 0) {
        power = 0;
        chargingStatus = 0.0;
    } else if (power >= maxPower) {
        power = maxPower;
        chargingStatus = 100.0;
    } else {
        chargingStatus = (power / maxPower * 100).toFixed(2);
    }
}

function stopCar() {
    console.log("STOP driving!");
    driving = false;
}

function plugInCar() {
    console.log("Plugging-in...");
    stopCar();

    // Note: connect car and wait to be charged
    wotHelper.fetch(chargeSpotUrl).then(async (td) => {
        // using await for serial execution (note 'async' in then() of fetch())
        try {
            client.start().then((WoT) => {
                WoT.consume(td).then((thing) => {
                    chargeSpot = thing;
                    thing.invokeAction("plugInCar", "http://localhost:8083/ecar").then((p) => {
                        console.log("Plug-in successful");
                        pluggedIn = true;
                        driving = false;
                    }).catch((err) => {
                        let serr = "Error:" + err;
                        connectedError = new Date().toISOString() + ": " + serr;
                        console.error(serr);
                    });
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

async function plugOutCar() {
    try {
        if (chargeSpot) {
            await chargeSpot.invokeAction("plugOutCar");
        }
        pluggedIn = false;
        console.log("STOP being plugged in!");
    } catch (err) {
        let serr = "PlugOut error:" + err;
        connectedError = new Date().toISOString() + ": " + serr;
        console.error(serr);
    }
}

function charge(watt) {
    console.log("Charge " + watt + " Watt.");
    power += watt;
    if (power >= maxPower) {
        plugOutCar();
    }
    updateChargingStatus();
}

servient.start().then((WoT) => {
    WoT.produce({
        title: "eCar",
        description: "eCarThing",
        properties: {
            power: {
                type: "number",
                description: "Current power in Watt ",
                observable: true,
                readOnly: true
            },
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
            pluggedIn: {
                type: "boolean",
                description: "Is car plugged-in",
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
            plugIn: {
                description: "Plugin-in"
            },
            plugOut: {
                description: "Plug-out"
            },
            charge: {
                description: "Plug-out",
                input: {
                    type: "number" // Watt
                }
            }
        }
    }).then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);
        // init property values
        power = 40000;
        updateChargingStatus();
        driving = false;
        pluggedIn = false;
        // set property handlers (using async-await)
        thing.setPropertyReadHandler("power", async () => power);
        thing.setPropertyReadHandler("chargingStatus", async () => chargingStatus);
        thing.setPropertyReadHandler("driving", async () => driving);
        thing.setPropertyReadHandler("pluggedIn", async () => pluggedIn);


        // set action handlers (using async-await)
        thing.setActionHandler("startDriving", async (params, options) => {
            driveCar();
        });
        thing.setActionHandler("stopDriving", async (params, options) => {
            stopCar();
        });
        thing.setActionHandler("plugIn", async (params, options) => {
            plugInCar();
        });
        thing.setActionHandler("plugOut", async (params, options) => {
            plugOutCar();
        });
        thing.setActionHandler("charge", async (params, options) => {
            charge(params);
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
