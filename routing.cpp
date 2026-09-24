#include <utility>
#include <vector>
#include <cmath>
#include <numbers>
#include <algorithm>
#include <iostream>
#include <ostream>

#include <emscripten/bind.h>

struct Point {
	double x;
	double y;
};


double get_square_distance(double x0, double y0, double x1, double y1) {
	return pow(x1 - x0, 2) + pow(y1 - y0, 2);
}

Point get_routing_point(double x0, double y0, double x1, double y1, double guide_x, double guide_y) {
	if (x0 > x1) {
		std::swap(x0, x1);
	}
	if (y0 > y1) {
		std::swap(y0, y1);
	}
	
	double width { x1 - x0 };
	double height { y1 - y0 };
	
	std::pair<Point, Point> candidates {};

	if (height == width) { // straight 45 degrees
		candidates = {
			{x0, y0}, {y0, y1}
		};
	} else if (height > width) { // orthogonal line is vertical
		candidates = {
			{x0, y1 - width},
			{x1, y0 + width}
		};
	} else { // orthogonal line is horizontal
		candidates = {
			{x1 - height, y0},
			{x0 + height, y1}
		};
	}
	
	std::pair<double, double> squared_distances {
		get_square_distance(candidates.first.x, candidates.first.y, guide_x, guide_y),
		get_square_distance(candidates.second.x, candidates.second.y, guide_x, guide_y)
	};
	
	if (squared_distances.first < squared_distances.second) {
		return candidates.first;
	} else {
		return candidates.second;
	}
}


double get_angle(double x0, double y0, double x1, double y1) {
	double gradient { (y1 - y0)/(x1 - x0) };
	double uncorrected { 180 * std::atan(gradient) / std::numbers::pi };
	if (x1 - x0 < 0) {
		uncorrected += 180;
	}
	return std::fmod(uncorrected, 360);
}

double get_distance(double x0, double y0, double x1, double y1) {
	return std::sqrt(get_square_distance(x0, y0, x1, y1));
}

Point to_cartesian(double r, double theta) {
	return { r * std::cos(theta), r * std::sin(theta) };
}


template <typename N>
double closest(N val, const std::vector<N>& arr) {
	double lower { *std::ranges::lower_bound(arr, val) };
	double upper { *std::ranges::upper_bound(arr, val) };
		
	return val - lower < upper - val ? lower: upper;
}


Point snap_to_angle(double x, double y, double guide_x, double guide_y) {
	double angle { closest(get_angle(x, y, guide_x, guide_y) , {0, 45, 90, 135, 180, 225, 270, 315}) };
	double radius { get_distance(x, y, guide_x, guide_y) };
	return to_cartesian(radius, angle);
}

EMSCRIPTEN_BINDINGS(routing) {
	emscripten::value_object<Point>("Point")
		.field("x", &Point::x)
		.field("y", &Point::y)
		;
	emscripten::function("snap_to_angle", &snap_to_angle);
	emscripten::function("get_routing_point", &get_routing_point);
}