
import {obtain} from "./tools/obtain.js"
import {objectMap} from "./tools/object-map.js"
import {debounce} from "./tools/debounce/debounce.js"
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

function clone(o: StateTree): any {
	return objectMap(o, (value, key) => {
		return (typeof value === "object")
			? clone(value)
			: value
	})
}

function pathExists(paths: string[][], path: string[]) {
	for (const comparisonPath of paths) {
		let mismatch = false
		if (path.length === comparisonPath.length) {
			for (let i = 0; i < path.length; i++) {
				if (path[i] !== comparisonPath[i]) {
					mismatch = true
					break
				}
			}
			if (!mismatch)
				return true
		}
	}
	return false
}

export interface TrackingSession {
	paths: string[][]
	observer: Observer<any, any>
	reaction?: Reaction<any>
}

export type Subscription<xTree extends StateTree> = (readable: Readable<xTree>) => void

export function deepstate<xTree extends StateTree>(tree: xTree) {
	const masterTree = clone(tree)

	let activeTrackThatIsRecording: TrackingSession
	const trackingSessions = new Map<symbol, TrackingSession>()
	const subscriptions = new Set<Subscription<xTree>>()

	function findTrackingSessions(path: string[]): TrackingSession[] {
		const sessions: TrackingSession[] = []
		for (const [,session] of trackingSessions) {
			if (pathExists(session.paths, path))
				sessions.push(session)
		}
		return sessions
	}

	const writable = <xTree>recurse(true, [])
	const readable = <Readable<xTree>>recurse(false, [])

	let updateQueue: string[][] = []
	const update = debounce(1, () => {
		for (const path of updateQueue) {

			// trigger subscriptions
			for (const subscription of subscriptions) {
				subscription(readable)
			}

			// trigger reactions
			for (const {observer, reaction} of findTrackingSessions(path)) {
				if (reaction)
					reaction(observer(readable))
				else
					observer(readable)
			}
		}
		updateQueue = []
	})
	let waiter: Promise<void> = Promise.resolve()
	function queueUpdate(path: string[]) {
		if (!pathExists(updateQueue, path))
			updateQueue.push(path)
		waiter = update()
	}

	function recurse(allowWrites: boolean, path: string[]): any {
		return new Proxy({}, {
			get(t: any, property: string) {
				const currentPath = [...path, property]

				// record which properties are read during tracking
				if (activeTrackThatIsRecording) {
					if (!pathExists(activeTrackThatIsRecording.paths, currentPath)) {
						activeTrackThatIsRecording.paths.push(currentPath)
					}
				}

				const value = obtain(masterTree, currentPath)
				return typeof value === "object"
					? recurse(allowWrites, currentPath)
					: value
			},
			set(t, property: string, value: any) {
				const currentPath = [...path, property]
				if (allowWrites) {
					plantProperty(masterTree, currentPath, value)
					queueUpdate(currentPath)
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

	return {
		writable,
		readable,
		subscribe(subscription: Subscription<xTree>) {
			subscriptions.add(subscription)
			return () => subscriptions.delete(subscription)
		},
		track<X>(observer: Observer<xTree, X>, reaction?: Reaction<X>) {
			const identifier = Symbol()
			activeTrackThatIsRecording = {observer, reaction, paths: []}
			trackingSessions.set(identifier, activeTrackThatIsRecording)
			observer(readable)
			activeTrackThatIsRecording = undefined
			return () => trackingSessions.delete(identifier)
		},
		async wait() {
			await waiter
		},
	}
}

export function substate<xState extends ReturnType<typeof deepstate>, xTree>(
		state: xState,
		grabber: (tree: xState["writable"]) => xTree
	) {
	const writable = grabber(state.writable)
	const readable = grabber(state.readable)
	return {
		writable,
		readable,
		subscribe(subscription: Subscription<xTree>) {
			return state.subscribe(() => subscription(readable))
		},
		track<X>(observer: Observer<xTree, X>, reaction?: Reaction<X>) {
			return state.track<X>(() => observer(readable), reaction)
		},
		wait: state.wait,
	}
}
