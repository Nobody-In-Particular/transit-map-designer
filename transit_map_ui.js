import { addSVGElement, editSVGElement, HTML_URL, calcPerpendicularTranslation, getSVGCoords, transformCoords } from './svg_utils/index.js';
import { Rectangle } from "./rectangle/index.js"
import { TrapeziumWarper } from "./trapezium_warp.js"
import { PanZoomListener } from "./panzoom_listener.js";

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
	constructor(map, containerElement, options) {
		this.map = map;
		this.containerElement = containerElement;
		this.options = options;
		
		for (let lineSection of this.map.lineSections) {
			this.createLineSegments(lineSection);
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
			label.textContent = service.id;
			service.label = label;
		}
	}
	
	
	
	
	showStopLabel(stop) {
		editSVGElement(stop.label, {
			x: stop.x + stop.width / 2 + 4,
			y: stop.y,
			visibility: "visible"
		})
	}
	
	
	
	
	hideStopLabel(stop) {
		editSVGElement(stop.label, {
			visibility: "hidden"
		})
	}
	
	
	
	
	highlightService(service, x, y) {
		editSVGElement(service.label, {
			x: x + 4,
			y: y,
			visibility: "visible"
		})
		for (let otherService of this.map.services) {
			let {id, lineSegments} = otherService;
			if (otherService != service) {
				for (let seg of lineSegments) {
					editSVGElement(seg, {visibility: "hidden"})
				}
			}
		}
	}
	
	
	
	
	
	unhighlightService(service) {
		for (let {lineSegments} of this.map.services) {
			for (let seg of lineSegments) {
				editSVGElement(seg, {visibility: "visible"})
			}
		}
		editSVGElement(service.label, {visibility: "hidden"});
	}

	
	
	
	
	createStop(stop) {
		stop.width = 4;
		stop.height = 4;
		stop.el = addSVGElement(this.containerElement, "rect", {
			fill: "white", stroke: "black"
		});
		stop.label = addSVGElement(
			this.containerElement, "text",
			{visibility: "hidden", "class": "-label"}
		);
		stop.label.textContent = stop.name;
		stop.el.onmouseover = () => {this.showStopLabel(stop)}
		stop.el.onmouseout = () => {this.hideStopLabel(stop)}
	}
	
	
	drawStop(stop) {
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
	
	
	
	
	
	createLineSegments(lineSection) {
		lineSection.els = [];
		for (let service of lineSection.services) {
			const el = addSVGElement(this.containerElement, "line", {
				stroke: service.colour,
				"stroke-width": this.options.lineWidth,
			})
			
			service.lineSegments.push(el);
			
			el.onmouseover = (event) => {
				if (!service.persistHighlight) {
					const {x, y} = getSVGCoords(event.clientX, event.clientY, this.containerElement);
					this.highlightService(service, x, y);
				}
			}
			
			el.onclick = (event) => {
				service.persistHighlight = true;
				event.thisOne = true;
				document.addEventListener("click", (event) => {
					if (event.thisOne) { return };
					service.persistHighlight = false;
					this.unhighlightService(service);
				})
			}
			
			el.onmouseout = () => {
				if (!service.persistHighlight) {
					this.unhighlightService(service)
				}
			}
			
			lineSection.els.push(el);
		}
	}

	drawLineSection(lineSection) {
		const {ends: [stop0, stop1], services} = lineSection;
		let {x: x0, y: y0} = stop0;
		let {x: x1, y: y1} = stop1;
		({x: x0, y: y0} = this.#coordTransform(x0, y0));
		({x: x1, y: y1} = this.#coordTransform(x1, y1));
		
		const [dx, dy] = calcPerpendicularTranslation(x0, y0, x1, y1);
		const bottomOffset = Math.floor(services.length / 2);
		
		for (let i = 0; i < lineSection.els.length; ++i) {
			const perpOffset = (i - bottomOffset)*this.options.lineWidth;
			const offsetX = perpOffset*dx;
			const offsetY = perpOffset*dy;
			
			const pts = {
				x1: x0 + offsetX, x2: x1 + offsetX,
				y1: y0 + offsetY, y2: y1 + offsetY
			}

			editSVGElement(lineSection.els[i], pts);
		}

		const spanX = services.length * Math.abs(dx) * this.options.lineWidth;
		const spanY = services.length * Math.abs(dy) * this.options.lineWidth;
		
		for (let stop of [stop0, stop1]) {
			if (spanX > stop.width) {
				stop.width = spanX;
			}
			if (spanY > stop.height) {
				stop.height = spanY;
			}
		}
	}
	
		
	draw(stops = null) {
		if (stops == null) {
			stops = this.map.stops;
		}
		const lineSectionsToDraw = new Set();
		for (stop of stops) {
			for (let lineSection of stop.lineSections) {
				lineSectionsToDraw.add(lineSection);
			}
		}
		for (let lineSection of lineSectionsToDraw) {
			this.drawLineSection(lineSection);
		}
		for (let stop of stops) {
			this.drawStop(stop);
		}
	}
}




class TransitMapBase {
	
	constructor(drawer, background, svgElement, stops) {
		Object.assign(this, { drawer, background, svgElement, stops });

		this.svgElement.addEventListener("pointerdown", this.handleClick.bind(this));
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
	
	async handleClick(event) {
		let {x, y} = this.screenToMapCoords(event.x, event.y);

		if (this.affectedArea && this.affectedArea.contains(x, y)) {
			this.removeMovableArea();
			await this.selectMovableArea(x, y)
		} else {
			this.removeAffectedArea();
			this.removeMovableArea();
			await this.selectAffectedArea(x, y);
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
	
	#collectStopsInAffectedArea() {
		this.affectedStops = [];
		for (let stop of this.stops) {
			if (this.affectedArea.contains(stop.x, stop.y)) {
				// NEEDS to put them here as we need the ORIGINAL x and y
				this.affectedStops.push({origX: stop.x, origY: stop.y, stop});
			}
		}
	}
	
	
	
	// WARPING - happens in NON-PANZOOMED SPACE
	
	async initWarp() {
		this.#collectStopsInAffectedArea();

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
		
		for (let {origX, origY, stop} of this.affectedStops) {
			const {newX, newY} = this.warper.warpPoint({x: origX, y: origY});
			stop.x = Math.round(newX);
			stop.y = Math.round(newY);
		}
		
		this.drawer.draw(this.affectedStops.map((s) => s.stop));
	}
}

export { TransitMapBackground, TransitMapDrawer, TransitMapBase }