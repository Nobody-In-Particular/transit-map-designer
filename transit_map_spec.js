import { randomColour } from "./svg_utils/index.js";

class LineSection {
	constructor({id, ends, services = [], routingPoints = [], lineSegments = []} = {}) {
		Object.assign(this, {id, ends, services, routingPoints, lineSegments});
	}
}

class Service {
	constructor({id, name, colour, stops = [], lineParts = [], group = null} = {}) {
		Object.assign(this, {id, name, colour, stops, lineParts, group});
	}
}

class Stop {
	constructor({id, name, oldId, x, y, lineSections = [], el = null} = {}) {
		Object.assign(this, {id, name, oldId, x, y, lineSections, el});
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
		for (let [id, [oldId, {name, lat, lon}]] of Object.entries(Object.entries(stops))) {
			const stop = new Stop ({
				x: Math.round(width * (lon - minLon) / (maxLon - minLon)),
				y: Math.round(height * (1 - (lat - minLat) / (maxLat - minLat))),
				name, id, oldId
			});
			stopsMap.set(parseInt(oldId), stop);
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
				stops: stops.map((oldId) => (stopsMap.get(oldId)))
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

export { TransitMapSpec as default };