
import {clone} from "./tools/clone.js"
import {obtain} from "./tools/obtain.js"
import {pathExists} from "./parts/path-exists.js"
import {debounce} from "./tools/debounce/debounce.js"
import {plantProperty} from "./tools/plant-property.js"
import {SnapstateCircularError, SnapstateReadonlyError} from "./parts/errors.js"

import type {StateTree, Observer, Reaction, Readable, Subscription, TrackingSession} from "./types.js"

export * from "./types.js"
export * from "./parts/errors.js"

export function snapstate<xTree extends StateTree>(tree: xTree) {
	const masterTree = clone(tree)

	let activeUpdate = false
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
			activeUpdate = true
			try {
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
			finally {
				activeUpdate = false
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
					if (activeTrackThatIsRecording || activeUpdate)
						throw new SnapstateCircularError("forbidden state circularity")
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

export function substate<xState extends ReturnType<typeof snapstate>, xTree>(
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
