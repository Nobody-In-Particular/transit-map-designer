## Classes

<dl>
<dt><a href="#Rectangle">Rectangle</a></dt>
<dd><p>API for an SVG rectangle with various utilities</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#bbox">bbox</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#bounds">bounds</a> : <code>Array</code></dt>
<dd></dd>
</dl>

<a name="Rectangle"></a>

## Rectangle
API for an SVG rectangle with various utilities

**Kind**: global class  

* [Rectangle](#Rectangle)
    * [new Rectangle(parentElement, bbox, style, flipabble, optionalInitialValues)](#new_Rectangle_new)
    * [.round](#Rectangle+round) : <code>boolean</code>
    * [.parentElement](#Rectangle+parentElement) : <code>SVGElement</code>
    * [.flippable](#Rectangle+flippable) : <code>boolean</code>
    * [.xBounds](#Rectangle+xBounds) : [<code>bounds</code>](#bounds)
    * [.yBounds](#Rectangle+yBounds) : [<code>bounds</code>](#bounds)
    * [.coordTransformMatrix](#Rectangle+coordTransformMatrix) : <code>DOMMatrixReadOnly</code>
    * [.changed](#Rectangle+changed) : <code>boolean</code>
    * [.draw()](#Rectangle+draw)

<a name="new_Rectangle_new"></a>

### new Rectangle(parentElement, bbox, style, flipabble, optionalInitialValues)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| parentElement | <code>SVGElement</code> |  | initial value for [parentElement](#Rectangle+parentElement) |
| bbox | [<code>bbox</code>](#bbox) |  | initial bounding box for the rectangle |
| style | <code>Object</code> |  | style and other attributes for the rectangle SVG element |
| flipabble | <code>boolean</code> |  | initial value for [flippable](#Rectangle+flippable) |
| optionalInitialValues | <code>Object</code> |  |  |
| [optionalInitialValues.xBounds] | [<code>bounds</code>](#bounds) | <code></code> | initial value for [xBounds](#Rectangle+xBounds) |
| [optionalInitialValues.yBounds] | [<code>bounds</code>](#bounds) | <code></code> | initial value for [yBounds](#Rectangle+yBounds) |
| [optionalInitialValues.round] | <code>boolean</code> | <code></code> | initial value for [round](#Rectangle+round) |
| [optionalInitialValues.coordTransformMatrix] | <code>DOMMatrixReadOnly</code> | <code></code> | initial value for [coordTransformMatrix](#Rectangle+coordTransformMatrix) |

<a name="Rectangle+round"></a>

### rectangle.round : <code>boolean</code>
whether to round all corner values to the nearest integer when moving/setting

**Kind**: instance property of [<code>Rectangle</code>](#Rectangle)  
<a name="Rectangle+parentElement"></a>

### rectangle.parentElement : <code>SVGElement</code>
the parent SVG element for the rectangle

**Kind**: instance property of [<code>Rectangle</code>](#Rectangle)  
<a name="Rectangle+flippable"></a>

### rectangle.flippable : <code>boolean</code>
Can the rectangle be flipped - i.e., can the initial right edge come further left than
		the left edge, and the initial bottom edge further up than the top edge

**Kind**: instance property of [<code>Rectangle</code>](#Rectangle)  
<a name="Rectangle+xBounds"></a>

### rectangle.xBounds : [<code>bounds</code>](#bounds)
Inclusive left/right boundaries for *any* of the rectangle

**Kind**: instance property of [<code>Rectangle</code>](#Rectangle)  
<a name="Rectangle+yBounds"></a>

### rectangle.yBounds : [<code>bounds</code>](#bounds)
Inclusive up/down boundaries for *any* of the rectangle

**Kind**: instance property of [<code>Rectangle</code>](#Rectangle)  
<a name="Rectangle+coordTransformMatrix"></a>

### rectangle.coordTransformMatrix : <code>DOMMatrixReadOnly</code>
Matrix to transform coordinates before drawing. The inverse is used to transform
		mouse coordinates to rectangle coordinates when dragging/resizing.
		This is *not* for transforming between screen and SVG coordinates - that is done automatically
		anyway. This matrix should transform between some "virtual" coordinates and SVG coordinates.

**Kind**: instance property of [<code>Rectangle</code>](#Rectangle)  
<a name="Rectangle+changed"></a>

### rectangle.changed : <code>boolean</code>
have any of the rectangle's points changed

**Kind**: instance property of [<code>Rectangle</code>](#Rectangle)  
<a name="Rectangle+draw"></a>

### rectangle.draw()
draw

**Kind**: instance method of [<code>Rectangle</code>](#Rectangle)  
<a name="bbox"></a>

## bbox : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type |
| --- | --- |
| x | <code>number</code> | 
| y | <code>number</code> | 
| width | <code>number</code> | 
| height | <code>number</code> | 

<a name="bounds"></a>

## bounds : <code>Array</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| 0 | <code>number</code> | the lower bound (inclusive) |
| 1 | <code>number</code> | the upper bound (inclusive) |

