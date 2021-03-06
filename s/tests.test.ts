
import {Suite, expect} from "cynic"
import {attemptNestedProperty} from "./tools/attempt-nested-property.js"
import {obtain, restricted, snapstate, substate, symbolToAllowProxyIntoState} from "./snapstate.js"

import debounce from "./tools/debounce/debounce.test.js"

export default <Suite>{
	debounce,
	"obtain": {
		async "obtain can return a property"() {
			expect(obtain({a: 123}, ["a"])).equals(123)
		},
		async "obtain can return a nested property"() {
			expect(obtain({a: {b: 123}}, ["a", "b"])).equals(123)
			expect(obtain({a: {b: {c: 123}}}, ["a", "b", "c"])).equals(123)
			expect(obtain({a: {b: {c: {d: 123}}}}, ["a", "b", "c", "d"])).equals(123)
		},
		async "obtain returns undefined for unknown properties"() {
			expect(obtain({}, ["a"])).equals(undefined)
			expect(obtain({}, ["a", "b"])).equals(undefined)
			expect(obtain({}, ["a", "b", "c"])).equals(undefined)
			expect(obtain({}, ["a", "b", "c", "d"])).equals(undefined)
		},
	},
	"attempt nested property": {
		async "plant a property on an object"() {
			const obj: {[key: string]: boolean} = {}
			attemptNestedProperty(obj, ["a"], true)
			expect(obj.a === true).ok()
		},
		async "plant a nested property"() {
			const obj: {[key: string]: any} = {a: {}}
			attemptNestedProperty(obj, ["a", "b"], true)
			expect(obj.a.b === true).ok()
		},
		async "throw an error if object tree isn't suitable"() {
			const obj: {[key: string]: any} = {a: {}}
			obj.a = undefined
			expect(() => attemptNestedProperty(obj, ["a", "b"], true)).throws()
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
			async "arrays, maps, sets, and other objects, are preserved"() {
				const state = snapstate({
					array: [1, 2, 3],
					map: new Map(),
					set: new Set(),
				})
				expect(Array.isArray(state.readable.array)).ok()
				expect(state.readable.map instanceof Map).ok()
				expect(state.readable.set instanceof Set).ok()
				expect(state.readable.array.length).equals(3)
				expect(state.readable.array[0]).equals(1)
			},
			async "state and writable are aliases"() {
				const snap = snapstate({count: 0})
				expect(snap.readable.count).equals(0)
				snap.state.count += 1
				expect(snap.readable.count).equals(1)
			},
		},
		"proxy handling": {
			async "initial proxy with a pass is allowed into state"() {
				const state = snapstate({
					proxy: <{a: number}>new Proxy({}, {
						get(t, property: string | symbol) {
							if (property === symbolToAllowProxyIntoState) return true
							else if (property === "a") return 1
						},
					})
				})
				expect(state.readable.proxy.a).equals(1)
			},
			async "writing readable proxy into state doesn't cause stack overflow"() {
				const state = snapstate({group: {a: 1}})
				const groupProxy = state.readable.group
				state.writable.group = groupProxy
				expect(state.writable.group.a).equals(1)
			},
			async "writing a nested readable proxy into state doesn't cause stack overflow"() {
				const state = snapstate({
					group1: {
						group2: {a: 1}
					},
				})
				state.writable.group1 = {
					group2: state.readable.group1.group2,
				}
				expect(state.writable.group1.group2.a).equals(1)
			},
			async "allow proxy into state via 'allowProxy' symbol"() {
				const state = snapstate({
					group: {a: 1},
				})
				state.writable.group = new Proxy(<any>{}, {
					get(t, property: string | symbol) {
						if (property === symbolToAllowProxyIntoState) return true
						else if (property === "a") return 2
					}
				})
				expect(state.writable.group.a).equals(2)
			},
			async "readable groups are resistance to proxy rug-pulling"() {
				const state = snapstate({alpha: {bravo: {count: 123}}})
				const {bravo} = state.readable.alpha
				state.writable.alpha = undefined
				expect(bravo.count).equals(123)
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
			async "only fire trackers when property actually changes"() {
				const snap = snapstate({a: 0})
				let fired = 0
				snap.track(state => {
					void state.a
					fired += 1
				})
				expect(fired).equals(1)
				snap.state.a = 1
				await snap.wait()
				expect(fired).equals(2)
				snap.state.a = 1
				await snap.wait()
				expect(fired).equals(2)
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
				expect(state.readable.group.a).equals(1)
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
		"substate nesting changes": {
			async "unable to write changes to substate group that has been destroyed"() {
				const state = snapstate({a: {b: {count: 0}}})
				const sub = substate(state, tree => tree.a.b)
				state.writable.a = undefined
				expect(() => sub.writable.count += 1).throws()
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
		"restrictions": {
			async "restricted snap isn't writable"() {
				const snap = snapstate({a: {b: {count: 0}}})
				const rsnap = restricted(snap)
				expect((<any>rsnap).writable).not.defined()
				expect(() => rsnap.state.a.b.count += 1).throws()
			},
			async "restricted snap is readable, trackable"() {
				const snap = snapstate({a: {b: {count: 0}}})
				const rsnap = restricted(snap)
				let lastCount = -1
				rsnap.track(state => lastCount = state.a.b.count)
				expect(lastCount).equals(0)
				snap.state.a.b.count += 1
				expect(rsnap.state.a.b.count).equals(1)
				await rsnap.wait()
				expect(lastCount).equals(1)
			},
			async "restricted substate isn't writable"() {
				const snap = snapstate({a: {b: {count: 0}}})
				const sub = substate(snap, tree => tree.a)
				const rsub = restricted(sub)
				expect((<any>rsub).writable).not.defined()
				expect(() => rsub.state.b.count += 1).throws()
			},
			async "restricted substate is readable, trackable"() {
				const snap = snapstate({a: {b: {count: 0}}})
				const sub = substate(snap, tree => tree.a)
				const rsub = restricted(sub)
				let lastCount = -1
				rsub.track(state => lastCount = state.b.count)
				expect(lastCount).equals(0)
				sub.state.b.count += 1
				expect(rsub.state.b.count).equals(1)
				await rsub.wait()
				expect(lastCount).equals(1)
			},
		},
	},
}
