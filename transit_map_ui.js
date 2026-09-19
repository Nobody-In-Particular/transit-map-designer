import { addSVGElement, editSVGElement, HTML_URL, calcPerpendicularTranslation, getSVGCoords, transformCoords, dragging } from './svg_utils/index.js';
import { Rectangle } from "./rectangle/index.js"
import { TrapeziumWarper } from "./trapezium_warp.js"
import { PanZoomListener } from "./panzoom_listener.js";

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
	
	changeBbox(deltaBbox) {
		const tempImageData = this.ctx.getImageData(0, 0, this.bbox.width, this.bbox.height);
		
		const newBbox = {
			x: this.bbox.x + deltaBbox.dx,
			y: this.bbox.y + deltaBbox.dy,
			width: deltaBbox.width,
			height: deltaBbox.height
		};
		editSVGElement(this.canvasWrapper, newBbox);
		this.canvas.width = newBbox.width;
		this.canvas.height = newBbox.height;
		this.origin.x -= deltaBbox.dx;
		this.origin.y -= deltaBbox.dy;
		this.ctx.putImageData(tempImageData, -deltaBbox.dx, -deltaBbox.dy);
		
		this.bbox = newBbox;
		return {...this.origin};
	}
	
	panzoom(matrix) {
		const {a, b, c, d, e, f} = matrix;
		this.canvasWrapper.setAttribute("transform", `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);
	}
}



class TransitMapDrawer {
	constructor(
		map, containerElement,
		{lineWidth = 3, stopMargin = 2, stopRadius = 2, stopOutlineWidth = 1, labelFont = "Arial", labelSize = "12",
		minStopWidth = 4, minStopHeight = 4}
	){
		this.map = map;
		this.containerElement = containerElement;
		this.lineLayer = addSVGElement(this.containerElement, "g");
		this.stopLayer = addSVGElement(this.containerElement, "g");
		
		this.options = {lineWidth, stopMargin, stopRadius, stopOutlineWidth, labelFont, labelSize, minStopWidth, minStopHeight};
		
		this.lineParts = [];
		
		for (let lineSection of this.map.lineSections) {
			this.#createLineSection(lineSection);
		}
		
		for (let stop of this.map.stops) {
			this.createStop(stop);
		}
		

		
		this.addServiceLabels();
		
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
	
	
	addServiceLabels() {		
		addSVGElement(this.map.svgElement, "style").textContent = `
			.-label {
				font-family: ${this.options.labelFont};
				font-size: ${this.options.labelSize}px;
			}
		`
		
		for (let service of this.map.services) {
			const label = addSVGElement(this.containerElement, "text", {visibility: "hidden", "class": "-label"});
			label.textContent = service.name;
			service.label = label;
		}
	}
	
	#getStop(stop) {
		return getOrReturnObj(stop, this.map.stops);
	}
	
	#getService(service) {
		return getOrReturnObj(service, this.map.services);
	}
	
	#getLineSection(lineSection) {
		return getOrReturnObj(lineSection, this.map.lineSections);
	}
	
	
	showStopLabel(stop) {
		stop = this.#getStop(stop);
		const {x, y} = this.#coordTransform(stop.x + stop.width / 2 + 4, stop.y);
		editSVGElement(stop.label, {
			x, y,
			visibility: "visible"
		})
	}
	
	
	
	
	hideStopLabel(stop) {
		stop = this.#getStop(stop);
		editSVGElement(stop.label, {
			visibility: "hidden"
		})
	}
	
	
	
	
	highlightService(service, x, y) {
		({x, y} = this.#coordTransform(x, y));
		service = this.#getService(service);
		editSVGElement(service.label, {
			x: x + 4,
			y: y,
			visibility: "visible"
		});		
		
		for (let part of this.lineParts) {
			if (part.dataset.serviceId != service.id) {
				editSVGElement(part, {visibility: "hidden"})
			}
		}
		
		const thisStopNames = new Set(service.stops.map((s) => s.id));
		for (let stop of this.map.stops) {
			if (!thisStopNames.has(stop.id)) {
				editSVGElement(stop.el, {visibility: "hidden"});
			}
		}
	}

	showAllServices() {
		for (let part of this.lineParts) {
			editSVGElement(part, {visibility: "visible"})
		}
		for (let stop of this.map.stops) {
			editSVGElement(stop.el, {visibility: "visible"});
		}
		for (let service of this.map.services) {
			editSVGElement(service.label, {visibility: "hidden"});
		}
	}


	createStop(stop) {
		stop.width = this.options.minStopWidth;
		stop.height = this.options.minStopHeight;
		stop.el = addSVGElement(this.containerElement, "rect", {
			fill: "white", stroke: "black"
		});
		stop.el.dataset.stopId = stop.id;
		stop.el.dataset.type = "stop";
		stop.label = addSVGElement(
			this.stopLayer, "text",
			{visibility: "hidden", "class": "-label"}
		);
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
			"stroke-width": this.options.stopOutlineWidth,
			rx: this.options.stopRadius, ry: this.options.stopRadius
		})
	}
	
	#createLineSegment(lineSection, point0, point1) {
		const services = lineSection.services;
		const index = lineSection.lineSegments.length;
		const els = [];
		for (let service of services) {
			const el = addSVGElement(this.lineLayer, "line", {
				stroke: service.colour, "stroke-width": this.options.lineWidth
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
	
	#createLineSection(lineSection) { // also refreshes for re-routing
	
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
	}
		
	
	createRoutingPoint(lineSection, index, x, y) {
		const routingPoint = {x, y, routing: true, lineSection};
		lineSection = this.#getLineSection(lineSection);
		lineSection.routingPoints.splice(index, 0, routingPoint);
		this.#createLineSection(lineSection);
		return routingPoint;
	}
	
	removeRoutingPoint(lineSection, index) {
		lineSection = this.#getLineSection(lineSection);
		lineSection.routingPoints.splice(index, 1);
	}
		
	draw(points = null) {
		if (points == null) {
			points = this.map.stops;
		}
		const lineSectionsToDraw = new Set();
		
		for (let point of points) {
			if (point.routing) {
				lineSectionsToDraw.add(point.lineSection);
			} else {
				for (let lineSection of point.lineSections) {
					lineSectionsToDraw.add(lineSection);
				}
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




class TransitMapBase {
	
	constructor(drawer, background, svgElement, stops, lineSections) {
		Object.assign(this, { drawer, background, svgElement, stops, lineSections });

		for (let eventType of ["pointerdown", "mouseover", "mouseout", "click", "dblclick"]) {
			this.svgElement.addEventListener(eventType, this.eventHandler.bind(this))
		}
		
		this.affectedArea = null;
		this.movableArea = null;
		
		addSVGElement(this.drawer.containerElement, "circle", {
			id: "resizer",
			r: 6,
			fill: "black"
		})
		
		this.pz = new PanZoomListener(this.svgElement, this.panzoom.bind(this));
	}
	
	panzoom(matrix) {
		this.background.panzoom(matrix);
		this.drawer.panzoom(matrix);
		if (this.affectedArea) {
			this.affectedArea.coordTransformMatrix = matrix;
			this.affectedArea.draw();
		}
		if (this.movableArea) {
			this.movableArea.coordTransformMatrix = matrix;
			this.movableArea.draw();
		}
		
		this.drawer.draw();
	}
	
	screenToMapCoords(x, y) {
		const {x: svgX, y: svgY} = getSVGCoords(x, y, this.drawer.containerElement);
		return transformCoords(svgX, svgY, this.pz.matrix.inverse());
	}
	
	
	
	// SELECTION
	
	async eventHandler(event) {
		let {x, y} = this.screenToMapCoords(event.x, event.y);
		
		if (event.type == "pointerdown" && event.target.dataset.type != "line") {
			if (this.affectedArea && this.affectedArea.contains(x, y)) {
				this.removeMovableArea();
				await this.selectMovableArea(x, y)
			} else {
				this.removeAffectedArea();
				this.removeMovableArea();
				await this.selectAffectedArea(x, y);
			}
		} else { // it is a delegated event, hopefully
			const data = event.target.dataset;			
			switch (event.type) {
				case "click":
					if (!this.makingRoutingPoint) {
						if (data.type == "line") {
							this.persistentService = data.serviceId;
							this.drawer.highlightService(data.serviceId, x, y);
						} else {
							if (this.persistentService) {
								this.drawer.showAllServices();
								this.persistentService = null;
							}
						}
					}
				case "mouseover":
					if (data.type == "stop") {
						this.drawer.showStopLabel(data.stopId);
					} else if (data.type == "line" && !this.makingRoutingPoint) {
						this.drawer.highlightService(data.serviceId, x, y);
					}
					break;
				case "mouseout":
					if (data.type == "stop") {
						this.drawer.hideStopLabel(data.stopId);
					} else if (data.type == "line") {
						if (data.serviceId != this.persistentService) {
							this.drawer.showAllServices();
						}
					}
					break;
				case "pointerdown":
					event.preventDefault();
					if (data.type == "line") {
						await dragging(
							(x, y, routingPoint) => {
								routingPoint.x = Math.round(x);
								routingPoint.y = Math.round(y);
								this.drawer.drawLineSection(data.lineSectionId);
							},
							this.screenToMapCoords.bind(this),
							() => {
								this.drawer.showAllServices();
								this.makingRoutingPoint = true;
								return this.drawer.createRoutingPoint(
									data.lineSectionId,
									data.segmentNumber,
									0, 0
								)
							}
						);
						this.makingRoutingPoint = false;
					}
					break;
			}
		}
	}
	
	async selectAffectedArea(x, y) {
		this.affectedArea = await Rectangle.selectArea(
			this.drawer.containerElement,
			x, y,
			{fill: "none", stroke: "black", "stroke-width": 2, "stroke-dasharray": 4},
			{coordTransformMatrix: this.pz.matrix}
		);
	}
	
	async selectMovableArea(x, y) {
		this.movableArea = await Rectangle.selectArea(
			this.drawer.containerElement,
			x, y,
			{fill: "none", stroke: "black", "stroke-width": 2},
			{...this.affectedArea.asBounds(), coordTransformMatrix: this.pz.matrix}
		)
		if (this.movableArea) {
			this.movableArea.resetFlip();
			this.movableArea.flippable = false;
			this.movableArea.allowResizeAndDrag(this.onMove.bind(this), "resizer");
			this.initWarp();
		}
	
	}
	
	removeAffectedArea() {
		if (this.affectedArea) {
			this.affectedArea.remove();
			this.affectedArea = null;
		}
	}
	
	removeMovableArea() {
		if (this.movableArea) {
			this.movableArea.remove();
			this.movableArea = null;
		}
	}
	
	
	
	
	// GETTING SELECTED DATA FOR WARPING
	
	#collectPointsInAffectedArea() {
		this.affectedPoints = [];
		for (let point of this.stops) {
			if (this.affectedArea.contains(point.x, point.y)) {
				// NEEDS to put them here as we need the ORIGINAL x and y
				this.affectedPoints.push({origX: point.x, origY: point.y, point});
			}
		}
		for (let lineSection of this.lineSections) {
			for (let point of lineSection.routingPoints) {
				if (this.affectedArea.contains(point.x, point.y)) {
					this.affectedPoints.push({origX: point.x, origY: point.y, point});
				}
			}
		}
	}
	
	
	
	// WARPING - happens in NON-PANZOOMED SPACE
	
	async initWarp() {
		this.#collectPointsInAffectedArea();

		this.warper = new TrapeziumWarper(
			this.affectedArea.bbox,
			this.movableArea.bbox,
			this.background.ctx,
			this.background.changeBbox.bind(this.background),
			this.background.origin
		)
	}
	
	onMove() {
		this.warper.setDestBox(this.movableArea.bbox);
		this.warper.warpOnCanvas();
		
		for (let {origX, origY, point} of this.affectedPoints) {
			const {newX, newY} = this.warper.warpPoint({x: origX, y: origY});
			point.x = Math.round(newX);
			point.y = Math.round(newY);
		}
		
		this.drawer.draw(this.affectedPoints.map((s) => s.point));
	}
}

export { TransitMapBackground, TransitMapDrawer, TransitMapBase }