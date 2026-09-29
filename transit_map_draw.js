import { addSVGElement, editSVGElement, HTML_URL, calcPerpendicularTranslation, getSVGCoords, transformCoords, dragging } from './svg_utils/index.js';
import "./routing_wasm.js";

const RoutingWASM = Module;

const pointTypes = {
	WARPING: 0,
	FIXED: 1,
	AUTOMATIC: 2
}


function getOrReturnObj(val, arr) {
	if (typeof val == "number" || !isNaN(parseInt(val))) {
		return arr[val]
	} else {
		return val;
	}
}

class TransitMapBackground {
	constructor(containerElement, imageBitmap) {
		this.containerElement = containerElement;
		this.bbox = {
			x: 0,
			y: 0,
			width: imageBitmap.width,
			height: imageBitmap.height
		};
		this.origin = {x: 0, y: 0}
		
		this.canvasWrapper = addSVGElement(this.containerElement, "foreignObject", this.bbox);
	
		this.canvas = document.createElement("canvas");
		this.canvas.setAttribute("xmlns", HTML_URL);
		this.canvas.width = this.bbox.width;
		this.canvas.height = this.bbox.height;
		this.ctx = this.canvas.getContext("2d", {willReadFrequently: true});
		this.ctx.drawImage(imageBitmap, 0, 0);
		this.canvasWrapper.appendChild(this.canvas);
	}
	
	setBbox(newBbox) {
		const tempImageData = this.ctx.getImageData(0, 0, this.bbox.width, this.bbox.height);
		
		editSVGElement(this.canvasWrapper, newBbox);
		
		this.canvas.width = newBbox.width;
		this.canvas.height = newBbox.height;
		this.ctx.putImageData(tempImageData, this.origin.x - newBbox.x, this.origin.y - newBbox.y);
		
		this.origin.x = -newBbox.x;
		this.origin.y = -newBbox.y;
		
		this.bbox = newBbox;
	}
	
