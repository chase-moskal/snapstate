
import {StateTree} from "../types.js"
import {isPlainObject} from "./is-plain-object.js"
import {objectMap} from "./object-map.js"

export function clone(o: StateTree): any {
	return objectMap(o, value =>
		isPlainObject(value)
			? clone(value)
			: value
	)
}
