
# 🔮 snapstate

*tiny robust state management*

`npm install @chasemoskal/snapstate`

👁️ watch for changes to observable properties  
⛹️ changes are debounced, avoiding duplicate updates  
🕵️ track only the properties you are using  
🛠️ typescript types  
💖 free and open source, just for you  

snapstate is our mobx replacement. mobx is great, but ridiculously large at like 50 KB. snapstate aims to replace mobx, but it's only a few hundred lines. when you minify and gzip it, it's probably like 1 or 2 KB.

<br/>

## using snapstate

### `readable` and `writable`

the first cool thing about snapstate, is that is separates the `readable` and `writable` access to your state.

- let's create some state.
  ```js
  import {snapstate} from "@chasemoskal/snapstate"

  const state = snapstate({
    count: 0,
    mode: "enabled",
  })
  ```
- we can read the state's properties via `readable`.
  ```js
  console.log(state.readable.count)
   //> 0
  ```
- but `readable` won't let us write those properties.
  ```js
  state.readable.count += 1
   //> ERROR! no way, bucko!
  ```
- we can write properties via `writable`.
  ```js
  state.writable.count += 1
   //> this is allowed
  ```
- this is great, because we can pass `readable` to parts of our application that should not be allowed to change the state.
- if we'd like to formalize *actions,* we can give those actions access to the `writable` state.
- this makes it easy to achieve a uni-directional dataflow for our application's state.

### tracking changes

- we can track changes to the properties we care about *(analogous to mobx's autorun)*
  ```js
  state.track(() => {
    console.log(`count changed: ${state.readable.count}`)
  })
   //> 0 -- runs once initially

  state.writable.count += 1
   //> 1

  state.writable.mode = "disabled"
   //> ~nothing happens~
   //> our track callback doesn't care about this property
  ```
- we can be more pedantic, to avoid the initial run
  ```js
  state.track(

    // listen specifically to "count"
    () => ({count: state.readable.count}),

    // responding to changes
    ({count}) => console.log(`count changed: ${count}`),
  )

  state.writable.count += 1
   //> 1
  ```
- we can also stop tracking things when we want
  ```js
  const untrack = state.track(() => console.log(count))

  state.writable.count += 1
   //> 1

  untrack()
  state.writable.count += 1
   //> *nothing happens*
  ```

### debouncing and waiting

- the updates that respond to changing state, is debounced.  
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
   //> true -- oh, okay, i just had to wait for the debouncer!
  ```

### more documentation

*coming soon, lol*
