declare module "index" {
    /**
     * chain an array of async generators as they are produced
     *
     * @generator
     * @function chain_generators
     * @param {Array<Generator<*>>} generators - array of generators to extract items from
     * @yields {*} items from the given generator
     */
    export function chain_generators(generators: Array<Generator<any>>): {};
    /**
     * await the returned promise to sleep the given time
     *
     * @param {number} ms number of millisecond
     * @returns {Promise} a promise that fulfilled after the given time
     */
    export function sleep(ms: number): Promise<any>;
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
    export function bulks(size: number, gen: Generator<any>, filter_cb: Function, map_cb: Function): {};
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
    export function generatorFromEvents(emitter: EventEmitter, itemEvents: Array<string>, exitEvents?: Array<string>, errorEvents?: Array<string>, includeExitItem?: boolean): {};
    /**
     * AsyncSemaphore class
     */
    export class AsyncSemaphore {
        /**
         * @class
         * @param {number} n the size of the Semaphore
         */
        constructor(n: number);
        _n: number;
        _wait_promise: any;
        _wait_promise_cb: any;
        acquire(): Promise<number>;
        release(): void;
        /**
         *
         * @param {Function} get_promise a function that returns a promise to be wrapped
         * @returns {Promise} the wrapped promise
         */
        with(get_promise: Function): Promise<any>;
    }
    /**
     * AsyncLock class
     */
    export class AsyncLock extends AsyncSemaphore {
        /**
         * @class
         */
        constructor();
    }
    /**
     * AsyncEvent class
     *
     */
    export class AsyncEvent {
        _is_set: boolean;
        _wait_promise_cbs: any[];
        clear(): void;
        set(assert_not_set?: boolean): void;
        wait(): any;
    }
    /**
     * AsyncEventAlt class - an alternative implementation
     *
     */
    export class AsyncEventAlt {
        _is_set: boolean;
        _wait_promise_cbs: any[];
        _ee: any;
        clear(): void;
        set(assert_not_set?: boolean): void;
        wait(): any;
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
        constructor(queue_size?: number);
        drain: boolean;
        _queue: any[];
        _queue_size: number;
        _sem: AsyncSemaphore;
        _event: AsyncEvent;
        push(item: any): Promise<void>;
        consume(): Promise<any>;
        consume_items(): {};
    }
}
