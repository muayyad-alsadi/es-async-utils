import { EventEmitter } from "events";

/**
 * chain an array of async generators as they are produced
 *
 * @generator
 * @function chain_generators
 * @param {Array<Generator<*>>} generators - array of generators to extract items from
 * @yields {*} items from the given generator
 */
export async function* chain_generators(generators) {
    const items = [];
    let more = true;
    let gen_resolve = null;
    let gen_reject = null;
    let promise;
    /**
     *
     */
    function tick() {
        const old_resolve = gen_resolve;
        promise = new Promise(function (resolve, reject) {
            gen_resolve = resolve;
            gen_reject = reject;
        });
        if (old_resolve) {
            old_resolve(null);
        }
    }
    tick();
    for (const gen of generators) {
        (async function () {
            try {
                for await (const item of gen) {
                    items.push(item);
                    if (gen_resolve) tick();
                }
            } catch (e) {
                gen_reject(e);
            }
        })();
    }
    while (more) {
        try {
            await promise;
            while (items.length) {
                yield items.shift();
            }
        } catch (e) {
            more = false;
            while (items.length) {
                yield items.shift();
            }
            throw e;
        }
    }
}

/**
 * await the returned promise to sleep the given time
 *
 * @param {number} ms number of millisecond
 * @returns {Promise} a promise that fulfilled after the given time
 */
