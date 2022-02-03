
import {objectMap} from "./object-map.js"
import {isPlainObject} from "./is-plain-object.js"

export function unproxy<X>(x: X, unlessSymbol: symbol): X {
	return (isPlainObject(x) && !(<any>x)[unlessSymbol])
		? objectMap(x, value => unproxy(value, unlessSymbol))
		: x
}
