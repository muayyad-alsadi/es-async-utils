# Miscellaneous Asynchronous Generators Utilities for ECMAScript NodeJs


* `sleep` - await the returned promise to sleep the given time
* `chain_generators` - chain an array of async generators as they are produced
* `bulks` - collect items from the given async generator into chunks of given size
* `AsyncSemaphore` - resource-limiting lock
* `AsyncEvent` - 
* `AsyncChannel` - 

You can use it with [@alsadi/semaphore](https://www.npmjs.com/package/@alsadi/semaphore)

## Usage

```
npm insatall '@alsadi/async_utils'
```

and in your code

```
import {sleep, chain_generators, bulks} from '@alsadi/async_utils'
```

## Chaining async generators (possibly infinite)

If you have two infinite async generators `gen1` and `gen2` that produce items
you can consume those items as they arrive

```javascript
for await (const item of chain_generators([gen1, gen2])) {
    console.log(item);
}
```


## Collecting items from an async generator into chunks of given size

```javascript
for await (const chunk of bulks(3, gen3)) {
    console.log(chunk);
}
```

## AsyncSemaphore - resource-limiting lock

### AsyncSemaphore Background

As [Semaphores](https://man7.org/linux/man-pages/man7/sem_overview.7.html) are important to coordinate threads.
This node module gives you a similar feature for your async tasks.

A Semaphore indicates available resources to a given capacity.
When this limit is reached, it will sleep until a resource is free.

Think of it like a sound card with limited number of channels,
let's say 8 channels, in this case we have a semaphore of size 8,
when a process acquire it, there will be 7 free resources available
when another process acquire it, there will be 6 free resources available.
When all resources are taken the trial to acquire it will sleep until it's available.

### AsyncSemaphore Usage

If you have an async generator or you have a producer that generates many tasks
and you want a cheap way to limit how many pending tasks

```javascript
import {SemaphorePromise} from "@alsadi/semaphore";
// indicate that we can have 5 pending tasks
// 5 resources can be allocated without sleep
const sem = new SemaphorePromise(5);
async function main() {
    // ...
    await sem.acquire(); // this will return directly or sleep until resource is available
    const wrapped_promise=myasync_task().then(console.log).finally(()=>sem.release()); // when done a resource is available again
    // ...
}
```

you can use `sem.with(...)` to do `acquire()` and `release()` automatically.
`sem.with(...)` takes a function that returns the promise

```javascript
import {SemaphorePromise} from "@alsadi/semaphore";
// indicate that we can have 5 pending tasks
// 5 resources can be allocated without sleep
const sem = new SemaphorePromise(5);
async function main() {
    // ...
    const wrapped_promise = sem.with(function(){
        return myasync_task().then(console.log)
    });
    // ...
}
```

You can use this inside async generators


```javascript
async function *mygen() {
    while(something()) {
        yield sem.with(function(){
            return myasync_task().then(console.log)
        });
    }
}
```


### AsyncSemaphore Implementation

This implementation only uses an integer counter and a Promise with a callback
Other than that it's zero cost. It does not have busy loops or arbtrary sleeps.
The size of the semaphore does not affect its cost.

