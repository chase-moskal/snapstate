
import {objectMap} from "./tools/object-map.js"
import {plantProperty} from "./tools/plant-property.js"
import {SnapstateReadonlyError} from "./parts/errors.js"
import {obtain} from "./tools/obtain.js"

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

	// const trackers: {[key: string]: any} = {}
	// const pathToTrackId = (path: string[]) => path.join("++")

	function clone(o: StateTree): any {
		return objectMap(o, (value, key) => {
			return (typeof value === "object")
				? clone(value)
				: value
		})
	}

	const masterTree = clone(tree)

	let activeTrackThatIsRecording: {
		observer: Observer<xTree, any>
		reaction: Reaction<any>
	}

	function recurse(o: StateTree, allowWrites: boolean, path: string[]): any {
		return new Proxy({}, {
			get(t: any, property: string) {
				const currentPath = [...path, property]
				const value = obtain(masterTree, currentPath)
				return typeof value === "object"
					? recurse(value, allowWrites, currentPath)
					: value
			},
			set(t, property: string, value: any) {
				const currentPath = [...path, property]
				if (allowWrites) {
					plantProperty(masterTree, currentPath, value)
					return true
				}
				else {
					throw new SnapstateReadonlyError(
						`state is read-only here, cannot set ${currentPath.join(".")}`
					)
				}
			}
		})
	}

	const writable = <xTree>recurse(tree, true, [])
	const readable = <Readable<xTree>>recurse(tree, false, [])

	return {
		writable,
		readable,
		subscribe() {},
		track<X>(observer: Observer<xTree, X>, reaction?: Reaction<X>) {
			activeTrackThatIsRecording = {observer, reaction}
		},
	}
}
