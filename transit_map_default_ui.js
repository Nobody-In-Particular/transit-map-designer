import { dragging } from "./svg_utils/index.js";

function updateRoutingPointLabel(routingPoint) {
	routingPoint.label.textContent = ["Warping", "Fixed", "Automatic"][routingPoint.type] + " routing point";
}

class Handler {
	constructor(map) {
		this.map = map;
		this.shownRoutingPoints = [];
	}
	
	async onDragRoutingPoint(x, y, routingPoint, updateAsDrag = false) {
		routingPoint.x = Math.round(x);
		routingPoint.y = Math.round(y);
		if (updateAsDrag) {
			this.map.drawer.correctRoutingPoint(routingPoint);
		}
		this.map.drawer.drawRoutingPoint(routingPoint);
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
	
	async handle(x, y, type, target) {
		const data = target.dataset;			
		switch (type) {
			case "click":
				if (!this.rerouting) {
					if (data.type == "line") {
						this.map.drawer.highlightService(data.serviceId, x, y);			
						this.persistentService = data.serviceId;
					} else if (this.persistentService) {
						this.map.drawer.showAllServicesAndHideLabels();
						this.persistentService = null;
					}
				}
				break;
			case "mouseover":
				if (!this.rerouting) {
					if (data.type == "line") {
						this.map.drawer.highlightService(data.serviceId, x, y);
					} else if (data.type == "stop") {
						this.map.drawer.showStopLabel(data.stopId);
					} else if (data.type == "routing-point") {
						const routingPoint = this.map.drawer.getRoutingPointFromEl(target);
						this.showRoutingPoint(routingPoint);
					}
				}
				break;
			case "mouseout":
				if (!this.rerouting) {
					if (data.type == "line" && data.serviceId != this.persistentService) {
						this.map.drawer.showAllServicesAndHideLabels();
					} else if (data.type == "stop" ) {
						this.map.drawer.hideStopLabel(data.stopId);
					}
				}
				break;
			case "pointerdown":
				event.preventDefault();
				if (data.type == "line") {
					await dragging(
						this.onDragRoutingPoint.bind(this),
						this.map.screenToMapCoords.bind(this.map),
						() => {
							this.map.drawer.showAllServicesAndHideLabels();
							this.rerouting = true;
							const routingPoint = this.map.drawer.createRoutingPoint(
								data.lineSectionId,
								data.segmentNumber,
								0, 0,
								this.map.drawer.WARPING
							)
							updateRoutingPointLabel(routingPoint);
							this.showRoutingPoint(routingPoint);
							const neighbours = this.map.drawer.getRoutingPointNeighbours(routingPoint);
							neighbours.map((p) => { if (p.routing) this.showRoutingPoint(p) });
							return routingPoint;
						}
					);
					this.rerouting = false;
				
				} else if (data.type == "routing-point") {
					this.rerouting = true;
					const routingPoint = this.map.drawer.getRoutingPointFromEl(target);
					this.showRoutingPoint(routingPoint);
					
					const neighbours = this.map.drawer.getRoutingPointNeighbours(routingPoint);
					neighbours.map((p) => { if (p.routing) this.showRoutingPoint(p) });
					const updateAsDrag = neighbours.filter((p) => p.type == this.map.drawer.AUTOMATIC).length > 0;
					
					const moved = await dragging(
						((x, y) => this.onDragRoutingPoint(x, y, routingPoint, updateAsDrag)).bind(this),
						this.map.screenToMapCoords.bind(this.map),
					)
					
					if (!moved) { // i.e. if it was just clicked, then change the type
						routingPoint.type = (routingPoint.type + 1) % 3;
						updateRoutingPointLabel(routingPoint);
					}
					
					this.map.drawer.correctRoutingPoint(routingPoint);
					this.map.drawer.drawRoutingPoint(routingPoint);
					
					// for some reason a pointermove event sometimes fires after it has snapped back
					this.waitOneLoopBeforeHidingRoutingPoint = true; 
					
					this.rerouting = false;
					
				} else {
					if (this.map.affectedArea && this.map.affectedArea.contains(x, y)) {
						this.map.removeMovableArea();
						await this.map.selectMovableArea(x, y)
					} else {
						this.map.removeAffectedArea();
						this.map.removeMovableArea();
						await this.map.selectAffectedArea(x, y);
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
}

export { Handler as default };