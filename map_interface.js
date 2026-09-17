import { addSVGElement, randomColour } from "./svg_utils/index.js";
import { TransitMapBackground, TransitMapDrawer, TransitMapWarper } from "./transit_map_ui.js";


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
		for (let [serviceId, timetables] of Object.entries(services)) {
		
			let colour;
			while (coloursHad.has(colour = randomColour())) {};
			coloursHad.add(colour);

			this.services.push({
				id: serviceId,
				colour: colour,
				stops: timetables['0'].map(name => stopsMap.get(name)),
				lineSegments: [],
			})
		}
	}
	
	initLineSections() {
		this.lineSections = [];
		const lineKeys = new Map();
		
		for (let service of this.services) {
			let {colour, stops} = service;
			for (let i = 0; i < stops.length - 1; ++i) {
				let ends = stops.slice(i, i + 2);
				let endNames = ends.map(s => s.name);
				if (endNames[0] > endNames[1]) {
					endNames.reverse()
				}
				let lineKey = endNames.join(',');
				
				if (!(lineKeys.has(lineKey))) { // if this line section not yet encountered
					
					const lineSectionObj = {
						ends: ends, services: []
					}
					lineKeys.set(lineKey, lineSectionObj);
					this.lineSections.push(lineSectionObj);
					for (let stopObj of ends) {
						stopObj.lineSections.push(lineSectionObj);
					}
				}
				
				lineKeys.get(lineKey).services.push(service);
			}
		}
	}
		
	constructor(
		element, image, stops, services, minLon, maxLon, minLat, maxLat,
		drawOptions = {lineWidth: 2, stopMargin: 2, stopRadius: 2, stopOutlineWidth: 1, labelFont: "Arial", labelSize: "12"}
	) {
		Object.assign(this, {minLon, maxLon, minLat, maxLat});
		
		this.svgElement = element;
		
		this.svgElement.setAttribute("width", image.width);
		this.svgElement.setAttribute("height", image.height);
		this.width = image.width;
		this.height = image.height;
		
		const stopsMap = new Map();
		this.stops = [];
		for (let [stop, [lon, lat]] of Object.entries(stops)) {
			const stopObj = {
				...this.baseCoords(lon, lat),
				name: stop,
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
		this.warper = new TransitMapWarper(this.drawer, this.background, this.svgElement, this.stops);

		this.drawer.draw();
	}
}

export { TransitMap };
