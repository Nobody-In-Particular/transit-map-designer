import { dragging } from "./svg_utils/index.js";
import { pointTypes } from "./transit_map_draw.js";
import Rectangle from "./rectangle/index.js";

function updateRoutingPointLabel(routingPoint) {
	routingPoint.label.textContent = `routing point #${routingPoint.index + 1} (${routingPoint.typeString})`;
}

const WarpModes = {
	GRID: 0,
	TRAPEZIUM : 1
}

class Handler {
	warpMode = WarpModes.GRID;
	
	constructor(map) {
		this.map = map;
		this.drawer = map.drawer;
		this.shownRoutingPoints = [];
	}
	
	onDragRoutingPoint(x, y, [routingPoint, updateAsDrag]) {
		routingPoint.x = x;
		routingPoint.y = y;
		if (updateAsDrag) {
			routingPoint.correctPositionOrNeighbours();
		}
		this.drawer.drawRoutingPoint(routingPoint);
	}
	
	initDragRoutingPoint(routingPoint) {
		this.rerouting = true;
		this.drawer.showAllServicesAndHideLabels();
		this.showRoutingPoint(routingPoint);
		
		const neighbours = routingPoint.neighbours;
		for (let p of neighbours) {
			if (p.routing) {
				this.showRoutingPoint(p);
			}
		}
		
		return false; // never update as drag
	}

	showRoutingPoint(routingPoint) {
		routingPoint.el.style.opacity = 1;
		routingPoint.label.style.visibility = "visible";
		this.shownRoutingPoints.push(routingPoint);
	}
	
	hideRoutingPoints() {
		for (let rp of this.shownRoutingPoints) {
			rp.el.style.opacity = 0;
			rp.label.style.visibility = "hidden";
		}
	}
	
	async selectAffectedRectangle(x, y) {
		this.affectedRectangle = await Rectangle.selectArea(
			this.drawer.containerElement,
			x, y,
			{fill: "none", stroke: "black", "stroke-width": 2, "stroke-dasharray": 4},
			{coordTransformMatrix: this.map.pz.matrix}
		);
	}
	
	async selectMovableRectangleAndBegin(x, y) {
		let bounds;
		if (this.warpMode) {
			bounds = this.affectedRectangle.asBounds();
		} else {
			bounds = {}
		}
		
		this.movableRectangle = await Rectangle.selectArea(
			this.drawer.containerElement,
			x, y,
			{fill: "none", stroke: "black", "stroke-width": 2},
			{...bounds, coordTransformMatrix: this.map.pz.matrix}
		);
		
		if (this.movableRectangle) {
			this.movableRectangle.resetFlip();
			this.movableRectangle.flippable = false;
			
			this.movableRectangle.allowResizeAndDrag(
				(() => this.map.onDrag(this.movableRectangle.bbox)).bind(this),
				"#resizer"
			);
			
			if (this.warpMode) {
				this.map.initTrapeziumWarp(
					this.affectedRectangle.bbox,
					this.movableRectangle.bbox
				)
			} else {
				await this.map.initGridWarp(
					this.movableRectangle.bbox
				)
			}
		}
	}
	
	removeAffectedRectangle() {
		if (this.affectedRectangle) {
			this.affectedRectangle.remove();
			this.affectedRectangle = null;
		}
	}
	
	removeMovableRectangle() {
		if (this.movableRectangle) {
			this.movableRectangle.remove();
			this.movableRectangle = null;
		}
	}
	
