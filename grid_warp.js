import "./warp_wasm.js";

const WarpWASM = Module;

class GridWarper {
	constructor(bbox, affectedPoints, ctx, setCanvasBbox, canvasOrigin = {x: 0, y: 0}) {
		
		this.ctx = ctx;
		this.setCanvasBbox = setCanvasBbox;
		this.canvasOrigin = canvasOrigin;
		
		this.affectedPoints = affectedPoints;
		
		this.affectedPointsVector = WarpWASM.get_blank_vector(this.affectedPoints.length);
		window.apv = this.affectedPointsVector;
		
		for (let pt of this.affectedPoints) {
			WarpWASM.append_point(this.affectedPointsVector, pt.x, pt.y); // emscripten doesn't give you emplace_back with register_vector
		}
		
		this.cwarper = new WarpWASM.GridWarper(
			this.affectedPointsVector,
			bbox.x, bbox.y, bbox.width, bbox.height,
			-canvasOrigin.x, -canvasOrigin.y,
			ctx.canvas.width, ctx.canvas.height
		);
	}
	
	* imageDimensions() {
		const grid = this.cwarper.get_dimensions();
		const imageDimensionsX = [
			[grid.x0, grid.x1 - grid.x0], // x, width
			[grid.x1, grid.x2 - grid.x1],
			[grid.x2, grid.x3 - grid.x2]
		];
		const imageDimensionsY = [
			[grid.y0, grid.y1 - grid.y0], // y, height
			[grid.y1, grid.y2 - grid.y1],
			[grid.y2, grid.y3 - grid.y2]
		];
		for (let ix = 0;ix < 3;++ix) {
			for (let iy = 0;iy < 3;++iy) {
				
				yield {
					ix, iy,
					x: imageDimensionsX[ix][0] + this.canvasOrigin.x,
					y: imageDimensionsY[iy][0] + this.canvasOrigin.y,
					width: imageDimensionsX[ix][1],
					height: imageDimensionsY[iy][1]
				}
				
			}
		}
	}
	
	async init() {
		const [imageDimensionsX, imageDimensionsY] = this.imageDimensions();
		
		this.images = []; // 9 images
		
		for (let {ix, iy, x, y, width, height} of this.imageDimensions()) {
			this.images[ix*3 + iy] = await createImageBitmap(
				this.ctx.canvas,
				x, y, width, height
			)
		}
	}
	
	warp(bbox, growUpX, growUpY) {
		
		const success = this.cwarper.warp(
			bbox.x, bbox.y, bbox.width, bbox.height,
			growUpX, growUpY
		)
		
		if (!success) {
			return;
		}
		
		const iterator = Iterator.zip([this.affectedPoints, this.affectedPointsVector], {mode: "strict"});
		for (let [jsPoint, cPoint] of iterator) {
			jsPoint.x = cPoint.x
			jsPoint.y = cPoint.y
		}
		
		const grid = this.cwarper.get_dimensions();
		this.setCanvasBbox({
			x: grid.x0, y: grid.y0,
			width: grid.x3 - grid.x0,
			height: grid.y3 - grid.y0
		}, {redraw: false});
		this.canvasOrigin = {x: -grid.x0, y: -grid.y0};
		
		for (let {ix, iy, x, y, width, height} of this.imageDimensions()) {
			this.ctx.drawImage(
				this.images[ix*3 + iy],
				x, y, width, height
			)
		}
	}
}

export { GridWarper as default };