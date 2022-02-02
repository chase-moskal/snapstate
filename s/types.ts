
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

export interface TrackingSession {
	paths: string[][]
	observer: Observer<any, any>
	reaction?: Reaction<any>
}

export type Subscription<xTree extends StateTree> = (readable: Readable<xTree>) => void
