
import {StateTree} from "../types.js"
import {objectMap} from "./object-map.js"

export function clone(o: StateTree): any {
	return objectMap(o, (value) => {
		return (typeof value === "object")
			? clone(value)
			: value
	})
}