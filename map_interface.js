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


class TransitMap {
	baseCoords(lon, lat) {
		return {
			x: Math.round(this.width * (lon - this.minLon) / (this.maxLon - this.minLon)),
			y: Math.round(this.height * (1 - (lat - this.minLat) / (this.maxLat - this.minLat)))
		}
	}
	
	initServices(services, stopsMap) {
		this.services = [];
		let coloursHad = new Set();
		for (let [id, [serviceName, timetables]] of Object.entries(Object.entries(services))) {
		
			let colour;
			while (coloursHad.has(colour = randomColour())) {};
			coloursHad.add(colour);

			const service = new Service({
				id: id,
				name: serviceName,
				colour: colour,
				stops: timetables['0'].map(name => stopsMap.get(name)),
			});
			this.services.push(service);
		}
	}
	
	initLineSections() {
		this.lineSections = [];
		const lineKeys = new Map();
		
		for (let service of this.services) {
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
						id: lineKeys.length,
						ends
					});
					lineKeys.set(lineKey, lineSection);
					this.lineSections.push(lineSection);
					for (let stopObj of ends) {
						stopObj.lineSections.push(lineSection);
					}
				}
				lineKeys.get(lineKey).services.push(service);
			}
		}
	}
		
	constructor(
		element, image, stops, services, minLon, maxLon, minLat, maxLat, drawOptions = {}
	) {
		Object.assign(this, {minLon, maxLon, minLat, maxLat});
		
		this.svgElement = element;
		
		this.svgElement.setAttribute("width", image.width);
		this.svgElement.setAttribute("height", image.height);
		this.width = image.width;
		this.height = image.height;
		
		const stopsMap = new Map();
		this.stops = [];
		for (let [id, [stop, [lon, lat]]] of Object.entries(Object.entries(stops))) {
			const stopObj = {
				...this.baseCoords(lon, lat),
				name: stop,
				id: id,
				lineSections: []
				// el
			};
			stopsMap.set(stop, stopObj);
			this.stops.push(stopObj);
		}
		
		this.initServices(services, stopsMap);
		this.initLineSections();
		
		this.containerElement = addSVGElement(this.svgElement, "g", {x: 0, y: 0});
		
		this.background = new TransitMapBackground(this.containerElement, image)
		
		this.drawer = new TransitMapDrawer(this, this.containerElement, drawOptions);
		this.warper = new TransitMapBase(this.drawer, this.background, this.svgElement, this.stops);

		this.drawer.draw();
	}
}

export { TransitMap };
