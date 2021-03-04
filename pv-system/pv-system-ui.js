
let counterProperties = [];

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
				}, 500);
			});
		}).catch((error) => {
			window.alert("Could not fetch TD.\n" + error)
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
				.catch(err => window.alert("error: " + err))
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
	let eventSubscriptions = {}
	for ( let evnt in td.events ) {
		if (td.events.hasOwnProperty(evnt)) {
			let item = document.createElement("li");
			item.setAttribute('dir', 'auto'); // direction-independence, direction-heuristic
			let link = document.createElement("a");
			link.appendChild(document.createTextNode(evnt));

			let checkbox = document.createElement("div");
			checkbox.className = "switch small"
			checkbox.innerHTML = '<input id="' + evnt + '" type="checkbox">\n<label for="' + evnt + '"></label>'
			item.appendChild(link);
			item.appendChild(checkbox)
			document.getElementById("events").appendChild(item);

			eventSubscriptions[evnt] = false;

			checkbox.onclick = (click) => {
				if (document.getElementById(evnt).checked && !eventSubscriptions[evnt] && eventSubscriptions[evnt]===false) {
					console.log("Try subscribing for event: " + evnt);
					eventSubscriptions[evnt] = true;
					thing.subscribeEvent(evnt, function (data) {
						console.log("Data:" + data);
						updateProperties();
					})
					.then(()=> {
						// OK
					})
					.catch((error) => {  window.alert("Event " + evnt + " error\nMessage: " + error); })
					;
				} else if (!document.getElementById(evnt).checked && eventSubscriptions[evnt]) {
					console.log("Try to unsubscribing for event: " + evnt);
					eventSubscriptions[evnt] = false;
					thing.unsubscribeEvent(evnt)
					.then(()=> {
						// OK
					})
					.catch((error) => {  window.alert("Event " + evnt + " error\nMessage: " + error); });
					
				}
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