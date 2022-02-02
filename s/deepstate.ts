
import {obtain} from "./tools/obtain.js"
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

export function deepstate<xTree extends StateTree>(tree: xTree) {
	const masterTree = clone(tree)

	let activeTrackThatIsRecording: TrackingSession
	const trackingSessions = new Map<symbol, TrackingSession>()

	function findTrackingSessions(path: string[]): TrackingSession[] {
		const sessions: TrackingSession[] = []
		for (const [,session] of trackingSessions) {
			if (pathExists(session.paths, path))
				sessions.push(session)
		}
		return sessions
	}

	const writable = <xTree>recurse(tree, true, [])
	const readable = <Readable<xTree>>recurse(tree, false, [])

	function recurse(o: StateTree, allowWrites: boolean, path: string[]): any {
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
					? recurse(value, allowWrites, currentPath)
					: value
			},
			set(t, property: string, value: any) {
				const currentPath = [...path, property]
				if (allowWrites) {
					plantProperty(masterTree, currentPath, value)

					// trigger reactions
					for (const {observer, reaction} of findTrackingSessions(currentPath)) {
						if (reaction)
							reaction(observer(readable))
						else
							observer(readable)
					}

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
		subscribe() {},
		track<X>(observer: Observer<xTree, X>, reaction?: Reaction<X>) {
			const identifier = Symbol()
			activeTrackThatIsRecording = {observer, reaction, paths: []}
			trackingSessions.set(identifier, activeTrackThatIsRecording)
			observer(readable)
			activeTrackThatIsRecording = undefined
			return () => trackingSessions.delete(identifier)
		},
	}
}
