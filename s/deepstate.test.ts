
import {Suite, expect} from "cynic"
import {deepstate} from "./deepstate.js"

import debounce from "./tools/debounce/debounce.test.js"
import {nap} from "./tools/nap.js"

export default <Suite>{
	debounce,
	"deepstate": {
		"reading and writing": {
			async "state property is readable"() {
				const state = deepstate({group: {a: 0}})
				expect(state.readable.group.a).equals(0)
			},
			async "state readable properties are readonly"() {
				const state = deepstate({group: {a: 0}})
				expect(() => (<any>state.readable).group.a += 1).throws()
			},
			async "state readable groups are readonly"() {
				const state = deepstate({group: {a: 0}})
				expect(() => (<any>state.readable).group = {a: 1}).throws()
			},
			async "state property is writable"() {
				const state = deepstate({group: {a: 0}})
				state.writable.group.a += 1
				expect(state.readable.group.a).equals(1)
			},
			async "state group is writable"() {
				const state = deepstate({group: {a: 0}})
				state.writable.group = {a: 1}
				expect(state.readable.group.a).equals(1)
			},
		},
		"subscriptions": {
			async "state property is subscribable"() {
				const state = deepstate({group: {a: 0}})
				let calls = 0
				state.subscribe(readable => calls += 1)
				state.writable.group.a += 1
				await state.wait()
				expect(calls).equals(1)
			},
			async "subscription can be unsubscribed"() {
				const state = deepstate({group: {a: 0}})
				let calls = 0
				const unsubscribe = state.subscribe(readable => calls += 1)
				state.writable.group.a += 1
				await state.wait()
				expect(calls).equals(1)
				unsubscribe()
				state.writable.group.a += 1
				await state.wait()
				expect(calls).equals(1)
			},
		},
		"tracking": {
			async "state property is trackable"() {
				const state = deepstate({group: {a: 0}})
				let calls = 0
				state.track(readable => {
					void readable.group.a
					calls += 1
				})
				state.writable.group.a += 1
				await state.wait()
				expect(calls).equals(2)
			},
			async "only the relevant properties are tracked"() {
				const state = deepstate({group: {a: 0, b: 0}})
				let aCalls = 0
				let bCalls = 0
				state.track(readable => {
					void readable.group.a
					aCalls += 1
				})
				state.track(readable => {
					void readable.group.b
					bCalls += 1
				})
				expect(aCalls).equals(1)
				expect(bCalls).equals(1)
		
				state.writable.group.a += 1
				await state.wait()
				expect(aCalls).equals(2)
				expect(bCalls).equals(1)
		
				state.writable.group.b += 1
				await state.wait()
				expect(aCalls).equals(2)
				expect(bCalls).equals(2)
		
				state.writable.group = {a: -1, b: -1}
				await state.wait()
				expect(aCalls).equals(3)
				expect(bCalls).equals(3)
			},
			async "track can be untracked"() {
				const state = deepstate({group: {a: 0}})
				let calls = 0
				const untrack = state.track(readable => {
					void readable.group.a
					calls += 1
				})
				state.writable.group.a += 1
				await state.wait()
				expect(calls).equals(2)
				untrack()
				state.writable.group.a += 1
				await state.wait()
				expect(calls).equals(2)
			},
			async "state property track reaction to avoid initial call"() {
				const state = deepstate({group: {a: 0}})
				let calls = 0
				state.track(
					readable => ({a: readable.group.a}),
					() => calls += 1,
				)
				state.writable.group.a += 1
				await state.wait()
				expect(calls).equals(1)
			},
			async "state group can be tracked"() {
				const state = deepstate({group: {a: 0}})
				let calls = 0
				state.track(readable => {
					void readable.group
					calls += 1
				})
				state.writable.group = {a: 999}
				await state.wait()
				expect(calls).equals(2)
			},
			async "state group triggers trackers for properties"() {
				const state = deepstate({group: {a: 0}})
				let calls = 0
				state.track(readable => {
					void readable.group.a
					calls += 1
				})
				state.writable.group = {a: 999}
				await state.wait()
				expect(calls).equals(2)
			},
		},
		"debouncing updates": {
			async "multiple updates are debounced"() {
				const state = deepstate({group: {a: 0}})
				let calls = 0
				state.track(readable => {
					void readable.group.a
					calls += 1
				})
				state.writable.group.a += 1
				state.writable.group.a += 1
				state.writable.group.a += 1
				await state.wait()
				expect(calls).equals(2)
			},
			async "two waits in sequence work"() {
				const state = deepstate({group: {a: 0, b: 0}})
				let aCalls = 0
				state.track(readable => {
					void readable.group.a
					aCalls += 1
				})
				expect(aCalls).equals(1)
		
				state.writable.group.a += 1
				await state.wait()
				await nap(100)
				expect(aCalls).equals(2)
		
				state.writable.group.a += 1
				await state.wait()
				expect(aCalls).equals(3)
			},
		},
	},
}
