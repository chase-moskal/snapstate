
import {objectMap} from "./tools/object-map.js"
import {isSnapstate} from "./parts/is-snapstate.js"
import {SnapstateTreeError} from "./parts/errors.js"
import {plantProperty} from "./tools/plant-property.js"

import type {snapstate} from "./snapstate.js"
import type {ReadableTree, SnapstateTree, WritableTree} from "./types.js"

export function composeSnapstate<xTree extends SnapstateTree>(tree: xTree) {
	const snapstates: ReturnType<typeof snapstate>[] = []
	const readable = <ReadableTree<xTree>>{}
	const writable = <WritableTree<xTree>>{}

	function recurse(
			value: ReturnType<typeof snapstate> | SnapstateTree,
			path: string[],
		) {
		objectMap(value, (innerValue, key) => {
			const currentPath = [...path, key]
			if (isSnapstate(innerValue)) {
				snapstates.push(innerValue)
				plantProperty(readable, currentPath, innerValue.readable)
				plantProperty(writable, currentPath, innerValue.writable)
			}
			else if (typeof innerValue === "object")
				recurse(innerValue, currentPath)
			else
				throw new SnapstateTreeError(
					`invalid value in snapstate tree, "${currentPath.join(".")}"`
				)
		})
	}

	recurse(tree, [])

	type ListeningAspects = Pick<
		ReturnType<typeof snapstate>,
		"subscribe" | "track" | "wait"
	>

	return {
		tree,
		readable,
		writable,
		...<ListeningAspects>{
			subscribe(listener) {
				const unsubs = snapstates.map(s => s.subscribe(listener))
				return () => {
					for (const unsub of unsubs)
						unsub()
				}
			},
			track(observer, reaction) {
				const untracks = snapstates.map(s => s.track(observer, reaction))
				return () => {
					for (const untrack of untracks)
						untrack()
				}
			},
			async wait() {
				await Promise.all(snapstates.map(s => s.wait()))
			},
		},
	}
}
