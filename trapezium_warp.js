import { addXY } from "./svg_utils/index.js";

class Frame {
	constructor(width, height, box) {
		this.x0 = box.x;
		this.y0 = box.y;
		this.w = box.width;
		this.h = box.height;
		this.x1 = this.x0 + this.w;
		this.y1 = this.y0 + this.h;
		this.W = width;
		this.H = height;
	}
	

	* iterTrapezia(pointsOnly=false) {
		if (pointsOnly) {
			for (let y = 0; y < this.y0; ++y) {
				for (let x = 0; x < this.W; ++x) {
					yield {x, y}
				}
			}
			for (let y = this.y0; y < this.y1; ++y) {
				for (let x = 0; x < this.x0; ++x) {
					yield {x, y}
				}
				for (let x = this.x1; x < this.W; ++x) {
					yield {x, y}
				}
			}
			for (let y = this.y1; y < this.H; ++y) {
				for (let x = 0; x < this.W; ++x) {
					yield {x, y};
				}
			}
		} else {
			for (let y = 0; y < this.y0; ++y) {
				let middleBegin = Math.ceil(y * this.x0 / this.y0);
				let middleEnd = Math.ceil(this.W - y * (this.W - this.x1) / this.y0);
				for (let x = 0; x < middleBegin; ++x) {
					yield {pt: {x, y}, orientation: 0, side: 0}
				}
				for (let x = middleBegin; x < middleEnd; ++x) {
					yield {pt: {x, y}, orientation: 1, side: 0}
				}
				for (let x = middleEnd; x < this.W; ++x) {
					yield {pt: {x, y}, orientation: 0, side: 1}
				}
			}
			for (let y = this.y0;y < this.y1;++y) {
				for (let x = 0; x < this.x0; ++x) {
					yield {pt: {x, y}, orientation: 0, side: 0}
				}
				for (let x = this.x1; x < this.W; ++x) {
					yield {pt: {x, y}, orientation: 0, side: 1}
				}
			}
			for (let y = this.y1; y < this.H; ++y) {
				let middleBegin = Math.ceil((this.H - y) * this.x0 / (this.H - this.y1));
				let middleEnd = Math.ceil(this.W - (this.H - y) * (this.W - this.x1) / (this.H - this.y1));
				
				for (let x = 0; x < middleBegin; ++x) {
					yield {pt: {x, y}, orientation: 0, side: 0}
				}
				for (let x = middleBegin; x < middleEnd; ++x) {
					yield {pt: {x, y}, orientation: 1, side: 1}
				}
				for (let x = middleEnd; x < this.W; ++x) {
					yield {pt: {x, y}, orientation: 0, side: 1}
				}
			}
		}
	}
	
	* iterCentral() {
		for (let y = this.y0; y < this.y1; ++y) {
			for (let x = this.x0; x < this.x1; ++x) {
				yield {pt: {x, y}, central: true}
			}
		}
	}
	
	* iterSections() {
		for (let obj of this.iterTrapezia()) {
			yield obj;
		}
		for (let obj of this.iterCentral()) {
			yield obj;
		}
	}
	
	drawFrameAsPixels(ctx, x, y) {
		let imgData = ctx.createImageData(this.W, this.H);
		let centralColour = [255, 255, 0, 255];
		let trapeziumColours = [
			[
				[255, 0, 0, 255],
				[0, 255, 0, 255],
			],[
				[0, 0, 255, 255],
				[255, 0, 255, 255]
			]
		]
		
		for (let {pt, central, orientation, side} of this.iterSections()) {
			let pos = (pt.y*this.W + pt.x)*4;
			let colour = central ? centralColour : trapeziumColours[orientation][side];
			imgData.data.set(colour, pos);
		}
		ctx.putImageData(imgData, x, y);
	}
}


class FloatPair2DArray {
	constructor(width, height) {
		this.width = width;
		this.height = height;
		this.data = new Float32Array(width*height*2);
	}

	atFlat(pos) {
		return [this.data[pos], this.data[pos+1]];
	}
	at({x, y}) {
		let pos = (y*this.width + x)*2;
		return this.atFlat(pos);
	}
	
