import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import "mocha";

chai.use(chaiAsPromised);
chai.should();

import { PeriodicDataLoader } from "../src";

describe("Basic API load call", () => {
    it("Create simple periodic data loader with identity function.", async () => {
        const pdl = new PeriodicDataLoader({ batchInterval: 100, loadFn: (keys: number[]) => Promise.resolve(keys) });
        pdl.should.be.instanceOf(PeriodicDataLoader);
    });

    it("Simple single load.", async () => {
        const pdl = new PeriodicDataLoader({ batchInterval: 100, loadFn: (keys: number[]) => Promise.resolve(keys) });
        return pdl.loadSingle(1).should.eventually.equals(1);
    });

    it("Simple multiple load.", async () => {
        const pdl = new PeriodicDataLoader({ batchInterval: 100, loadFn: (keys: number[]) => Promise.resolve(keys) });
        return pdl.loadMultiple([1, 2, 3]).should.eventually.deep.equals([1, 2, 3]);
    });

    it("When number of keys provided does not match number of values, should fail.", async () => {
        const pdl = new PeriodicDataLoader({ batchInterval: 100, loadFn: (keys: number[]) => Promise.resolve([1, 2]) });
        return pdl.loadMultiple([1, 2, 3])
            .should
            .eventually
            .rejectedWith("Number of values load function returned does not match that of keys provided.");
    });

    it("When there are failed load for multiple keys, should fail.", async () => {
        const pdl = new PeriodicDataLoader({ batchInterval: 100, loadFn: (keys: number[]) => Promise.resolve([1, 2, new Error("error")]) });
        return pdl.loadMultiple([1, 2, 3])
            .should
            .eventually
            .rejectedWith("error");
    });
});

describe("Caching", () => {
    it("Create simple periodic data loader with caching ability.", async () => {
        const pdl = new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => Promise.resolve(keys),
            cache: true,
            cacheMap: new Map<number, number>()
        });
        pdl.should.be.instanceOf(PeriodicDataLoader);
    });

    it("Creating caching enabled periodic data loader without cache map should fail.", async () => {
        (() => new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => Promise.resolve(keys),
            cache: true,
        })).should.throw(Error, "Caching is set to true, but no cache map provided.");
    });

    it("Simple caching of a single key.", async () => {
        const loadRequestedKeys: number[][] = [];
        const pdl = new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            cache: true,
            cacheMap: new Map<number, number>()
        });

        const result1 = await pdl.loadSingle(1);
        result1.should.equals(1);
        loadRequestedKeys.should.deep.equals([[1]]);

        const result2 = await pdl.loadSingle(1);
        result2.should.equals(1);
        loadRequestedKeys.should.deep.equals([[1]]);
    });

    it("Simple caching of multiple keys.", async () => {
        const loadRequestedKeys: number[][] = [];
        const pdl = new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            cache: true,
            cacheMap: new Map<number, number>()
        });

        const result1 = await pdl.loadMultiple([100, 101, 102]);
        result1.should.deep.equals([100, 101, 102]);
        loadRequestedKeys.should.deep.equals([[100, 101, 102]]);

        const result2 = await pdl.loadMultiple([100, 200]);
        result2.should.deep.equals([100, 200]);
        loadRequestedKeys.should.deep.equals([[100, 101, 102], [200]]);
    });

    it("Clearing of single cache key.", async () => {
        const loadRequestedKeys: number[][] = [];
        const pdl = new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            cache: true,
            cacheMap: new Map<number, number>()
        });

        const result1 = await pdl.loadSingle(1);
        result1.should.equals(1);
        loadRequestedKeys.should.deep.equals([[1]]);
        const result2 = await pdl.loadSingle(2);
        result2.should.equals(2);
        loadRequestedKeys.should.deep.equals([[1], [2]]);
        const result3 = await pdl.loadSingle(3);
        result3.should.equals(3);
        loadRequestedKeys.should.deep.equals([[1], [2], [3]]);

        pdl.clearCache(1);
        const result1again = await pdl.loadSingle(1);
        result1again.should.equals(1);
        loadRequestedKeys.should.deep.equals([[1], [2], [3], [1]]);
    });

    it("Clearing of multiple cache keys.", async () => {
        const loadRequestedKeys: number[][] = [];
        const pdl = new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            cache: true,
            cacheMap: new Map<number, number>()
        });

        const result1 = await pdl.loadMultiple([1, 2]);
        result1.should.deep.equals([1, 2]);
        loadRequestedKeys.should.deep.equals([[1, 2]]);
        const result2 = await pdl.loadMultiple([3, 4]);
        result2.should.deep.equals([3, 4]);
        loadRequestedKeys.should.deep.equals([[1, 2], [3, 4]]);

        pdl.clearCacheMultiple([2, 4]);
        const resultAfterCacheClearing = await pdl.loadMultiple([1, 2, 3, 4]);
        resultAfterCacheClearing.should.deep.equals([1, 2, 3, 4]);
        loadRequestedKeys.should.deep.equals([[1, 2], [3, 4], [2, 4]]);
    });

    it("Clearing of all cache keys.", async () => {
        const loadRequestedKeys: number[][] = [];
        const pdl = new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            cache: true,
            cacheMap: new Map<number, number>()
        });

        const result1 = await pdl.loadSingle(1);
        result1.should.equals(1);
        loadRequestedKeys.should.deep.equals([[1]]);
        const result2 = await pdl.loadMultiple([2, 3]);
        result2.should.deep.equals([2, 3]);
        loadRequestedKeys.should.deep.equals([[1], [2, 3]]);

        pdl.clearCacheAll();
        const resultAfterCacheClearing = await pdl.loadMultiple([1, 2, 3]);
        resultAfterCacheClearing.should.deep.equals([1, 2, 3]);
        loadRequestedKeys.should.deep.equals([[1], [2, 3], [1, 2, 3]]);
    });

    it("Clearing caches for cache disabled loader.", () => {
        const pdl = new PeriodicDataLoader({ batchInterval: 100, loadFn: (keys: number[]) => Promise.resolve(keys) });
        pdl.clearCache(1);
        pdl.clearCacheMultiple([1, 2]);
        pdl.clearCacheAll();
    });
});

