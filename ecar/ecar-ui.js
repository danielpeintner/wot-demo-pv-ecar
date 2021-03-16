
let counterProperties = [];
let drivePos = -1;

function showError(s) {
	document.getElementById("error").value = new Date().toISOString() + ": " + s; 
}
 
function get_td(addr) {
	servient.start().then((thingFactory) => {
		helpers.fetch(addr).then((td) => {
			thingFactory.consume(td)
			.then((thing) => {
				showInteractions(thing);
				
				// update properties every X milliseconds
				setInterval(async function(){ 
					// update properties
					updateProperties();
					// update image
					let allProps = await thing.readAllProperties();
					let chargingStatus = allProps["chargingStatus"]; // await thing.readProperty("chargingStatus");
					let driving =  allProps["driving"]; // await thing.readProperty("driving");
					let charging =  allProps["pluggedIn"]; // await thing.readProperty("pluggedIn");
					
					document.getElementById("driving").checked = driving;
					document.getElementById("charging").checked = charging;
					
					document.getElementById("lblChargingStatus").innerHTML = chargingStatus; // .toFixed(2) + "%";
					
					if (chargingStatus <= 0) {
						document.getElementById("ecarImage").src = "images/eco-car-empty.png";
					} else if (driving) {
						if (drivePos == 1) {
							document.getElementById("ecarImage").src = "images/eco-car-drive2.png";
							drivePos = 2;
						} else if (drivePos == 2) {
							document.getElementById("ecarImage").src = "images/eco-car-drive3.png";
							drivePos = 3;
						} else {
							document.getElementById("ecarImage").src = "images/eco-car-drive1.png";
							drivePos = 1;
						}
					} else if (charging) {
						document.getElementById("ecarImage").src = "images/eco-car-charge.png";
					} else {
						document.getElementById("ecarImage").src = "images/eco-car-parking.png";
					}
				}, 500);
			});
		}).catch((error) => {
			showError("Could not fetch TD.\n" + error)
		})
	})
}

function showInteractions(thing) {
	let td = thing.getThingDescription();
	counterProperties = [];
	for ( let property in td.properties ) {
		if (td.properties.hasOwnProperty(property)) {
			let dtItem = document.createElement("dt");
			counterProperties.push(dtItem);
			let ddItem = document.createElement("dd");
			ddItem.setAttribute('dir', 'auto'); // direction-independence, direction-heuristic
			ddItem.appendChild(document.createTextNode("???"));
			let link = document.createElement("a");
			link.appendChild(document.createTextNode(property));
			dtItem.appendChild(link);
			document.getElementById("properties").appendChild(dtItem);
			document.getElementById("properties").appendChild(ddItem);

			dtItem.onclick = (click) => {
				thing.readProperty(property)
				.then(
					res => { ddItem.textContent = res; }
				)
				.catch(err => showError("error: " + err))
			}
			
			// update value right-away
			dtItem.click();
		}
	};
	for ( let action in td.actions ) {
		if (td.actions.hasOwnProperty(action)) {
			let item = document.createElement("li");
			item.setAttribute('dir', 'auto'); // direction-independence, direction-heuristic
			let button = document.createElement("button");
			button.appendChild(document.createTextNode(action));
			button.className = "button tiny secondary"
			item.appendChild(button)
			document.getElementById("actions").appendChild(item);

			item.onclick = (click) => { 
				thing.invokeAction(action)
					.then((res) => { 
						button.style.background = 'rgb(0,255,0,0.2)';
						setTimeout(function () {
						  button.style.background = null;
						}, 500);
						updateProperties();
					})
					.catch((err) => {
						button.style.background = 'rgb(255,0,0,0.2)';
						setTimeout(function () {
						  button.style.background = null;
						}, 500);
					})
			}
		}
	};
	// Check if visible
	let placeholder = document.getElementById("interactions")
	if ( placeholder.style.display === "none") {
		placeholder.style.display = "block"
	}
}

function updateProperties() {
	counterProperties.forEach(function(prop) {
	  prop.click();
	});
}

var servient = new Wot.Core.Servient();
servient.addClientFactory(new Wot.Http.HttpClientFactory());
var helpers = new Wot.Core.Helpers(servient);
window.onload = () => {
	// process passed URL
	let $_GET = location.search.substr(1).split("&").reduce((o,i)=>(u=decodeURIComponent,[k,v]=i.split("="),o[u(k)]=v&&u(v),o),{});
	if($_GET["url"]) {
		document.getElementById("td_addr").value = $_GET["url"];
	}
	get_td(document.getElementById("td_addr").value);
};