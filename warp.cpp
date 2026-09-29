#include <vector>
#include <ranges>
#include <array>
#include <iostream>
#include <cmath>

#include <emscripten/bind.h>


struct Point {
	double x;
	double y;
};

struct Segment {
	int x;
	int y;
};

struct GridDimensions {
	double x0;
	double y0;
	double x1;
	double y1;
	double x2;
	double y2;
	double x3;
	double y3;
};


class GridWarper {
	private:
	
	std::vector<Point>& _affected_points;
	std::vector<Point> _original_points;
	std::vector<Segment> _segments;
	GridDimensions d;
	GridDimensions n;
	
	public:
	GridWarper(
		std::vector<Point>& affected_points,
		
		double init_x, double init_y,
		double init_w, double init_h,
		
		double ox, double oy,
		double ow, double oh
	)
		:
		_affected_points { affected_points },
		_original_points { affected_points },
		
		d {
			ox, oy,
			init_x, init_y,
			init_x + init_w, init_y + init_h,
			ox + ow, oy + oh
		}		
	{
		this->_segments.reserve(affected_points.size());
		
		int x_seg;
		int y_seg;
		for (const Point& pt : affected_points) {
			
			if (pt.x < this->d.x1) {
				x_seg = 0;
			} else if (pt.x < this->d.x2) {
				x_seg = 1;
			} else {
				x_seg = 2;
			}
			
			if (pt.y < this->d.y1) {
				y_seg = 0;
			} else if (pt.y < this->d.y2) {
				y_seg = 1;
			} else {
				y_seg = 2;
			}
			
			this->_segments.emplace_back(x_seg, y_seg);
		}
		
		// out of bounds and zero width corrections
		if (this->d.x1 <= this->d.x0) {
			this->d.x0 = this->d.x1 - 1;
		}
		if (this->d.x2 >= this->d.x3) {
			this->d.x3 = this->d.x2 + 1;
		}
		if (this->d.y1 <= this->d.y0) {
			this->d.y0 = this->d.y1 - 1;
		}
		if (this->d.y2 >= this->d.y3) {
			this->d.y3 = this->d.y2 + 1;
		}
		
		this->n = d;
		
	}
	
	bool warp(
		double x, double y, double w, double h,
		bool grow_up_x, bool grow_up_y // whether the growing direction is "up" (right/down) or not for x and y
	) {
		
		// can't go past the corner it shrinks to
		if (
			x <= this->n.x0 && grow_up_x ||
			x + w >= this->n.x3 && !grow_up_x ||
			y <= this->n.y0 && grow_up_y ||
			y + h >= this->n.y3 && !grow_up_y
		) {
			return false;
		}
			
		GridDimensions n {};

		n.x1 = x;
		n.y1 = y;
		n.x2 = x + w;
		n.y2 = y + h;
		
		if (grow_up_x) {
			n.x3 = n.x2 + (this->n.x3 - this->n.x2);
			n.x0 = this->n.x0;
		} else {
			n.x0 = n.x1 - (this->n.x1 - this->n.x0);
			n.x3 = this->n.x3;
		}
		
		if (grow_up_y) {
			n.y3 = n.y2 + (this->n.y3 - this->n.y2);
			n.y0 = this->n.y0;
		} else {
			n.y0 = n.y1 - (this->n.y1 - this->n.y0);
			n.y3 = this->d.y3;
		}
		
		std::array<double, 3> x_scales {
			(n.x1 - n.x0) / (this->d.x1 - this->d.x0),
			(n.x2 - n.x1) / (this->d.x2 - this->d.x1),
			(n.x3 - n.x2) / (this->d.x3 - this->d.x2)
		};
		
		if (this->d.x2 == this->d.x1) {
			x_scales[1] = 0;
		}
				
		std::array<double, 3> y_scales {
			(n.y1 - n.y0) / (this->d.y1 - this->d.y0),
			(n.y2 - n.y1) / (this->d.y2 - this->d.y1),
			(n.y3 - n.y2) / (this->d.y3 - this->d.y2)
		};
		
		if (this->d.y2 == this->d.y1) {
			y_scales[1] = 0;
		}
		
		for (int i { 0 };i < this->_affected_points.size();++i) {
			
			Point& original_point { this->_original_points[i] };
			Point& point { this->_affected_points[i] };
			const Segment segment { this->_segments[i] };
			
			switch (segment.x) {
				case 0:
					point.x = (original_point.x - this->d.x0) * x_scales[0] + n.x0;
					break;
				case 1:
					point.x = (original_point.x - this->d.x1) * x_scales[1] + n.x1;
					break;
				case 2:
					point.x = (original_point.x - this->d.x2) * x_scales[2] + n.x2;
					break;
			}
			
			switch (segment.y) {
				case 0:
					point.y = (original_point.y - this->d.y0) * y_scales[0] + n.y0;
					break;
				case 1:
					point.y = (original_point.y - this->d.y1) * y_scales[1] + n.y1;
					break;
				case 2:
					point.y = (original_point.y - this->d.y2) * y_scales[2] + n.y2;
					break;
			}
		}
		
		
		this->n = n;
		
		return true;
	}
	
	GridDimensions get_dimensions() {
		return this->n;
	}
};

std::vector<Point> get_blank_vector(std::vector<Point>::size_type size) {
	std::vector<Point> result {};
	result.reserve(size);
	return result;
}

void append_point(std::vector<Point>& vec, double x, double y) { // emplace_back doesn't exist in the js api created by register_vector
	vec.emplace_back(x, y);
}

EMSCRIPTEN_BINDINGS (warping) {
	emscripten::class_<GridWarper>("GridWarper")
		.constructor<std::vector<Point>&, double, double, double, double, double, double, double, double>()
		.function("warp", &GridWarper::warp)
		.function("get_dimensions", &GridWarper::get_dimensions)
		;

	emscripten::value_object<Point>("Point")
		.field("x", &Point::x)
		.field("y", &Point::y)
		;
	
	emscripten::value_object<GridDimensions>("GridDimensions")
		.field("x0", &GridDimensions::x0)
		.field("y0", &GridDimensions::y0)
		.field("x1", &GridDimensions::x1)
		.field("y1", &GridDimensions::y1)
		.field("x2", &GridDimensions::x2)
		.field("y2", &GridDimensions::y2)
		.field("x3", &GridDimensions::x3)
		.field("y3", &GridDimensions::y3)
		;
		
	emscripten::register_vector<Point>("std::vector<Point>");
	
	emscripten::function("get_blank_vector", &get_blank_vector);
	emscripten::function("append_point", &append_point);
}