describe("Unique keys only to batch load function", () => {
    it("Create simple periodic data loader with unique keys ", async () => {
        const pdl = new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => Promise.resolve(keys),
            unique: true
        });
        pdl.should.be.instanceOf(PeriodicDataLoader);
    });

    it("When number of keys provided does not match number of values, should fail.", async () => {
        const pdl = new PeriodicDataLoader({ batchInterval: 100, loadFn: (keys: number[]) => Promise.resolve([1, 2]), unique: true });
        return Promise.all([
            pdl.loadMultiple([1, 2, 3]),
            pdl.loadMultiple([2, 3, 4]),
        ]).should
            .eventually
            .rejectedWith("Number of values load function returned does not match that of keys provided.");
    });

    it("When there are failed load for multiple keys, should fail.", async () => {
        const pdl = new PeriodicDataLoader({ batchInterval: 100, loadFn: (keys: number[]) => Promise.resolve([1, 2, new Error("error"), 4]), unique: true });
        return Promise.all([
            pdl.loadMultiple([1, 2, 3]),
            pdl.loadMultiple([2, 3, 4]),
        ]).should
            .eventually
            .rejectedWith("error");
    });

    it("Single key requests with unique enabled.", async () => {
        const loadRequestedKeys: number[][] = [];
        const pdl = new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            unique: true,
        });

        const result = await Promise.all([
            pdl.loadSingle(1),
            pdl.loadSingle(2),
            pdl.loadSingle(1)
        ]);
        result.should.deep.equals([1, 2, 1]);
        loadRequestedKeys.should.deep.equals([[1, 2]]);
    });

    it("Multiple key requests with unique enabled.", async () => {
        const loadRequestedKeys: number[][] = [];
        const pdl = new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            unique: true,
        });

        const result1 = await pdl.loadMultiple([1, 2, 3])
            .then((values) => pdl.loadMultiple([2, 3, 4]))
        result1.should.deep.equals([2, 3, 4]);
        loadRequestedKeys.should.deep.equals([[1, 2, 3], [2, 3, 4]]);

        const result2 = await Promise.all([
            pdl.loadMultiple([100, 101, 102]),
            pdl.loadMultiple([102, 103, 104]),
        ]);
        result2.should.deep.equals([[100, 101, 102], [102, 103, 104]]);
        loadRequestedKeys.should.deep.equals([[1, 2, 3], [2, 3, 4], [100, 101, 102, 103, 104]]);
    });

    it("Create simple periodic data loader with caching ability and unique enabled.", async () => {
        const pdl = new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => Promise.resolve(keys),
            cache: true,
            cacheMap: new Map<number, number>(),
            unique: true,
        });
        pdl.should.be.instanceOf(PeriodicDataLoader);
    });

    it("Single key requests with unique and caching enabled.", async () => {
        const loadRequestedKeys: number[][] = [];
        const pdl = new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            cache: true,
            cacheMap: new Map<number, number>(),
            unique: true,
        });

        const result1 = await Promise.all([
            pdl.loadSingle(1),
            pdl.loadSingle(2),
            pdl.loadSingle(1)
        ]);
        result1.should.deep.equals([1, 2, 1]);
        loadRequestedKeys.should.deep.equals([[1, 2]]);

        const result2 = await Promise.all([
            pdl.loadSingle(1),
            pdl.loadSingle(3),
            pdl.loadSingle(3),
        ]);
        result2.should.deep.equals([1, 3, 3]);
        loadRequestedKeys.should.deep.equals([[1, 2], [3]]);
    });

    it("Multiple key requests with unique and caching enabled.", async () => {
        const loadRequestedKeys: number[][] = [];
        const pdl = new PeriodicDataLoader({
            batchInterval: 100,
            loadFn: (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            cache: true,
            cacheMap: new Map<number, number>(),
            unique: true,
        });

        const result1 = await Promise.all([
            pdl.loadMultiple([1, 2, 3]),
            pdl.loadMultiple([2, 3, 4]),
            pdl.loadMultiple([1, 3, 5]),
        ]);
        result1.should.deep.equals([[1, 2, 3], [2, 3, 4], [1, 3, 5]]);
        loadRequestedKeys.should.deep.equals([[1, 2, 3, 4, 5]]);

        const result2 = await Promise.all([
            pdl.loadMultiple([3, 4, 5]),
            pdl.loadMultiple([2, 4, 6]),
            pdl.loadMultiple([3, 5, 7]),
        ]);
        result2.should.deep.equals([[3, 4, 5], [2, 4, 6], [3, 5, 7]]);
        loadRequestedKeys.should.deep.equals([[1, 2, 3, 4, 5], [6, 7]]);
    });
})
