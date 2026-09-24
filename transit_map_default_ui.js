import { dragging } from "./svg_utils/index.js";

function updateRoutingPointLabel(routingPoint) {
	routingPoint.label.textContent = ["Warping", "Fixed", "Automatic"][routingPoint.type] + " routing point";
}


async function handler(x, y, type, target) {
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
					target.style.opacity = 1;
					routingPoint.label.style.opacity = 1;
				}
			}
			break;
		case "mouseout":
			if (!this.rerouting) {
				if (data.type == "line" && data.serviceId != this.persistentService) {
					this.drawer.showAllServicesAndHideLabels();
				} else if (data.type == "stop" ) {
					this.drawer.hideStopLabel(data.stopId);
				} else if (data.type == "routing-point") {
					const routingPoint = this.drawer.getRoutingPointFromEl(target);
					target.style.opacity = 0;
					routingPoint.label.style.opacity = 0;
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
						this.drawer.drawRoutingPoint(routingPoint);
					},
					this.screenToMapCoords.bind(this),
					() => {
						this.drawer.showAllServicesAndHideLabels();
						this.rerouting = true;
						const routingPoint = this.drawer.createRoutingPoint(
							data.lineSectionId,
							data.segmentNumber,
							0, 0,
							this.drawer.WARPING
						)
						updateRoutingPointLabel(routingPoint);
						routingPoint.el.style.opacity = 1;
						routingPoint.label.style.opacity = 1;
						return routingPoint;
					}
				);
				this.rerouting = false;
			
			} else if (data.type == "routing-point") {
				this.rerouting = true;
				const routingPoint = this.drawer.getRoutingPointFromEl(target);
				const moved = await dragging(
					(x, y) => {
						routingPoint.x = Math.round(x);
						routingPoint.y = Math.round(y);
						this.drawer.drawRoutingPoint(routingPoint)
					},
					this.screenToMapCoords.bind(this),
				)
				this.rerouting = false;
				if (!moved) { // i.e. if it was just clicked, then change the type
					routingPoint.type = (routingPoint.type + 1) % 3;
					updateRoutingPointLabel(routingPoint);
				}
			} else {
				if (this.affectedArea && this.affectedArea.contains(x, y)) {
					this.removeMovableArea();
					await this.selectMovableArea(x, y)
				} else {
					this.removeAffectedArea();
					this.removeMovableArea();
					await this.selectAffectedArea(x, y);
				}
			}
			break;
	}
}

export { handler as default };