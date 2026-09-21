import { addSVGElement, randomColour } from "./svg_utils/index.js";
import { TransitMapBackground, TransitMapDrawer, TransitMapBase } from "./transit_map_ui.js";

/*
Section = line of all services between two stops.
Segment = line of all services between two routing points.
Part = one service line between two stops.
*/


class LineSection {
	constructor({id, ends, services = [], routingPoints = [], lineSegments = []}) {
		Object.assign(this, {id, ends, services, routingPoints, lineSegments});
	}
}

class Service {
	constructor({id, name, colour, stops = [], lineParts = []}) {
		Object.assign(this, {id, name, colour, stops, lineParts});
	}
}

class Stop {
	constructor({id, name, x, y, lineSections = [], el = null}) {
		Object.assign(this, {id, name, x, y, lineSections, el});
	}
}

class TransitMapSpec {
	constructor(stops, services, lineSections) {
		this.services = services;
		this.stops = stops;
		this.lineSections = lineSections;
	}
	
	static createFromObjects(stops, services, width, height, minLon, maxLon, minLat, maxLat) {		
		// STOPS
		const stopsMap = new Map();
		const specStops = [];
		
		for (let [id, [name, [lat, lon]]] of Object.entries(Object.entries(stops))) {
			const stop = new Stop ({
				x: Math.round(width * (lon - minLon) / (maxLon - minLon)),
				y: Math.round(height * (1 - (lat - minLat) / (maxLat - minLat))),
				name, id
			});
			stopsMap.set(name, stop);
			specStops.push(stop);
		}
		
		// SERVICES
		const specServices = [];
		let coloursHad = new Set();
		for (let [id, [serviceName, stops]] of Object.entries(Object.entries(services))) {
		
			let colour;
			while (coloursHad.has(colour = randomColour())) {};
			coloursHad.add(colour);

			const service = new Service({
				id: id,
				name: serviceName,
				colour: colour,
				stops: stops.map(name => stopsMap.get(name)),
			});
			specServices.push(service);
		}
		
		// LINE SECTIONS
		const specLineSections = [];
		const lineKeys = new Map();
		
		for (let service of specServices) {
			let {stops} = service;
			for (let i = 0; i < stops.length - 1; ++i) {
				let ends = stops.slice(i, i + 2);
				let endNames = ends.map(s => s.name);
				if (endNames[0] > endNames[1]) {
					endNames.reverse()
				}
				let lineKey = endNames.join(',');
				
				if (!(lineKeys.has(lineKey))) { // if this line section not yet encountered
					
					const lineSection = new LineSection({
						id: specLineSections.length,
						ends
					});
					lineKeys.set(lineKey, lineSection);
					specLineSections.push(lineSection);
					for (let stop of ends) {
						stop.lineSections.push(lineSection);
					}
				}
				lineKeys.get(lineKey).services.push(service);
			}
		}
		
		return new TransitMapSpec(specStops, specServices, specLineSections);
	}
}


class TransitMap {
	constructor(
		element, image, stops, services, minLon, maxLon, minLat, maxLat, drawOptions = {}
	) {
		Object.assign(this, {minLon, maxLon, minLat, maxLat});
		
		this.svgElement = element;
		
		this.svgElement.setAttribute("width", image.width);
		this.svgElement.setAttribute("height", image.height);
		this.width = image.width;
		this.height = image.height;
		
		this.spec = TransitMapSpec.createFromObjects(stops, services, this.width, this.height, minLon, maxLon, minLat, maxLat);
		
		this.containerElement = addSVGElement(this.svgElement, "g", {x: 0, y: 0});
		
		this.background = new TransitMapBackground(this.containerElement, image)
		
		this.drawer = new TransitMapDrawer(this.spec, this.containerElement, drawOptions);
		this.warper = new TransitMapBase(this.spec, this.drawer, this.background, this.svgElement);

		this.drawer.draw();
	}
}

export { TransitMap };
