
import {clone} from "./tools/clone.js"
import {obtain} from "./tools/obtain.js"
import {debounce} from "./tools/debounce/debounce.js"
import {forceNestedProperty} from "./tools/force-nested-property.js"
import {containsPathOrChildren, containsPath} from "./parts/paths.js"
import {SnapstateCircularError, SnapstateReadonlyError} from "./parts/errors.js"

import type {StateTree, Readable, Subscription, TrackingSession, Snapstate} from "./types.js"

export * from "./types.js"
export * from "./parts/errors.js"
export * from "./tools/obtain.js"
export * from "./tools/debounce/debounce.js"
export * from "./tools/force-nested-property.js"

export function snapstate<xTree extends StateTree>(tree: xTree): Snapstate<xTree> {
	const masterTree = clone(tree)

	let activeUpdate = false
	let activeTrackThatIsRecording: TrackingSession
	const trackingSessions = new Map<symbol, TrackingSession>()
	const subscriptions = new Set<Subscription<xTree>>()

	function findTrackingSessions(path: string[]): TrackingSession[] {
		const sessions: TrackingSession[] = []
		for (const [,session] of trackingSessions) {
			if (containsPathOrChildren(session.paths, path))
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
		if (!containsPath(updateQueue, path))
			updateQueue.push(path)
		waiter = update()
	}

	function recurse(allowWrites: boolean, path: string[]): any {
		return new Proxy({}, {
			get(t: any, property: string) {
				const currentPath = [...path, property]

				// record which properties are read during tracking
				if (activeTrackThatIsRecording) {
					if (!containsPath(activeTrackThatIsRecording.paths, currentPath)) {
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
					forceNestedProperty(masterTree, currentPath, value)
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

	const untrackers = new Set<() => void>()
	const unsubscribers = new Set<() => void>()

	return {
		writable,
		readable,
		subscribe(subscription) {
			subscriptions.add(subscription)
			const unsubscribe = () => subscriptions.delete(subscription)
			unsubscribers.add(unsubscribe)
			return unsubscribe
		},
		track(observer, reaction) {
			const identifier = Symbol()
			activeTrackThatIsRecording = {observer, reaction, paths: []}
			trackingSessions.set(identifier, activeTrackThatIsRecording)
			observer(readable)
			activeTrackThatIsRecording = undefined
			const untrack = () => trackingSessions.delete(identifier)
			untrackers.add(untrack)
			return untrack
		},
		unsubscribeAll() {
			for (const unsubscribe of unsubscribers)
				unsubscribe()
			unsubscribers.clear()
		},
		untrackAll() {
			for (const untrack of untrackers)
				untrack()
			untrackers.clear()
		},
		async wait() {
			await waiter
		},
	}
}

export function substate<xTree extends StateTree, xSubtree extends StateTree>(
		state: Snapstate<xTree>,
		grabber: (tree: xTree) => xSubtree,
	): Snapstate<xSubtree> {
	const writable = grabber(state.writable)
	const readable = grabber(<xTree>state.readable)
	const untrackers = new Set<() => void>()
	const unsubscribers = new Set<() => void>()
	return {
		writable,
		readable,
		subscribe(subscription) {
			const unsubscribe = state.subscribe(() => subscription(readable))
			unsubscribers.add(unsubscribe)
			return unsubscribe
		},
		track(observer, reaction) {
			const untrack = state.track(() => observer(readable), reaction)
			untrackers.add(untrack)
			return untrack
		},
		unsubscribeAll() {
			for (const unsubscribe of unsubscribers)
				unsubscribe()
			unsubscribers.clear()
		},
		untrackAll() {
			for (const untrack of untrackers)
				untrack()
			untrackers.clear()
		},
		wait: state.wait,
	}
}
