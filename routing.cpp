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


double get_square_distance(Point p0, Point p1) {
	return pow(p1.x - p0.x, 2) + pow(p1.y - p0.y, 2);
}

double get_angle(Point p0, Point p1) {
	double gradient { (p1.y - p0.y)/(p1.x - p0.x) };
	double uncorrected { 180 * std::atan(gradient) / std::numbers::pi };
	if (p1.x - p0.x < 0) {
		uncorrected += 180;
	}
	return std::fmod(uncorrected, 360);
}

double get_distance(Point p0, Point p1) {
	return std::sqrt(get_square_distance(p0, p1));
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

Point get_routing_point(Point fixed0, Point fixed1, Point guide) {
	
	double width { std::fabs(fixed1.x - fixed0.x) };
	double height { std::fabs(fixed1.y - fixed0.y) };
	
	std::pair<Point, Point> candidates {};

	if (height == width) { // straight 45 degrees
		candidates = {fixed0, fixed1};
	} else if (height > width) { // orthogonal line is vertical
		candidates = {
			{fixed0.x, fixed1.y > fixed0.y ? fixed1.y - width : fixed1.y + width},
			{fixed1.x, fixed0.y > fixed1.y ? fixed0.y - width : fixed0.y + width}
		};
	} else { // orthogonal line is horizontal
		candidates = {
			{fixed1.x > fixed0.x ? fixed1.x - height : fixed1.x + height, fixed0.y},
			{fixed0.x > fixed1.x ? fixed0.x - height : fixed0.x + height, fixed1.y}
		};
	}
	
	std::pair<double, double> squared_distances {
		get_square_distance(candidates.first, guide),
		get_square_distance(candidates.second, guide)
	};
	
	if (squared_distances.first < squared_distances.second) {
		return candidates.first;
	} else {
		return candidates.second;
	}
}


Point snap_to_angle(Point fixed, Point guide) {
	double angle { closest(get_angle(fixed, guide) , {0, 45, 90, 135, 180, 225, 270, 315}) };
	double radius { get_distance(fixed, guide) };
	return to_cartesian(radius, angle);
}

std::array<Point, 2> get_routing_points_half_fixed(
	Point fixed_guide, Point fixed_corrector, Point guide, Point corrector
	// fixed_x is the fixed point on the x side
){
	Point snapped { snap_to_angle(fixed_guide, guide) };
	return {
		snapped, get_routing_point(snapped, fixed_corrector, corrector)
	};
}

std::vector<Point> get_multiple_routing_points(const std::vector<std::array<Point, 3>>& args) {
	std::vector<Point> result;
	result.reserve(args.size());
	for (std::array<Point, 3> spec : args) {
		result.push_back(get_routing_point(spec[0], spec[1], spec[2]));
	}
	return result;
}

EMSCRIPTEN_BINDINGS(routing) {
	emscripten::value_object<Point>("Point")
		.field("x", &Point::x)
		.field("y", &Point::y)
		;
	emscripten::function("snap_to_angle", &snap_to_angle);
	emscripten::function("get_routing_point", &get_routing_point);
}