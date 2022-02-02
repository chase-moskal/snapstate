
<br/>

# 🔮 snapstate

*tiny robust state management*

`npm install @chasemoskal/snapstate`

👁️ watch for changes to properties  
🕵️ track only the properties you are reading, automatically  
♻️ keeps you safe from circular references  
⛹️ updates are debounced, avoiding duplicate updates  
🎛️ implemented with recursive es proxies  
🔬 typescript-native types  
💖 free and open source, just for you  

snapstate is our mobx replacement. mobx is great, but ridiculously large at like 50 KB. not even sure how they achieved that. snapstate aims to replace mobx, but it's only a few hundred lines. when you minify and gzip it, it's probably like 1 or 2 KB.

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
  state.track(() => {
    console.log(`count changed: ${state.readable.count}`)
      //                                         ☝️
      //              (snapstate detects this property read)
  })
   // 0 -- runs once initially

  state.writable.count += 1
   // 1

  state.writable.coolmode = "disabled"
   // ~ nothing happens ~
   // our track callback doesn't care about this property
  ```
- we can be more pedantic, with a custom tracker, to avoid the initial run.
  ```js
  state.track(

    // observer: listen specifically to "count"
    ({count}) => ({count}),

    // reaction: responding to changes
    ({count}) => console.log(`count changed: ${count}`),
  )

  state.writable.count += 1
   //> 1
  ```
- we can also stop tracking things when we want.
  ```js
  const untrack = state.track(() => console.log(count))

  state.writable.count += 1
   //> 1

  untrack()
  state.writable.count += 1
   //> *nothing happens*
  ```

<br/>

### 🐣 nesting? *no problem!*

- we can nest our state to arbitrary depth.
  ```js
  const deepstate = snapstate({
    group1: {
      group2: {
        data: "hello!",
      },
    },
  })
  ```
- we can track changes to properties, or groups.
  ```js
  deepstate.track(readable => console.log(readable.group1.group2.hello))
  deepstate.track(readable => console.log(readable.group1))
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
   //> false -- what the heck!?

  await state.wait()
  console.log(called)
   //> true -- oh, okay -- i just had to wait for the debouncer!
  ```

<br/>

### ♻️ circular-safety

- you are prevented from writing to state while reacting to it.
- you can catch these errors on `state.wait()`.
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

<br/>

### ✂️ substate: carve your state into subsections

- it's awkward to pass your whole application state to every part of your app.
- so you can snip off chunks, to pass along to the components that need it.
  ```js
  import {snapstate, substate} from "@chasemoskal/snapstate"

  const state = snapstate({
    count: 1,
    coolgroup: {
      innerCount: 2,
    }
  })

  const coolgroup = substate(state, tree => tree.coolgroup)

  // coolgroup has no access to "count"
  console.log(coolgroup.readable.innerCount)
   // 2

  coolgroup.track(readable => console.log(readable.innerCount))
  coolgroup.writable.innerCount += 1
  await coolgroup.wait()
   // 3
  ```

<br/>

## 💖 made with open source love

mit licensed.

please consider contributing by opening issues or pull requests.

&nbsp; // chase