	set({x, y}, [a, b]) {
		let pos = (y*this.width + x)*2;
		this.data[pos] = a;
		this.data[pos+1] = b;
	}
}

class WarpData extends FloatPair2DArray {
	at(pt) {
		let [a, b] = super.at(pt);
		if (Number.isNaN(a) && Number.isNaN(b)) {
			return {
				central: true
			}
		} else {
			return {
				k0: Math.abs(a),
				k1: Math.abs(b),
				orientation: Number(a < 0 || Object.is(a, -0)),
				side: Number(b < 0 || Object.is(b, -0))
			}
		}
	}
	set(pt, {k0, k1, orientation, side}) {
		if (k0 < 0 || k1 < 0) {
			throw "invariants must be positive";
		}
		if (orientation) { k0 = -k0; }
		if (side) { k1 = -k1; }
		super.set(pt, [k0, k1]);
	}
	setAsCentral(pt) {
		super.set(pt, [NaN, NaN]);
	}
}

// k1 is the constant for the flat-to-flat direction (y for top and bottom)
// k0 is the constant for the diagonal-to-diagonal direction (x for top and bottom)
// orientation is 0 for left and right, 1 for top and bottom
// side is 0 for left and top, 1 for right and bottom
class WarpingCoordinateMap {
	constructor(width, height, fromBox) {
		this.width = width;
		this.height = height;
		
		this.fromFrame = new Frame(this.width, this.height, fromBox);
		this.warpData = new WarpData(this.width, this.height);

		for (let {central, pt, orientation, side} of this.fromFrame.iterSections()) {
			var k0, k1;
			if (central) {
				this.warpData.setAsCentral(pt);
			} else {
				if (orientation) {
					if (side) {
						k1 = (this.height - pt.y) / (this.height - this.fromFrame.y1);
					} else {
						k1 = pt.y / this.fromFrame.y0;
					}
					k0 = (pt.x - k1*this.fromFrame.x0) / (k1*this.fromFrame.w + (1-k1)*this.width)
				} else {
					if (side) {
						k1 = (this.width - pt.x) / (this.width - this.fromFrame.x1);
					} else {
						k1 = pt.x / this.fromFrame.x0;
					}
					k0 = (pt.y - k1*this.fromFrame.y0) / (k1*this.fromFrame.h + (1-k1)*this.height)
				}
				if (k0 < 0 && k0 > -Number.EPSILON) {
					k0 = 0;
				}
				if (k1 < 0 && k1 > -Number.EPSILON) {
					k1 = 0;
				}
				this.warpData.set(pt, {k0, k1, orientation, side});
			}
		}
	}
	
	warpPoint({x, y}, toBox) {	
		if (x == this.width || y == this.height) {
			return {newX: x, newY: y};
		}
		
		let {central, k0, k1, orientation, side} = this.warpData.at({x, y});
		var newX, newY;
		if (central) {
			newX = (x - this.fromFrame.x0) * toBox.width / this.fromFrame.w + toBox.x;
			newY = (y - this.fromFrame.y0) * toBox.height / this.fromFrame.h + toBox.y;
		} else if (orientation) {
			if (side) {				
				newY = this.height - k1*(this.height - toBox.height - toBox.y);
			} else {
				newY = k1*toBox.y;
				
			}
			newX = k1*toBox.x + k0*(k1*toBox.width + (1-k1)*this.width)
		} else {
			if (side) {
				newX = this.width - k1*(this.width - toBox.width - toBox.x);
			} else {
				newX = k1*toBox.x;
			}
			newY = k1*toBox.y + k0*(k1*toBox.height + (1-k1)*this.height);
		}
		return {newX, newY};
	}

