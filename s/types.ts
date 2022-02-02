
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
	flip: boolean
	observer: Observer<any, any>
	reaction?: Reaction<any>
}

export type Subscription<xTree extends StateTree> = (readable: Readable<xTree>) => void

export interface Snapstate<xTree extends StateTree> {
	writable: xTree
	readable: Readable<xTree>
	subscribe(subscription: Subscription<xTree>): () => void
	track<X>(observer: Observer<xTree, X>, reaction?: Reaction<X>, options?: {flip?: boolean}): () => void
	unsubscribeAll(): void
	untrackAll(): void
	wait(): Promise<void>
}
