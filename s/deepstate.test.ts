
import {Suite, assert, expect} from "cynic"
import {deepstate} from "./deepstate.js"

import debounce from "./tools/debounce/debounce.test.js"

export default <Suite>{
	debounce,
	"deepstate": {
		async "state property is readable"() {
			const state = deepstate({group: {a: 0}})
			expect(state.readable.group.a).equals(0)
		},
		async "state readable properties are readonly"() {
			const state = deepstate({group: {a: 0}})
			expect(() => (<any>state.readable).group.a += 1).throws()
		},
		// async "state property is writable"() {
		// 	const state = deepstate({group: {a: 0}})
		// 	state.writable.group.a += 1
		// 	expect(state.readable.group.a).equals(1)
		// },
		// async "state property is subscribable"() {
		// 	const state = deepstate({group: {a: 0}})
		// 	let calls = 0
		// 	state.subscribe(readable => calls += 1)
		// 	state.writable.group.a += 1
		// 	expect(calls).equals(1)
		// },
		// async "state property is trackable"() {
		// 	const state = deepstate({group: {a: 0}})
		// 	let calls = 0
		// 	state.track(readable => {
		// 		void readable.group.a
		// 		calls += 1
		// 	})
		// 	state.writable.group.a += 1
		// 	expect(calls).equals(2)
		// },
		// async "state property track reaction to avoid initial call"() {
		// 	const state = deepstate({group: {a: 0}})
		// 	let calls = 0
		// 	state.track(
		// 		readable => ({a: readable.group.a}),
		// 		() => calls += 1,
		// 	)
		// 	state.writable.group.a += 1
		// 	expect(calls).equals(1)
		// },
		// async "state group triggers trackers for properties"() {
		// 	const state = deepstate({group: {a: 0}})
		// 	let calls = 0
		// 	state.track(readable => {
		// 		void readable.group.a
		// 		calls += 1
		// 	})
		// 	state.writable.group = {a: 999}
		// 	expect(calls).equals(2)
		// },
		// async "state group can be tracked"() {
		// 	const state = deepstate({group: {a: 0}})
		// 	let calls = 0
		// 	state.track(readable => {
		// 		void readable.group
		// 		calls += 1
		// 	})
		// 	state.writable.group = {a: 999}
		// 	expect(calls).equals(2)
		// },
	}
}
