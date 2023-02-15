# Miscellaneous Asynchronous Generators Utilities for ECMAScript NodeJs


* `sleep` - await the returned promise to sleep the given time
* `chain_generators` - chain an array of async generators as they are produced
* `bulks` - collect items from the given async generator into chunks of given size

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

