import { transformCoords, getSVGCoords } from "./svg_utils/index.js"

class PanZoomListener {
	constructor(fixedElement, panzoom,
		{
			zoomSensitivity = 0.02,
			panSensitivity = 0.8,
			minScale = 0.001,
			maxScale = Infinity,
		} = {}
	) {
		Object.assign(this, {zoomSensitivity, panSensitivity, minScale, maxScale});
		this.panzoom = panzoom;
		this.fixedElement = fixedElement;
		this.matrix = new DOMMatrix();
		this.currentZoom = 1;
				
		fixedElement.addEventListener("wheel", this.onWheel.bind(this), {passive: false});
	}
	
	// scale first
	onWheel(event) {
		event.preventDefault();
		const oldZoom = this.currentZoom;
		
		if (event.ctrlKey) {
			let newZoom = this.currentZoom - event.deltaY * this.zoomSensitivity * this.currentZoom;
			
			if (newZoom < this.minScale) {
				newZoom = this.minScale;
			} else if (newZoom > this.maxScale) {
				newZoom = this.maxScale;
			}
			
			const {x, y} = getSVGCoords(event.x, event.y, this.fixedElement);						
			const {x: ox, y: oy} = transformCoords(x, y, this.matrix.inverse());

			this.matrix.scaleSelf(newZoom / this.currentZoom, newZoom / this.currentZoom, 1, ox, oy);
			this.currentZoom = newZoom;
			
		} else {
			const dPanX = - event.deltaX * this.panSensitivity;
			const dPanY = - event.deltaY * this.panSensitivity;
			
			this.matrix.translateSelf(dPanX, dPanY);
		}
		
		this.panzoom(this.matrix);
	}
}

 export { PanZoomListener }