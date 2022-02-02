
import {Suite, expect} from "cynic"
import {deepstate, substate} from "./deepstate.js"

import debounce from "./tools/debounce/debounce.test.js"

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
				expect(aCalls).equals(2)
		
				state.writable.group.a += 1
				await state.wait()
				expect(aCalls).equals(3)
			},
		},
		"subsectioning": {
			async "subsection reading and writing works"() {
				const state = deepstate({group: {a: 0}})
				const group = substate(state, readable => readable.group)
				expect(group.readable.a).equals(0)
				group.writable.a += 1
				expect(group.readable.a).equals(1)
			},
			async "subsection subscription works"() {
				const state = deepstate({group: {a: 0}})
				const group = substate(state, readable => readable.group)
				expect(group.readable.a).equals(0)
				let calls = 0
				group.subscribe(() => calls += 1)
				expect(calls).equals(0)
				group.writable.a += 1
				expect(group.readable.a).equals(1)
				await group.wait()
				expect(calls).equals(1)
			},
			async "subsection subscription interacts with root state"() {
				const state = deepstate({group: {a: 0}})
				const group = substate(state, readable => readable.group)
				expect(group.readable.a).equals(0)
				let rootCalls = 0
				let subCalls = 0
				state.subscribe(() => rootCalls += 1)
				group.subscribe(() => subCalls += 1)
				expect(rootCalls).equals(0)
				expect(subCalls).equals(0)
				group.writable.a += 1
				await state.wait()
				expect(rootCalls).equals(1)
				expect(subCalls).equals(1)
				state.writable.group.a += 1
				await state.wait()
				expect(rootCalls).equals(2)
				expect(subCalls).equals(2)
			},
			async "subsection tracking works"() {
				const state = deepstate({group: {a: 0}})
				const group = substate(state, readable => readable.group)
				expect(group.readable.a).equals(0)
				let calls = 0
				group.track(readable => {
					void readable.a
					calls += 1
				})
				expect(calls).equals(1)
				group.writable.a += 1
				expect(group.readable.a).equals(1)
				await group.wait()
				expect(calls).equals(2)
			},
			async "subsection tracking interacts with root"() {
				const state = deepstate({group: {a: 0}})
				const group = substate(state, readable => readable.group)
				expect(group.readable.a).equals(0)
				let rootCalls = 0
				let subCalls = 0
				state.track(readable => {
					void readable.group.a
					rootCalls += 1
				})
				group.track(readable => {
					void readable.a
					subCalls += 1
				})
				expect(rootCalls).equals(1)
				expect(subCalls).equals(1)

				group.writable.a += 1
				await state.wait()
				expect(rootCalls).equals(2)
				expect(subCalls).equals(2)

				state.writable.group.a += 1
				await state.wait()
				expect(rootCalls).equals(3)
				expect(subCalls).equals(3)
			},
		},
	},
}
