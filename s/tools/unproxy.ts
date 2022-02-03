
import {objectMap} from "./object-map.js"
import {isPlainObject} from "./is-plain-object.js"

export function unproxy<X>(x: X): X {
	return isPlainObject(x)
		? objectMap(x, unproxy)
		: x
}
