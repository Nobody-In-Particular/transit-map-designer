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
	if (p1.x - p0.x == 0) {
		return p1.y - p0.y > 0 ? 90 : 270;
	}
	
	double gradient { (p1.y - p0.y)/(p1.x - p0.x) };
	double uncorrected { 180 * std::atan(gradient) / std::numbers::pi };
	
	if (p1.x - p0.x < 0) {
		uncorrected += 180;
	} else if ( p1.y - p0.y < 0) {
		uncorrected += 360;
	}
	return uncorrected;
}

double get_distance(Point p0, Point p1) {
	return std::sqrt(get_square_distance(p0, p1));
}

Point to_cartesian(double r, double theta) {
	return { r * std::cos(theta), r * std::sin(theta) };
}


template <typename N>
double closest(N val, const std::vector<N>& arr) {
	if (val >= arr[arr.size() - 1]) {
		return arr[arr.size() - 1];
	} else if (val <= arr[0]) {
		return arr[0];
	} else {
		auto first_ge_it { std::ranges::lower_bound(arr, val) };
		N last_lt { *(first_ge_it - 1) };
		N first_ge { *first_ge_it };
		return val - last_lt < first_ge - val ? last_lt : first_ge;
	}
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
	
	// 360 needed to catch angles closer to 360 than 315;
	double angle { closest<double>(get_angle(fixed, guide) , {0, 45, 90, 135, 180, 225, 270, 315, 360}) };
	
	double radius { get_distance(fixed, guide) };
	Point relative { to_cartesian(radius, angle / 180 * std::numbers::pi) };
	return { fixed.x + relative.x, fixed.y + relative.y };
}

std::array<Point, 2> get_routing_points_half_fixed(
	Point fixed_guide, Point fixed_corrector, Point guide, Point corrector
){
	Point snapped { snap_to_angle(fixed_guide, guide) };
	return {
		snapped, get_routing_point(snapped, fixed_corrector, corrector)
	};
}

/*
std::vector<Point> get_many_routing_points(std::vector<Point> fixed0, std::vector<Point> fixed1, std::vector<Point> guide) {
	std::vector<Point> result {};
	result.reserve(fixed0.size());
	for (int i { 0 };i < fixed0.size(); ++i) {
		result.push_back(get_routing_point(fixed0[i], fixed1[i], guide[i]));
	}
	return result;
}

*/




EMSCRIPTEN_BINDINGS(routing) {
	emscripten::value_object<Point>("Point")
		.field("x", &Point::x)
		.field("y", &Point::y)
		;
	
	emscripten::value_array<std::array<Point, 2>>("std::array<Point, 2>")
		.element(emscripten::index<0>())
		.element(emscripten::index<1>())
		;
	
	/*
	emscripten::register_vector<Point>("std::vector<Point>");
	emscripten::register_vector<std::vector<Point>>("std::vector<std::vector<Point>>");
	
	emscripten::function("get_blank_vectors", &get_blank_vectors);
	emscripten::function("get_many_routing_points", &get_many_routing_points);
	*/
	
	emscripten::function("get_routing_points_half_fixed", &get_routing_points_half_fixed);
	emscripten::function("snap_to_angle", &snap_to_angle);
	emscripten::function("get_routing_point", &get_routing_point);
}