export function sleep(ms) {
    // eslint-disable-next-line promise/avoid-new
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * collect items from the given async generator into chunks of given size
 *
 * @async
 * @param {number} size - bulk size
 * @param {Generator<*>} gen - the async generator
 * @param {Function} filter_cb - filter callback
 * @param {Function} map_cb - mapper callback
 * @yields {Array<*>} bulk form by an array of items from the given generator
 */
export async function* bulks(size, gen, filter_cb, map_cb) {
    if (!filter_cb) filter_cb = () => true;
    if (!map_cb) map_cb = (i) => i;
    let bulk = [];
    for await (const item of gen) {
        if (!filter_cb(item)) continue;
        bulk.push(map_cb(item));
        if (bulk.length >= size) {
            yield bulk;
            bulk = [];
        }
    }
    if (bulk.length) {
        yield bulk;
        bulk = [];
    }
}

/**
 * AsyncSemaphore class
 */
export class AsyncSemaphore {
    /**
     * @class
     * @param {number} n the size of the Semaphore
     */
    constructor(n) {
        this._n = n;
        this._wait_promise = null;
        this._wait_promise_cb = null;
    }

    async acquire() {
        const self = this;
        while (self._n == 0) {
            if (!self._wait_promise) {
                self._wait_promise = new Promise(function (resolve) {
                    self._wait_promise_cb = resolve;
                });
            }
            // console.log("waiting ...");
            await self._wait_promise;
            // console.log("waiting ... done");
        }
        --self._n;
        return self._n;
    }

    release() {
        ++this._n;
        const wait_cb = this._wait_promise_cb;
        this._wait_promise_cb = null;
        this._wait_promise = null;
        if (wait_cb) wait_cb();
    }

    /**
     *
     * @param {Function} get_promise a function that returns a promise to be wrapped
     * @returns {Promise} the wrapped promise
     */
    with(get_promise) {
        const self = this;
        return self
            .acquire()
            .then(() => get_promise())
            .finally(() => self.release());
    }
}

/**
 * AsyncLock class
 */
export class AsyncLock extends AsyncSemaphore {
    /**
     * @class
     */
    constructor() {
        super(1);
    }
}

/**
 * AsyncEvent class
 *
 */
export class AsyncEvent {
    /**
     * @class
     */
    constructor() {
        this._is_set = false;
        this._wait_promise_cbs = [];
    }

    clear() {
        if (!this._is_set) return; // already clear
        if (this._is_set && this._wait_promise_cbs.length) {
            throw new Error("clearning a dirty event with pending waits");
        }
        this._is_set = false;
    }

    set(assert_not_set = false) {
        if (assert_not_set && this._is_set) {
            throw new Error("already set, try clear first");
        }
        this._is_set = true;
        if (this._wait_promise_cbs.length == 0) return;
        let cb = this._wait_promise_cbs.shift();
        while (cb) {
            cb();
            cb = this._wait_promise_cbs.shift();
        }
    }

    wait() {
        if (this._is_set) return;
        const self = this;
        const promise = new Promise(function (resolve) {
            self._wait_promise_cbs.push(resolve);
        });
        return promise;
    }
}

/**
 * AsyncEventAlt class - an alternative implementation
 *
 */
export class AsyncEventAlt {
    /**
     * @class
     */
    constructor() {
        this._is_set = false;
        this._wait_promise_cbs = [];
        this._ee = new EventEmitter();
        this._ee.setMaxListeners(0);
    }

    clear() {
        if (!this._is_set) return; // already clear
        if (this._is_set && this._wait_promise_cbs.length) {
            throw new Error("clearning a dirty event with pending waits");
        }
        this._is_set = false;
    }

    set(assert_not_set = false) {
        if (assert_not_set && this._is_set) {
            throw new Error("already set, try clear first");
        }
        this._is_set = true;
        this._ee.emit("set");
    }

    wait() {
        if (this._is_set) return;
        const self = this;
        const promise = new Promise(function (resolve) {
            self._ee.on("set", function () {
                resolve();
            });
        });
        return promise;
    }
}

/**
 * AsyncChannel class can be used to implement queues of producers and consumers
 *
 */
export class AsyncChannel {
    /**
     * @class
     * @param {number} queue_size - size of the queue
     */
    constructor(queue_size = -1) {
        this.drain = false;
        this._queue = [];
        this._queue_size = queue_size;
        this._sem = null;
        this._event = new AsyncEvent();
        if (queue_size > 0) {
            this._sem = new AsyncSemaphore(queue_size);
        }
    }
    async push(item) {
        if (this._sem) {
            // console.log("sem n:", this._sem.n);
            await this._sem.acquire();
            // console.log("sem n:", this._sem.n);
        }
        this._queue.push(item);
        this._event.set();
    }

    async consume() {
        // console.log("waiting: ...");
        while (this._queue.length == 0) {
            // console.log(`waiting: ${this._queue.length}`);
            this._event.clear();
            await this._event.wait();
            // console.log(`waiting: ${this._queue.length} done inside`);
        }
        // console.log(`waiting: ${this._queue.length}: while done`);
        const item = this._queue.shift();
        if (this._sem) {
            // console.log("sem n:", this._sem.n);
            this._sem.release();
        }
        return item;
    }

    async *consume_items() {
        while (!this.drain || this._queue.length > 0) {
            const item = await this.consume();
            yield item;
        }
    }
}

/**
 * convert events comming from an emitter into into async generator
 * used like this
 * for await ([event_name, item_args] of generatorFromEvents(ev, ['event1'], ['close'], ['error']) {}
 *
 * @param {EventEmitter} emitter - the event emitter to be converted to generator
 * @param {Array<string>} itemEvents - list of item event names
 * @param {Array<string>} exitEvents - list of exit event names
 * @param {Array<string>} errorEvents - list of error event names
 * @param {boolean} includeExitItem - should include the exit event in items
 * @yields {Array} - yields [event_name, event_args]
 */
export async function* generatorFromEvents(
    emitter,
    itemEvents,
    exitEvents = null,
    errorEvents = null,
    includeExitItem = false
) {
    const items = [];
    let item_resolve;
    let item_promise = new Promise((resolve) => (item_resolve = resolve));
    let exit_resolve;
    const exit_promise = new Promise((resolve) => (exit_resolve = resolve));
    let error_resolve;
    const error_promise = new Promise((resolve) => (error_resolve = resolve));

    /**
     * internal function
     * 
     * @param {*} arg - item
     */
    function cb_item(arg) {
        items.push(arg);
        item_resolve(arg);
        item_promise.done = true;
        item_promise = new Promise((resolve) => (item_resolve = resolve));
    }
    /**
     * internal function
     * 
     * @param {*} arg - item
     */
    function cb_exit(arg) {
        exit_resolve(arg);
        exit_promise.done = true;
    }
    /**
     * internal function
     * 
     * @param {*} arg - item
     */
    function cb_error(arg) {
        error_resolve(arg);
        error_promise.done = true;
    }
    for (const name of itemEvents) {
        emitter.on(name, (...args) => cb_item([name, args]));
    }
    for (const name of exitEvents) {
        emitter.on(name, (...args) => cb_exit([name, args]));
    }
    for (const name of errorEvents) {
        emitter.on(name, (...args) => cb_error([name, args]));
    }
    let has_more = true;
    while (has_more) {
        await Promise.race([item_promise, exit_promise, error_promise]);
        while (items.length) {
            yield items.shift();
        }
        if (error_promise.done) {
            const [name, args] = await error_promise;
            has_more = false;
            if (
                args &&
                args.length &&
                args.length >= 1 &&
                args[0] instanceof Error
            ) {
                const error = args[0];
                error.event_name = name;
                throw error;
            }
            const error = new Error("error event");
            error.event_name = name;
            error.event_args = args;
            throw error;
        }
        if (exit_promise.done) {
            const item = await exit_promise;
            has_more = false;
            if (includeExitItem) yield item;
            break;
        }
    }
}
