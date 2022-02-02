
import {Suite, expect} from "cynic"
import {snapstate, substate} from "./snapstate.js"
import {forceNestedProperty} from "./tools/force-nested-property.js"

import debounce from "./tools/debounce/debounce.test.js"

export default <Suite>{
	debounce,
	"force nested property": {
		async "plant a property on an object"() {
			const obj: {[key: string]: boolean} = {}
			forceNestedProperty(obj, ["a"], true)
			expect(obj.a === true).ok()
		},
		async "plant a nested property"() {
			const obj: {[key: string]: any} = {}
			forceNestedProperty(obj, ["a", "b"], true)
			expect(obj.a.b === true).ok()
		},
	},
	"snapstate": {
		"reading and writing": {
			async "state property is readable"() {
				const state = snapstate({group: {a: 0}})
				expect(state.readable.group.a).equals(0)
			},
			async "state property can be read from writable"() {
				const state = snapstate({group: {a: 0}})
				expect(state.writable.group.a).equals(0)
			},
			async "state readable properties are readonly"() {
				const state = snapstate({group: {a: 0}})
				expect(() => (<any>state.readable).group.a += 1).throws()
			},
			async "state readable groups are readonly"() {
				const state = snapstate({group: {a: 0}})
				expect(() => (<any>state.readable).group = {a: 1}).throws()
			},
			async "state property is writable"() {
				const state = snapstate({group: {a: 0}})
				state.writable.group.a += 1
				expect(state.readable.group.a).equals(1)
			},
			async "state group is writable"() {
				const state = snapstate({group: {a: 0}})
				state.writable.group = {a: 1}
				expect(state.readable.group.a).equals(1)
			},
			async "read and write from state root"() {
				const state = snapstate({a: 0, b: 0})
				expect(state.readable.a).equals(0)
				state.writable.a += 1
				expect(state.readable.a).equals(1)
			},
			async "state proxies support object spread"() {
				const state = snapstate({group: {a: 0, b: 0}})
				const result1 = {...state.readable.group}
				state.writable.group = {a: 1, b: 1}
				const result2 = {...state.readable.group}
				const result3 = {...state.writable.group}
				expect(Object.keys(result1).length).equals(2)
				expect(Object.keys(result2).length).equals(2)
				expect(Object.keys(result3).length).equals(2)
				expect(result1.a).equals(0)
				expect(result1.b).equals(0)
				expect(result2.a).equals(1)
				expect(result2.b).equals(1)
				expect(result3.a).equals(1)
				expect(result3.b).equals(1)
			},
		},
		"subscriptions": {
			async "state property is subscribable"() {
				const state = snapstate({group: {a: 0}})
				let calls = 0
				state.subscribe(readable => calls += 1)
				state.writable.group.a += 1
				await state.wait()
				expect(calls).equals(1)
			},
			async "subscription can be unsubscribed"() {
				const state = snapstate({group: {a: 0}})
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
				const state = snapstate({group: {a: 0}})
				let calls = 0
				state.track(readable => {
					void readable.group.a
					calls += 1
				})
				state.writable.group.a += 1
				await state.wait()
				expect(calls).equals(2)
			},
			async "any relevant property change fires the tracker"() {
				const state = snapstate({a: 0, b: 0, c: 0})
				let calls = 0
				state.track(readable => {
					void readable.a
					void readable.b
					void readable.c
					calls += 1
				})
				state.writable.a += 1
				await state.wait()
				expect(calls).equals(2)
				state.writable.b += 1
				await state.wait()
				expect(calls).equals(3)
				state.writable.c += 1
				await state.wait()
				expect(calls).equals(4)
			},
			async "only the relevant properties are tracked"() {
				const state = snapstate({group: {a: 0, b: 0}})
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
				const state = snapstate({group: {a: 0}})
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
				const state = snapstate({group: {a: 0}})
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
				const state = snapstate({group: {a: 0}})
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
				const state = snapstate({group: {a: 0}})
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
		"untrack and unsubscribe all": {
			async "untrack all stops tracking"() {
				const state = snapstate({group: {a: 0}})
				let calls = 0
				state.track(readable => {
					void readable.group.a
					calls += 1
				})
				state.untrackAll()
				state.writable.group.a += 1
				await state.wait()
				expect(calls).equals(1)
			},
			async "unsubscribe all stops subscriptions"() {
				const state = snapstate({group: {a: 0}})
				let calls = 0
				state.subscribe(() => calls += 1)
				state.unsubscribeAll()
				state.writable.group.a += 1
				await state.wait()
				expect(calls).equals(0)
			},
		},
		"forbid circularities": {
			async "prevent circular subscription"() {
				const state = snapstate({a: 0})
				state.subscribe(() => state.writable.a += 1)
				state.writable.a += 1
				await expect(state.wait).throws()
			},
			async "prevent circular tracking"() {
				const state = snapstate({a: 0})
				expect(() => state.track(() => state.writable.a += 1)).throws()
			},
			async "prevent circular tracking reaction"() {
				const state = snapstate({a: 0})
				state.track(
					readable => ({a: readable.a}),
					() => state.writable.a += 1,
				)
				state.writable.a += 1
				expect(state.wait).throws()
			},
		},
		"debouncing updates": {
			async "multiple updates are debounced"() {
				const state = snapstate({group: {a: 0}})
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
				const state = snapstate({group: {a: 0, b: 0}})
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
		"subsectioning states with substate": {
			async "substate reading and writing works"() {
				const state = snapstate({group: {a: 0}})
				const group = substate(state, readable => readable.group)
				expect(group.readable.a).equals(0)
				group.writable.a += 1
				expect(group.readable.a).equals(1)
			},
			async "substate of substate reading and writing works"() {
				const state = snapstate({group: {group2: {a: 0}}})
				const group = substate(state, readable => readable.group)
				const group2 = substate(group, readable => readable.group2)
				expect(group2.readable.a).equals(0)
				group2.writable.a += 1
				expect(group2.readable.a).equals(1)
			},
			async "substate subscription works"() {
				const state = snapstate({group: {a: 0}})
				const group = substate(state, readable => {
					return readable.group
				})
				expect(group.readable.a).equals(0)
				let calls = 0
				group.subscribe(() => calls += 1)
				expect(calls).equals(0)
				group.writable.a += 1
				expect(group.readable.a).equals(1)
				await group.wait()
				expect(calls).equals(1)
			},
			async "substate subscription interacts with root state"() {
				const state = snapstate({group: {a: 0}})
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
			async "substate tracking works"() {
				const state = snapstate({group: {a: 0}})
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
			async "substate tracking interacts with root"() {
				const state = snapstate({group: {a: 0}})
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
			async "substate subscription only fires for relevant updates"() {
				const state = snapstate({a: 0, group: {b: 0}})
				const group = substate(state, readable => readable.group)
				let calls = 0
				group.subscribe(() => calls += 1)
				state.writable.a += 1
				await state.wait()
				expect(calls).equals(0)
				state.writable.group.b += 1
				await state.wait()
				expect(calls).equals(1)
			},
		},
		"nesting changes": {
			async "deeply nested property is readable, and writable"() {
				const state = snapstate({a: {b: {count: 0}}})
				expect(state.readable.a.b.count).equals(0)
				state.writable.a.b.count += 1
				expect(state.readable.a.b.count).equals(1)
			},
			async "group can be removed and replaced, property tracks still work"() {
				const state = snapstate({a: {b: {count: 0}}})
				let lastTracked = -1
				state.track(readable => lastTracked = readable.a?.b?.count)
				expect(lastTracked).equals(0)
				state.writable.a = undefined
				await state.wait()
				expect(lastTracked === undefined).equals(true)
				state.writable.a = {b: {count: 1}}
				await state.wait()
				expect(lastTracked).equals(1)
			},
		},
		"substate nesting changes": {
			async "destroyed substate group is replaced by substate write"() {
				const state = snapstate({a: {b: {count: 0}}})
				const sub = substate(state, tree => tree.a.b)
				let lastRootCount = -1
				state.track(readable => lastRootCount = readable.a.b.count)
				expect(sub.readable.count).equals(0)
				state.writable.a = undefined
				expect(sub.readable.count === undefined).equals(true)
				sub.writable.count = 1
				expect(sub.readable.count).equals(1)
				expect(state.readable.a.b.count).equals(1)
				await state.wait()
				expect(lastRootCount).equals(1)
			},
			async "replaced substate group honors substate tracking"() {
				const state = snapstate({a: {b: {count: 0}}})
				const sub = substate(state, tree => tree.a.b)
				let lastSubCount = -1
				sub.track(readable => lastSubCount = readable.count)
				state.writable.a = {b: {count: 1}}
				await sub.wait()
				expect(lastSubCount).equals(1)
			},
		},
	},
}
