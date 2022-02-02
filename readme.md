
<br/>

# 🔮 snapstate

*tiny robust state management*

📦 **`npm install @chasemoskal/snapstate`**

👁️ watch for changes to properties  
🕵️ track only the properties you are reading, automatically  
♻️ keeps you safe from circular updates  
⛹️ updates are debounced, avoiding duplicate updates  
🌳 carve large state trees into substates  
🧬 implemented with recursive es proxies  
🔬 typescript-native types, es modules  
💖 free and open source, just for you  

snapstate is designed to be a modern replacement for mobx. mobx was amazing, but has grown comically large at like 50 KB. snapstate is only a few hundred lines. mobx is also *global,* among other complications that we don't prefer.

<br/>

## using snapstate

<br/>

### 💾 `readable` and `writable`

- the first cool thing about snapstate, is that it separates the `readable` and `writable` access to your state. you'll soon learn why that's rad.
- let's create some state.
  ```js
  import {snapstate} from "@chasemoskal/snapstate"

  const state = snapstate({
    count: 0,
    coolmode: "enabled",
  })
  ```
- we can read the state's properties via `readable`.
  ```js
  console.log(state.readable.count)
   // 0
  ```
- but, importantly, `readable` won't let us write properties.
  ```js
  state.readable.count += 1
   // ERROR! no way, bucko!
  ```
- instead, we write properties via `writable`.
  ```js
  state.writable.count += 1
   // this is allowed

  console.log(state.readable.count)
   // 1
  ```
- this separation is great, because we can pass `readable` to parts of our application that should not be allowed to change the state. this is how we control access.
- this makes it easy to formalize *actions.* it's as easy as giving our action functions access to the `writable` state.
  ```js
  function myIncrementAction() {
    state.writable.count += 1
  }
  ```
- then we might give our frontend components the `state.readable`, and `state.track` functions.
- this makes it easy to achieve a clean uni-directional dataflow for our application's state.
- `writable` is, itself, also readable.
  ```js
  console.log(state.writable.count)
   // 1
  ```

<br/>

### 🕵️ tracking changes

- we can track changes to the properties we care about.
  ```js
  const state = snapstate({count: 0, coolmode: "enabled"})

  state.track(() => {
    console.log(`count changed: ${state.readable.count}`)
      //                                         ☝️
      //               snapstate detects this property read,
      //               and will run this tracker function
      //               whenever the property changes.
  })
   // 0 -- runs once initially

  state.writable.count += 1
   // 1 -- automatically runs the relevant tracker functions

  state.writable.coolmode = "disabled"
   // ~ nothing is logged to console ~
   // our track callback doesn't care about this property
  ```
- we can be more pedantic, with a custom tracker, to avoid the initial run.
  ```js
  const state = snapstate({count: 0, coolmode: "enabled"})

  state.track(

    // observer: listen specifically to "count"
    ({count}) => ({count}),

    // reaction: responding to changes
    ({count}) => console.log(`count changed: ${count}`),
  )

  state.writable.count += 1
   // 1
  ```
- we can also stop tracking things when we want.
  ```js
  const state = snapstate({count: 0, coolmode: "enabled"})
  const untrack = state.track(() => console.log(count))

  state.writable.count += 1
   // 1

  untrack()
  state.writable.count += 1
   // *nothing happens*
  ```

<br/>

### 🐣 nesting? *no problem!*

- we can nest our state to arbitrary depth.
  ```js
  const state = snapstate({
    group1: {
      group2: {
        data: "hello!",
      },
    },
  })
  ```
- we can track changes to properties, or groups.
  ```js
  state.track(readable => console.log(readable.group1.group2.hello))
  state.track(readable => console.log(readable.group1))
  ```

<br/>

### 👁️ subscribe to *any* change in the whole state

- your subscriptions will execute whenever any state is changed.
  ```js
  state.subscribe(readable => {
    console.log("something has changed")
  })
  ```
- of course you can unsubscribe, too.
  ```js
  const unsubscribe = state.subscribe(readable => {
    console.log("something has changed")
  })

  unsubscribe()
  ```

<br/>

### ✋ untrack and unsubscribe all

- stop all tracking
  ```js
  state.untrackAll()
  ```
- stop all subscribers
  ```js
  state.unsubscribeAll()
  ```

<br/>

### ⛹️ debouncing and waiting

- the updates that respond to changing state, is debounced.  
  this prevents consecutive updates from firing more updates than necessary.  
  because of this, you may have to `wait` before seeing the effects of your update.
  ```js
  const state = snapstate({count: 0})

  let called = false
  state.track(() => {
    called = true
  })

  state.writable.count += 1
  console.log(called)
   // false -- what the heck!?

  await state.wait()
  console.log(called)
   // true -- oh, okay -- i just had to wait for the debouncer!
  ```

<br/>

### ♻️ circular-safety

- you are prevented from writing to state while reacting to it.
- you can't make circles with track observers:
  ```js
  state.track(() => {
    state.writable.count += 1
  })
   // SnapstateCircularError -- no way, bucko!
- you can't make circles with track reactions:
  ```js
  state.track(
    ({count}) => ({count}),
    () => {
      state.writable.count += 1
    },
  )
  state.writable.count += 1
  await state.wait()
   // SnapstateCircularError -- thwarted again, buddy!
  ```
- and you can't make circles with subscriptions:
  ```js
  state.subscribe(() => state.writable.count += 1)
  state.writable.count += 1
  await state.wait()
   // SnapstateCircularError -- try again, pal!
  ```
- you can catch these async errors on `state.wait()`.

<br/>

### ✂️ substate: carve your state into subsections

- it's awkward to pass your whole application state to every little part of your app.
- so you can snip off chunks, to pass along to the components that need it.
  ```js
  import {snapstate, substate} from "@chasemoskal/snapstate"

  const state = snapstate({
    outerCount: 1,
    coolgroup: {
      innerCount: 2,
    }
  })

  const coolgroup = substate(state, tree => tree.coolgroup)

  // note: coolgroup has no access to "outerCount"
  console.log(coolgroup.readable.innerCount)
   // 2

  coolgroup.track(readable => console.log(readable.innerCount))
  coolgroup.writable.innerCount += 1
  await coolgroup.wait()
   // 3
  ```
  - a substate's `subscribe` function only listens to its subsection of the state.
  - a substate's `untrackAll` function only applies to tracking called on the subsection.
  - a substate's `unsubscribeAll` function only applies to subscriptions called on the subsection.

<br/>

### 📜 beware of arrays, maps, and other fancy objects

- snapstate only tracks when properties are written.
- what this means, is that methods like `array.push` aren't visible to snapstate:
  ```js
  const state = snapstate({myArray: []})

  // bad -- updates will not respond.
  state.writable.myArray.push("hello")
  ```
- to update an array, we must wholly replace it:
  ```js
  // good -- updates will respond.
  state.writable.myArray = [...state.writable.myArray, "hello"]
  ```
- this is an entirely survivable state of affairs, but we may eventually do the work to implement special handling for arrays, maps, sets, and other common objects. *(contributions welcome!)*

<br/>

## 💖 made with open source love

mit licensed.

please consider contributing by opening issues or pull requests.

&nbsp; // chase
