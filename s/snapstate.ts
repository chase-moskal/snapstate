
import {subbies} from "./tools/subbies.js"
import {debounceDelay} from "./parts/constants.js"
import {debounce} from "./tools/debounce/debounce.js"
import {SnapstateReadonlyError} from "./parts/errors.js"
import {trackingMechanics} from "./parts/tracking-mechanics.js"

export * from "./types.js"
export * from "./compose-snapstate.js"
export * from "./tools/debounce/debounce.js"

import type {Observer, Reaction, Readable} from "./types.js"

export function snapstate<xState extends {[key: string]: any}>(actual: xState) {
	const tracking = trackingMechanics()

	function get(t: any, key: string) {
		tracking.reactionRegistration(key)
		return actual[key]
	}

	const readable: Readable<xState> = new Proxy(actual, {
		get,
		set(t, key: string) {
			throw new SnapstateReadonlyError(`readonly state property "${key}"`)
		},
	})

	const {publish: rawPublish, subscribe} = subbies<Readable<xState>>()
	const publishReadable = debounce(debounceDelay, () => rawPublish(readable))

	let waiter: Promise<void> = Promise.resolve()

	const writable: xState = new Proxy(actual, {
		get,
		set(t, key: string, value) {
			tracking.avoidCircular(key)
			;(<any>actual)[key] = value
			tracking.triggerReactions(readable, key)
			waiter = publishReadable()
			return true
		},
	})

	return {
		readable,
		writable,
		subscribe,
		track<X>(observer: Observer<xState, X>, reaction?: Reaction<X>) {
			return tracking.track(readable, observer, reaction)
		},
		async wait() {
			await Promise.all([waiter, tracking.wait])
		},
	}
}
