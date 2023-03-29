# Miscellaneous Asynchronous Generators Utilities for ECMAScript NodeJs

-   `sleep` - await the returned promise to sleep the given time
-   `chain_generators` - collect items from multiple async generators from which
    ever comes first
-   `bulks` - collect items from the given async generator into chunks of given
    size
-   `generatorFromEvents` - convert emmited events to async generator
-   `AsyncSemaphore` - resource-limiting lock used like this
    `sem.with(async function(){do_expensive_work_here();})`
-   `AsyncLock` - behaves like normal thread lock implemented using
    AsyncSemaphore with special case of `n=1`
-   `AsyncEvent` - use `await event.wait()` which will return when `event.set()`
-   `AsyncEventAlt` - same as `AsyncEvent` implemented using
    [EventEmitter](https://nodejs.org/docs/latest-v14.x/api/events.html#events_class_eventemitter)
-   `AsyncChannel` - a queue of optionally given size that have producers
    (`await ch.push(item)`) and cosumers (`item=await ch.consume()`)

## Usage

```
npm insatall '@alsadi/async_utils'
```

and in your code

```
import {sleep, chain_generators, bulks} from '@alsadi/async_utils'
```

## Sleep

```javascript
import { sleep } from "@alsadi/async_utils";
async function main() {
    const p = sleep(5000).then(() =>
        console.log("this will appear after 5 seconds")
    );
    console.log("sleeping for 2 seconds: started ...");
    await sleep(2000);
    console.log("sleeping for 2 seconds: started done");
    console.log("3 seconds remaining: ...");
    await p;
}
main();
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

## generatorFromEvents

Node's built-in
[http server](https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener)
have events like [data](https://nodejs.org/api/net.html#event-data) on `request`

```javascript
const gen = generatorFromEvents(request, ["data"], ["end"], ["error"]);
for await (const [name, [chunk]] of gen) {
    console.log(name, chunk.length);
}
```

## AsyncSemaphore - resource-limiting lock

### AsyncSemaphore Background

As [Semaphores](https://man7.org/linux/man-pages/man7/sem_overview.7.html) are
important to coordinate threads. This node module gives you a similar feature
for your async tasks.

A Semaphore indicates available resources to a given capacity. When this limit
is reached, it will sleep until a resource is free.

Think of it like a sound card with limited number of channels, let's say 8
channels, in this case we have a semaphore of size 8, when a process acquire it,
there will be 7 free resources available when another process acquire it, there
will be 6 free resources available. When all resources are taken the trial to
acquire it will sleep until it's available.

### AsyncSemaphore Usage

If you have an async generator or you have a producer that generates many tasks
and you want a cheap way to limit how many pending tasks

```javascript
import { SemaphorePromise } from "@alsadi/semaphore";
// indicate that we can have 5 pending tasks
// 5 resources can be allocated without sleep
const sem = new SemaphorePromise(5);
async function main() {
    // ...
    await sem.acquire(); // this will return directly or sleep until resource is available
    const wrapped_promise = myasync_task()
        .then(console.log)
        .finally(() => sem.release()); // when done a resource is available again
    // ...
}
```

you can use `sem.with(...)` to do `acquire()` and `release()` automatically.
`sem.with(...)` takes a function that returns the promise

```javascript
import { SemaphorePromise } from "@alsadi/semaphore";
// indicate that we can have 5 pending tasks
// 5 resources can be allocated without sleep
const sem = new SemaphorePromise(5);
async function main() {
    // ...
    const wrapped_promise = sem.with(function () {
        return myasync_task().then(console.log);
    });
    // ...
}
```

You can use this inside async generators

```javascript
async function* mygen() {
    while (something()) {
        yield sem.with(function () {
            return myasync_task().then(console.log);
        });
    }
}
```

### AsyncSemaphore Implementation

This implementation only uses an integer counter and a Promise with a callback
Other than that it's zero cost. It does not have busy loops or arbtrary sleeps.
The size of the semaphore does not affect its cost.

## AsyncLock - classical lock behavior

```javascript
import { sleep, AsyncLock } from "./index.js";

const lock = new AsyncLock();

async function main() {
    const result = await lock.with(my_async_function);
    const result = await lock.with(() => do_something()); // do_something() returns a promise
    const result = await lock.with(async function () {
        await do_something();
    });
}
```

## AsyncEvent

```javascript
async function main() {
    const event = new AsyncEvent();
    // somewhere event will be set
    sleep(5000).then(() => event.set());
    await event.wait();
}
```

## AsyncChannel - a queue of optionally given size that have producers and cosumers

You can pass an optional queue size, otherwise queue will be unlimited.

```javascript
const queue_size = 7;
const ch = new AsyncChannel(queue_size);
```

when you push to the queue you must use await because if queue size limit, push
will sleep until consumers do their work

```javascript
async function producer(name) {
    for (let i = 0; i < 10; ++i) {
        await ch.push(`${name}-${i}`);
    }
}
p = [];
p.push(producer("my-producer1"));
p.push(producer("my-producer2"));
await Promise.all(p);
```

items in queue are consumed like this

```javascript
while (true) {
    const item = await ch.consume();
    await do_something(item);
}
```

you can use async generators like this

```javascript
async my_consumer() {
    for await (const item of ch.consume_items()) {
        await do_something(item);
    }
}
c=[]
c.push(my_consumer());
c.push(my_consumer());
c.push(my_consumer());
await Promise.all(c);
```

you can run multiple consumers and producers