	panzoom(matrix) {
		const {a, b, c, d, e, f} = matrix;
		this.canvasWrapper.setAttribute("transform", `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);
	}
}

class RoutingPoint {
	routing = true;
	
	constructor({x, y, type, lineSection, index}) {
		Object.assign(this, {x, y, type, lineSection, index});
	}
	
	get typeString() {
		return ["warping", "fixed", "automatic"][this.type]
	}

	get neighbours() {
		return new Neighbours(
			this.lineSection.getPointAt(this.index), // -1 for before, +1 for end-correction
			this.lineSection.getPointAt(this.index + 2) // + 1 for after, + 1 for end-correction
		)
	}
	
	repositionToNeighbours() {
		if (this.type == pointTypes.AUTOMATIC) {
			const {x, y} = RoutingWASM.get_routing_point(...this.neighbours, this);
			this.x = x;
			this.y = y;
		}
	}
	
	correctPositionOrNeighbours() {
		const neighbours = this.neighbours;
		const automaticNeighbours = neighbours.getAutomatic();
		
		if (this.type == pointTypes.AUTOMATIC && automaticNeighbours.length < 2) {
			if (automaticNeighbours.length == 0) {
				this.repositionToNeighbours();
			} else {
				const corrector = automaticNeighbours[0];
				const correctorSideFixed = corrector.neighbours.not(this);
				const thisSideFixed = neighbours.not(corrector);
				const [
					{x: xThis, y: yThis},
					{x: xCorrector, y: yCorrector}
				] = RoutingWASM.get_routing_points_half_fixed(thisSideFixed, correctorSideFixed, this, corrector);
				this.x = xThis;
				this.y = yThis;
				corrector.x = xCorrector;
				corrector.y = yCorrector;
			}
		} else {
			for (let rp of this.neighbours.getAutomatic()) {
				rp.repositionToNeighbours();
			}
		}
	}
	
	getAutomaticNeighbours() {
		return this.neighbours.getAutomatic();
	}
}

class Neighbours extends Array {
	getAutomatic() {
		return this.filter((rp) => rp.type == pointTypes.AUTOMATIC);
	}
	not(routingPoint) {
		if (this[0] == routingPoint) {
			return this[1];
		} else {
			return this[0];
		}
	}
}

class Stop {
	routing = false;
	type = pointTypes.WARPING;
	
	constructor({id, name, oldId, x, y} = {}) {
		Object.assign(this, {id, name, oldId, x, y});
		this.lineSections = [];
	}
	
	getAutomaticNeighbours() {
		const automaticNeighbours = [];
		for (let lineSection of this.lineSections) {
			if (lineSection.routingPoints.length > 0) {
				const neighbourRoutingPoint =
					this == lineSection.ends[0] ?
					lineSection.routingPoints[0] :
					lineSection.routingPoints[lineSection.routingPoints.length - 1]
				if (neighbourRoutingPoint.type == pointTypes.AUTOMATIC) {
					automaticNeighbours.push(neighbourRoutingPoint);
				}
			}
		}
		return automaticNeighbours;
	}
}


class TransitMapDrawer {
	constructor(
		spec, containerElement,
		{
			lineWidth = 3,
			stopMargin = 2,
			stopRadius = 2,
			stopOutlineWidth = 1,
			minStopWidth = 4,
			minStopHeight = 4,
			routingPointElementId = "routing-point-template",
			labelXOffset = 4
		} = {}
	){
		this.mapSpec = spec;
		this.containerElement = containerElement;
		this.lineLayer = addSVGElement(this.containerElement, "g");
		this.stopLayer = addSVGElement(this.containerElement, "g");
		this.labelLayer = addSVGElement(this.containerElement, "g");
		
		this.options = {lineWidth, stopMargin, stopRadius, stopOutlineWidth, minStopWidth, minStopHeight, routingPointElementId, labelXOffset};
		this.options.routingPointWidth = document.getElementById(this.options.routingPointElementId).getBBox().width;
		
		this.lineParts = [];
		
		for (let service of this.mapSpec.services) {			
			service.label = addSVGElement(this.labelLayer, "text", {"class": "service label", visibility: "hidden"});
			service.label.dataset.serviceId = service.id;
			service.label.textContent = service.name;
		}
		
		for (let lineSection of this.mapSpec.lineSections) {
			this.#createLineSegments(lineSection);
		}
		
		for (let stop of this.mapSpec.stops) {
			this.createStop(stop);
		}
		
		this.pzMatrix = new DOMMatrix();
		
	}
	
	panzoom(matrix) {
		this.pzMatrix = matrix;
	}
	
	#coordTransform(x, y) {
		return transformCoords(x, y, this.pzMatrix);
	}
	
	
	screenToSVG(x, y) {
		return getSVGCoords(x, y, this.containerElement)
	}
	
	#getStop(stop) {
		return getOrReturnObj(stop, this.mapSpec.stops);
	}
	
	#getService(service) {
		return getOrReturnObj(service, this.mapSpec.services);
	}
	
	#getLineSection(lineSection) {
		return getOrReturnObj(lineSection, this.mapSpec.lineSections);
	}
	
	showStopLabel(stop) {
		stop = this.#getStop(stop);
		editSVGElement(stop.label, {visibility: "visible"});
	}
	
	hideStopLabel(stop) {
		stop = this.#getStop(stop);
		editSVGElement(stop.label, {visibility: "hidden"});
	}
		
	
	highlightService(service, x, y) {
		service = this.#getService(service);
		({x, y} = this.#coordTransform(x, y));
		editSVGElement(service.label, {
			x: x + this.options.labelXOffset,
			y: y,
			visibility: "visible"
		});
		for (let part of this.lineParts) {
			if (part.dataset.serviceId != service.id) {
				editSVGElement(part, {visibility: "hidden"});
			}
		}
	}
	
	showAllServicesAndHideLabels() {
		for (let part of this.lineParts) {
			editSVGElement(part, {visibility: "visible"});
		}
		for (let service of this.mapSpec.services) {
			editSVGElement(service.label, {visibility: "hidden"});
		}
	}
	



	createStop(stop) {
		stop.width = this.options.minStopWidth;
		stop.height = this.options.minStopHeight;
		stop.el = addSVGElement(this.stopLayer, "rect", {
			fill: "white", stroke: "black",
			"stroke-width": this.options.stopOutlineWidth,
			rx: this.options.stopRadius, ry: this.options.stopRadius,
			"class": "stop graphic"
		});
		stop.el.dataset.stopId = stop.id;
		stop.el.dataset.type = "stop";
		
		stop.label = addSVGElement(
			this.labelLayer, "text",
			{"class": "stop label", visibility: "hidden"}
		);
		stop.label.dataset.stopId = stop.id;
		stop.label.textContent = stop.name;
	}
	
	
	drawStop(stop) {
		stop = this.#getStop(stop);

		let {x, y, width, height} = stop;
		
		({x, y} = this.#coordTransform(x, y));
		
		width += this.options.stopMargin;
		height += this.options.stopMargin;
		const box = {
			x: x - width / 2,
			y: y - height / 2,
			width, height
		};
		editSVGElement(stop.el, {
			...box,
		})
		editSVGElement(stop.label, {
			x: x + width / 2 + this.options.labelXOffset, y
		})
	}
	
	#createLineSegment(lineSection, point0, point1) {
		const services = lineSection.services;
		const index = lineSection.lineSegments.length;
		const els = [];
		for (let service of services) {
			const el = addSVGElement(this.lineLayer, "line", {
				stroke: service.colour, "stroke-width": this.options.lineWidth,
				"class": "service graphic"
			})
			
			els.push(el);
			this.lineParts.push(el);
			
			el.dataset.type = "line";
			el.dataset.serviceId = service.id;
			el.dataset.lineSectionId = lineSection.id;
			el.dataset.segmentNumber = index;
		}
		const lineSegment = {els, point0, point1};
		lineSection.lineSegments.push(lineSegment);
	}
	
	#createLineSegments(lineSection) { // also refreshes for re-routing
	
		for (let {els} of lineSection.lineSegments) {
			for (let el of els) {
				el.remove();
			}
		}
		
		lineSection.lineSegments = [];
		const {ends: [stop0, stop1], routingPoints} = lineSection;
		const points = [stop0, ...routingPoints, stop1];
		for (let i = 0; i < points.length - 1; ++i) {
			this.#createLineSegment(lineSection, points[i], points[i+1]);
		}
	}
	
	#drawLineSegment(lineSegment) {
		const {els, point0, point1} = lineSegment;
		const {x: x0, y: y0} = this.#coordTransform(point0.x, point0.y);
		const {x: x1, y: y1} = this.#coordTransform(point1.x, point1.y);
		
		const [dx, dy] = calcPerpendicularTranslation(x0, y0, x1, y1);
		const bottomOffset = Math.floor(els.length / 2);
		
		for (let i = 0; i < els.length; ++i) {
			const perpOffset = (i - bottomOffset)*this.options.lineWidth;
			const offsetX = perpOffset*dx;
			const offsetY = perpOffset*dy;
			
			const pts = {
				x1: x0 + offsetX, x2: x1 + offsetX,
				y1: y0 + offsetY, y2: y1 + offsetY
			}
			
			editSVGElement(els[i], pts)			
		}
		
		const spanX = els.length * Math.abs(dx) * this.options.lineWidth;
		const spanY = els.length * Math.abs(dy) * this.options.lineWidth;
		
		for (let point of [point0, point1]) {
			if (!point.routing && spanX > point.width) {
				point.width = spanX;
			}
			if (!point.routing && spanY > point.height) {
				point.height = spanY;
			}
		}
	}

	drawLineSection(lineSection) {
		lineSection = this.#getLineSection(lineSection);
		for (let seg of lineSection.lineSegments) {
			this.#drawLineSegment(seg);
		}
		for (let routingPoint of lineSection.routingPoints) {
			this.drawRoutingPointOnly(routingPoint);
		}
	}
		
	reIndexSegments(lineSection) {
		for (let [newIndex, point] of Object.entries(lineSection.routingPoints)) {
			point.index = parseInt(newIndex);
			point.el.dataset.index = newIndex;
		}
		for (let [newIndex, segment] of Object.entries(lineSection.lineSegments)) {
			for (let el of segment.els) {
				el.dataset.segmentNumber = newIndex;
			}
		}
	}
	
	createRoutingPoint(lineSection, index, x, y, type) {
		lineSection = this.#getLineSection(lineSection);

		const routingPoint = new RoutingPoint({
			x, y, type, lineSection, index: parseInt(index),
		});
		
		const el = addSVGElement(this.stopLayer, "use", {href: "#" + this.options.routingPointElementId, "class": "routing-point graphic"});
		const label = addSVGElement(this.labelLayer, "text", {"class": "routing-point label"});
		
		el.dataset.type = "routing-point";
		el.dataset.lineSectionId = lineSection.id;
		el.dataset.index = index;
		
		routingPoint.el = el;
		routingPoint.label = label;
		
		lineSection.routingPoints.splice(index, 0, routingPoint);
		this.reIndexSegments(lineSection);
		
		this.#createLineSegments(lineSection);
		return routingPoint;
	}
	
	getRoutingPointFromEl(el) {
		return this.mapSpec.lineSections[el.dataset.lineSectionId].routingPoints[el.dataset.index];
	}
	
	getStopFromEl(el) {
		return this.mapSpec.stops[el.dataset.stopId];
	}
	
	getLabelFromEl(el) {
		if (el.dataset.type == "stop") {
			return this.mapSpecs.stops[el.dataset.stopId].label;
		} else if (el.dataset.type == "line") {
			return this.mapSpecs.services[el.dataset.serviceId].label;
		}
	}
	
	removeRoutingPoint(routingPointOrLineSection, index) {
		if (index == undefined) {
			routingPoint = routingPointOrLineSection;
		} else {
			lineSection = this.#getLineSection(routingPointOrLineSection);
			routingPoint = lineSection.routingPoints[index];
		}
		lineSection.routingPoints.splice(index, 1);
		
		this.reIndexRoutingPoints(lineSection);
	}
	
	drawRoutingPointOnly(routingPoint) {
		const {x, y} = this.#coordTransform(routingPoint.x, routingPoint.y);
		editSVGElement(routingPoint.el, {x, y});
		editSVGElement(routingPoint.label, {x: x + this.options.routingPointWidth / 2 + this.options.labelXOffset, y});
	}

	drawRoutingPoint(routingPoint) {
		this.drawRoutingPointOnly(routingPoint);
		this.drawLineSection(routingPoint.lineSection);
	}
	
	* allRoutingPoints() {
		for (let lineSection of this.mapSpec.lineSections) {
			for (let routingPoint of lineSection.routingPoints) {
				yield routingPoint;
			}
		}
	}


	draw(points = null) {
		
		if (points == null) {
			points = this.mapSpec.stops;
		}
		
		const lineSectionsToDraw = new Set();
		
		for (let point of points) {
			if (!point.routing) {
				for (let lineSection of point.lineSections) {
					lineSectionsToDraw.add(lineSection);
				}
			} else {
				lineSectionsToDraw.add(point.lineSection);
			}
			for (let rp of point.getAutomaticNeighbours()) {
				rp.repositionToNeighbours();
			}
		}
		
		for (let lineSection of lineSectionsToDraw) {
			this.drawLineSection(lineSection);
		}
		
		for (let point of points) {
			if (!point.routing) {
				this.drawStop(point);
			}
		}
	}
}

export { TransitMapBackground, TransitMapDrawer, Stop, pointTypes }