	warpPixel({x, y}, toBox) {
		var {newX: x0, newY: y0} = this.warpPoint({x, y}, toBox);
		var {newX: x1, newY: y1} = this.warpPoint({x: x + 1, y: y + 1}, toBox);
		x0 = Math.min(x0, x1);
		y0 = Math.min(y0, y1);
		x1 = Math.max(x0, x1);
		y1 = Math.max(y0, y1);
		
		x0 = Math.floor(x0);
		y0 = Math.floor(y0);
		x1 = Math.ceil(x1);
		y1 = Math.ceil(y1);
		if (x1 == x0) {
			x1++;
		}
		if (y1 == y0) {
			y1++;
		}
		x1 = Math.min(this.width, x1);
		y1 = Math.min(this.height, y1);
		
		const pixels = [];
		for (let xi = x0; xi < x1 ; ++xi) {
			for (let yi = y0; yi < y1; ++yi) {
				pixels.push({x: xi, y: yi});
			}
		}
		return pixels;
	}
	
	warpImageOnCanvas(origImageData, newImageData, centralImage, ctx, toBox, ox, oy) {
		for (let {x, y} of this.fromFrame.iterTrapezia(true)) {
			let pos = ((y*this.width) + x)*4
			let colour = origImageData.data.slice(pos, pos + 4);
			for (let {x: xi, y: yi} of this.warpPixel({x, y}, toBox)) {
				newImageData.data.set(colour, (yi*this.width + xi)*4);
			}
		}
		
		ctx.putImageData(newImageData, ox, oy);
		ctx.clearRect(
			toBox.x + ox, toBox.y + oy,
			toBox.width, toBox.height
		);
		
		ctx.drawImage(
			centralImage,
			toBox.x + ox, toBox.y + oy,
			toBox.width, toBox.height
		);
	}
}

class Warper {
	constructor(outerBox, fromBox, ctx, changeCanvasBbox = null, canvasOrigin = {x: 0, y: 0}) {
		
		this.staticOx = outerBox.x;
		this.staticOy = outerBox.y;
		
		console.log(outerBox, fromBox);
		this.origin = {x: canvasOrigin.x, y: canvasOrigin.y};
		outerBox = addXY(outerBox, this.origin);
		fromBox = addXY(fromBox, this.origin);
		console.log(outerBox, fromBox);
		
		this.origImageData = ctx.getImageData(outerBox.x, outerBox.y, outerBox.width, outerBox.height);
		createImageBitmap(ctx.canvas, fromBox.x, fromBox.y, fromBox.width, fromBox.height).then(
			((bitmap) => this.centralImage = bitmap).bind(this)
		)
				
		this.initOx = outerBox.x;
		this.initOy = outerBox.y;
		this.width = outerBox.width;
		this.height = outerBox.height;

		if (changeCanvasBbox) {
			const deltaBbox = {
				dx: Math.min(0, this.initOx),
				dy: Math.min(0, this.initOy),
				width: Math.max(this.initOx + this.width, ctx.canvas.width),
				height: Math.max(this.initOy + this.height, ctx.canvas.height)
			};
			this.drawOx = Math.max(0, this.initOx);
			this.drawOy = Math.max(0, this.initOy);

			changeCanvasBbox(deltaBbox);
			
		} else {
			this.drawOx = this.initOx;
			this.drawOy = this.initOy;
		}
		
				
		this.coordinateMap = new WarpingCoordinateMap(
			this.width, this.height, this.correctBox(fromBox)
		);
		
		this.newImageData = ctx.createImageData(this.origImageData);
		this.ctx = ctx;
	}
	
	correctBox(box) {
		const {x, y, width, height} = box;
		return {
			x: x - this.initOx,
			y: y - this.initOy,
			width, height
		}
	}
	
	setDestBox(destBox) {
		this.destBox = this.correctBox(destBox);
	}
	
	warpPoint({x, y}) {
		const {newX, newY} = this.coordinateMap.warpPoint(
			{x: x - this.initOx, y: y - this.initOy},
			this.destBox
		);
		return {newX: newX + this.initOx, newY: newY + this.initOx};
	}
	warpOnCanvas() {
		this.coordinateMap.warpImageOnCanvas(
			this.origImageData,
			this.newImageData,
			this.centralImage,
			this.ctx,
			addXY(this.destBox, this.origin),
			this.drawOx,
			this.drawOy
		)
	}
}

export { Warper };