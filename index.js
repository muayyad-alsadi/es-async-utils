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
                yield items.pop();
            }
        } catch (e) {
            more = false;
            while (items.length) {
                yield items.pop();
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


