
/**
 * insert a value into an object tree.
 *  - add missing objects to the tree, according to the path.
 *  - replace any non-object properties with objects along the way.
 *  - sets the property value, onto the deepest object.
 */
export function forceNestedProperty(
		object: {[key: string]: any},
		path: string[],
		value: any,
	) {
	const pathToSubObject = [...path]
	const finalKey = pathToSubObject.pop()
	let currentSubObject: any = object
	for (const key of pathToSubObject) {
		if (typeof currentSubObject[key] === "object") {
			currentSubObject = currentSubObject[key]
		}
		else {
			currentSubObject[key] = {}
			currentSubObject = currentSubObject[key]
		}
	}
	currentSubObject[finalKey] = value
}
