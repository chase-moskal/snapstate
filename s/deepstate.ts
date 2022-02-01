
import {objectMap} from "./tools/object-map.js"
import {plantProperty} from "./tools/plant-property.js"
import {SnapstateReadonlyError} from "./parts/errors.js"

export interface StateTree {
	[key: string]: StateTree | any
}

export type Readable<xTree> = {
	readonly [P in keyof xTree]: xTree[P] extends StateTree
		? Readable<xTree[P]>
		: xTree[P]
}

export type Observer<xTree, X> = (readable: Readable<xTree>) => X
export type Reaction<X> = (x: X) => void

export function deepstate<xTree extends StateTree>(tree: xTree) {

	const trackers: {[key: string]: any} = {}
	const pathToTrackId = (path: string[]) => path.join("++")

	let activeTrackThatIsRecording: {
		observer: Observer<xTree, any>
		reaction: Reaction<any>
	}

	function recurse(o: StateTree, allowWrites: boolean, path: string[]): any {
		return objectMap(o, (item, key) => {
			const currentPath = [...path, key]
			if (typeof item === "object") {
				const target = recurse(item, allowWrites, currentPath)
				return new Proxy(target, {
					get(t: any, property: string) {
						return t[property]
					},
					set(t, property: string, value: any) {
						if (allowWrites) {
							
						}
						else {
							throw new SnapstateReadonlyError(
								`state is read-only here, cannot set ${currentPath.join(".")}`
							)
						}
						return true
					},
				})
			}
			else {
				return item
			}
		})
	}

	const readable = <Readable<xTree>>recurse(tree, false, [])
	const writable = <xTree>recurse(tree, true, [])

	return {
		readable,
		writable,
		subscribe() {},
		track<X>(observer: Observer<xTree, X>, reaction?: Reaction<X>) {
			activeTrackThatIsRecording = {observer, reaction}
		},
	}
}