	async handle(x, y, type, target) {
		const data = target.dataset;			
		switch (type) {
			case "click":
				if (!this.rerouting) {
					if (data.type == "line") {
						this.drawer.highlightService(data.serviceId, x, y);			
						this.persistentService = data.serviceId;
					} else if (this.persistentService) {
						this.drawer.showAllServicesAndHideLabels();
						this.persistentService = null;
					}
				}
				break;
			case "mouseover":
				if (!this.rerouting) {
					if (data.type == "line") {
						this.drawer.highlightService(data.serviceId, x, y);
					} else if (data.type == "stop") {
						this.drawer.showStopLabel(data.stopId);
					} else if (data.type == "routing-point") {
						const routingPoint = this.drawer.getRoutingPointFromEl(target);
						this.showRoutingPoint(routingPoint);
					}
				}
				break;
			case "mouseout":
				if (!this.rerouting) {
					if (data.type == "line" && data.serviceId != this.persistentService) {
						this.drawer.showAllServicesAndHideLabels();
					} else if (data.type == "stop" ) {
						this.drawer.hideStopLabel(data.stopId);
					}
				}
				break;
				
				
			case "pointerdown":
				event.preventDefault();
				
				if (data.type == "stop") {
					const stop = this.drawer.getStopFromEl(target);
					let warping = false;
					
					if (this.warpMode == WarpModes.TRAPEZIUM) {
						if (this.affectedRectangle && this.affectedRectangle.contains(x, y)) {
							this.map.initTrapeziumWarp(
								this.affectedRectangle.bbox,
								{x: stop.x, y: stop.y, width: 0, height: 0}
							)
							warping = true;
							
							
						} else {
							this.removeAffectedRectangle();
							// bigger rectangle
						}
					} else {
						await this.map.initGridWarp(
							{x: stop.x, y: stop.y, width: 0, height: 0}
						);
						warping = true;
					}
					
					if (warping) {
						await dragging(
							((x, y) => this.map.onDrag({x, y, width: 0, height: 0})).bind(this),
							this.map.screenToMapCoords.bind(this.map)
						)
					}
				
				} else if (this.affectedRectangle && this.affectedRectangle.contains(x, y)) {
					this.removeMovableRectangle();
					this.selectMovableRectangleAndBegin(x, y);
		
				} else if (data.type == "line") {
					
					await dragging(
						this.onDragRoutingPoint.bind(this),
						this.map.screenToMapCoords.bind(this.map),
						() => {
							this.rerouting = true;
							const routingPoint = this.drawer.createRoutingPoint(
								data.lineSectionId,
								data.segmentNumber,
								0, 0,
								pointTypes.WARPING								
							)
							updateRoutingPointLabel(routingPoint);
							const updateAsDrag = this.initDragRoutingPoint(routingPoint);
							return [routingPoint, updateAsDrag];
						}
					);
					this.rerouting = false;
				
				} else if (data.type == "routing-point") {
					this.rerouting = true;
					const routingPoint = this.drawer.getRoutingPointFromEl(target);
					const updateAsDrag = this.initDragRoutingPoint(routingPoint);	
					
					const moved = await dragging(
						((x, y) => this.onDragRoutingPoint(x, y, [routingPoint, updateAsDrag])).bind(this),
						this.map.screenToMapCoords.bind(this.map),
					)
					
					if (!moved) { // i.e. if it was just clicked, then change the type
						routingPoint.type = (routingPoint.type + 1) % 3;
						updateRoutingPointLabel(routingPoint);
					}
					
					routingPoint.correctPositionOrNeighbours();
					this.drawer.drawRoutingPoint(routingPoint);
					
					// for some reason a pointermove event sometimes fires after it has snapped back
					this.waitOneLoopBeforeHidingRoutingPoint = true; 
					
					this.rerouting = false;

				} else {
					this.removeMovableRectangle();
					this.removeAffectedRectangle();
					if (this.warpMode) {
						this.selectAffectedRectangle(x, y);
					} else {
						this.selectMovableRectangleAndBegin(x, y);		
					}
				}
				
				break;
			
			case "pointermove":
				if (this.waitOneLoopBeforeHidingRoutingPoint) {
					this.waitOneLoopBeforeHidingRoutingPoint = false;
				} else if (!this.rerouting && data.type != "routing-point") {
					this.hideRoutingPoints();
				}
				break;
		}
	}
	panzoom(matrix) {
		if (this.affectedRectangle) {
			this.affectedRectangle.coordTransformMatrix = matrix;
			this.affectedRectangle.draw();
		}
		if (this.movableRectangle) {
			this.movableRectangle.coordTransformMatrix = matrix;
			this.movableRectangle.draw();
		}
	}
}

export { Handler as default };