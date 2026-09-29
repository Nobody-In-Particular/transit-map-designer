import { addSVGElement, randomColour, editSVGElement, getSVGCoords, transformCoords, bboxContains } from "./svg_utils/index.js";
import TrapeziumWarper from "./trapezium_warp.js";
import { TransitMapBackground, TransitMapDrawer, pointTypes } from "./transit_map_draw.js";
import TransitMapSpec from "./transit_map_spec.js";
import Handler from "./transit_map_default_ui.js";
import { PanZoomListener } from "./panzoom_listener.js";
import GridWarper from "./grid_warp.js";


/*
Section = line of all services between two stops.
Segment = line of all services between two routing points.
Part = one service line between two stops.
*/

function createTransitMap(element, image, stops, services, minLon, maxLon, minLat, maxLat, drawOptions = {}, eventHandlerClass = Handler) {
	const width = image.width;
	const height = image.height;
	
	element.setAttribute("width", width);
	element.setAttribute("height", height);
		
	const spec = TransitMapSpec.createFromObjects(stops, services, width, height, minLon, maxLon, minLat, maxLat);
	const containerElement = addSVGElement(element, "g", {x: 0, y: 0});
	const background = new TransitMapBackground(containerElement, image);
	const drawer = new TransitMapDrawer(spec, containerElement, drawOptions);
	drawer.draw();
	
	return new TransitMap(spec, drawer, background, element, eventHandlerClass);
	
}

class TransitMap {
	constructor(spec, drawer, background, svgElement, eventHandlerClass) {
		Object.assign(this, {
			drawer,
			background,
			svgElement,
			eventHandlerClass,
			stops: spec.stops,
			lineSections: spec.lineSections
		});
		
		this.handler = new eventHandlerClass(this);
		
		for (let eventType of ["pointerdown", "mouseover", "mouseout", "click", "dblclick", "pointermove", "pointerup"]) {
			this.svgElement.addEventListener(
				eventType, this.delegateEvent.bind(this)
			)
		}
		
		this.pz = new PanZoomListener(this.svgElement, this.panzoom.bind(this));
	}
	
	panzoom(matrix) {
		this.background.panzoom(matrix);
		this.drawer.panzoom(matrix);
		this.handler.panzoom(matrix);
		
		this.drawer.draw();
	}
	
	screenToMapCoords(x, y) {
		const {x: svgX, y: svgY} = getSVGCoords(x, y, this.drawer.containerElement);
		return transformCoords(svgX, svgY, this.pz.matrix.inverse());
	}
	
	
	
	// SELECTION
	
	async delegateEvent(event) {
		let {x, y} = this.screenToMapCoords(event.x, event.y);
		this.handler.handle(x, y, event.type, event.target);
	}
	
	// GETTING SELECTED DATA FOR WARPING
	
	* allWarpingPoints() {
		for (let stop of this.stops) {
			yield stop;
		}
		for (let point of this.drawer.allRoutingPoints()) {
			if (point.type == pointTypes.WARPING) {
				yield point;
			}
		}
	}
	
	#collectPointsInBbox(bbox) {
		this.affectedPoints = [];
		
		for (let point of this.allWarpingPoints()) {
			if (bboxContains(bbox, point.x, point.y)) {
				this.affectedPoints.push({origX: point.x, origY: point.y, point});
			}
		}
	}

	
	// WARPING - happens in NON-PANZOOMED SPACE
	
	initTrapeziumWarp(affectedBbox, movableBbox) {
		this.warpMode = "trapezium";
		this.#collectPointsInBbox(affectedBbox);

		this.warper = new TrapeziumWarper(
			affectedBbox,
			movableBbox,
			this.background.ctx,
			this.background.setBbox.bind(this.background),
			this.background.origin
		)
	}
	
	async initGridWarp(movableBbox) {
		this.warpMode = "grid";
		this.warper = new GridWarper(
			movableBbox,
			Array.from(this.allWarpingPoints()),
			this.background.ctx,
			this.background.setBbox.bind(this.background),
			this.background.origin
		)
		await this.warper.init();
	}
	
	onDrag(movableBbox, growUpX, growUpY) {
		switch (this.warpMode) {
			case "trapezium":
			
				this.warper.setDestBox(movableBbox);
				this.warper.warpOnCanvas();
				
				for (let {origX, origY, point} of this.affectedPoints) {
					const {newX, newY} = this.warper.warpPoint({x: origX, y: origY});
					point.x = Math.round(newX);
					point.y = Math.round(newY);
				}
				
				this.drawer.draw(this.affectedPoints.map((s) => s.point));
				
				return true;
				
			case "grid":
				const success = this.warper.warp(movableBbox, growUpX, growUpY);
				if (success) {
					this.drawer.draw();
				}
				return success;
		}
	}
}

export { createTransitMap, TransitMap };
