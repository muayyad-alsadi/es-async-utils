/**
 * chain an array of async generators as they are produced
 * @param {Array} generators
 */
export async function* chain_generators(generators) {
    const items = [];
    let more = true;
    let gen_resolve = null;
    let gen_reject = null;
    let promise;
    function tick() {
        const old_resolve = gen_resolve;
        promise = new Promise(function(resolve, reject) {
            gen_resolve = resolve;
            gen_reject = reject;
        });
        if (old_resolve) {
            old_resolve(null);
        }
    }
    tick();
    for (const gen of generators) {
        (async function() {
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
 * @param {*} ms number of millisecond
 * @returns a promise that fulfilled after the given time
 */
export function sleep(ms) {
    // eslint-disable-next-line promise/avoid-new
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * collect items from the given async generator into chunks of given size
 * @async
 * @param {number} size
 * @param {Generator} gen - the async generator
 * @param {Function} filter_cb
 * @param {Function} map_cb
 * @yields bulk form by an array of items from the given generator
 */
export async function* bulks(size, gen, filter_cb, map_cb) {
    if (!filter_cb) filter_cb = (i)=>true;
    if (!map_cb) map_cb = (i)=>i;
    let bulk=[];
    for await (const item of gen) {
        if (!filter_cb(item)) continue;
        bulk.push(map_cb(item));
        if (bulk.length>=size) {
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
 * @typedef {Object} AsyncSemaphore
 */
export class AsyncSemaphore {
    /**
     * @constructor
     * @param {number} n
     */
    constructor(n) {
        this.n = n;
        this.wait_promise = null;
        this.wait_promise_cb = null;
    }

    async acquire() {
        const self = this;
        while (self.n==0) {
            if (!self.wait_promise) {
                self.wait_promise = new Promise(function(resolve) {
                    self.wait_promise_cb = resolve;
                });
            }
            // console.log("waiting ...");
            await self.wait_promise;
            // console.log("waiting ... done");
        }
        --(self.n);
        return self.n;
    }

    release() {
        ++(this.n);
        const wait_cb = this.wait_promise_cb;
        this.wait_promise_cb = null;
        this.wait_promise = null;
        if (wait_cb) wait_cb();
    }

    /**
     * 
     * @param {*} get_promise a function that returns a promise to be wrapped
     * @returns the wrapped promise
     */
    with(get_promise) {
        const self = this;
        return self.acquire().then(()=>get_promise()).finally(()=>self.release())
    }

}


/**
 * AsyncEvent class
 * @typedef {Object} AsyncEvent
 */
export class AsyncEvent {
    /**
     * @constructor
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

    set(assert_not_set=false) {
        if (assert_not_set && this._is_set) {
            throw new Error("already set, try clear first");
        }
        this._is_set = true;
        if (this._wait_promise_cbs.length==0) return;
        let cb=this._wait_promise_cbs.shift();
        while(cb) {
            cb();
            cb=this._wait_promise_cbs.shift();
        }
    }

    wait() {
        if (this._is_set) return;
        const self = this;
        const promise = new Promise(function(resolve) {
            self._wait_promise_cbs.push(resolve);
        });
        return promise;
    }

}


/**
 * AsyncChannel class can be used to implement queues of producers and consumers
 * @typedef {Object} AsyncChannel
 */
export class AsyncChannel {
    /**
     * @constructor
     * @param {number} queue_size
     */
    constructor(queue_size=-1) {
        this.drain = false;
        this._queue = [];
        this._queue_size = queue_size;
        this._sem = null;
        this._event = new AsyncEvent();
        if(queue_size>0) {
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
        while(this._queue.length==0) {
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
        while(!this.drain || this._queue.length>0) {
            const item = await this.consume();
            yield item;
        }
    }
}