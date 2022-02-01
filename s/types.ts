
import {snapstate} from "./snapstate.js"
import {trackingMechanics} from "./parts/tracking-mechanics.js"

export type Observer<xState, X> = (readable: Readable<xState>) => X
export type Reaction<X> = (x: X) => void

export type Track = ReturnType<typeof trackingMechanics>["track"]

export type Readable<xState extends {}> = {
	readonly [P in keyof xState]: xState[P]
}

export interface SnapstateTree {
	[key: string]: SnapstateTree | ReturnType<typeof snapstate>
}

export type ReadableTree<xTree extends SnapstateTree> = {
	[P in keyof xTree]: xTree[P] extends ReturnType<typeof snapstate>
		? xTree[P]["readable"]
		: xTree[P] extends SnapstateTree
			? ReadableTree<xTree[P]>
			: never
}

export type WritableTree<xTree extends SnapstateTree> = {
	[P in keyof xTree]: xTree[P] extends ReturnType<typeof snapstate>
		? xTree[P]["writable"]
		: xTree[P] extends SnapstateTree
			? WritableTree<xTree[P]>
			: never
}
