import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import "mocha";

chai.use(chaiAsPromised);

const should = chai.should();

import { CacheMap, LoadFunction, PeriodicDataLoader } from "../src";

describe("Basic API load call", () => {
    it("Create simple periodic data loader with identity function.", async () => {
        const pdl = new PeriodicDataLoader(100, (keys: number[]) => Promise.resolve(keys));
        pdl.should.be.instanceOf(PeriodicDataLoader);
    });

    it("Simple single load.", async () => {
        const pdl = new PeriodicDataLoader(100, (keys: number[]) => Promise.resolve(keys));
        return pdl.loadSingle(1).should.eventually.equals(1);
    });

    it("Simple multiple load.", async () => {
        const pdl = new PeriodicDataLoader(100, (keys: number[]) => Promise.resolve(keys));
        return pdl.loadMultiple([1, 2, 3]).should.eventually.deep.equals([1, 2, 3]);
    });

    it("When number of keys provided does not match number of values, should fail.", async () => {
        const pdl = new PeriodicDataLoader(100, (keys: number[]) => Promise.resolve([1, 2]));
        return pdl.loadMultiple([1, 2, 3])
            .should
            .eventually
            .rejectedWith("Number of values load function returned does not match that of keys provided.");
    });

    it("When there are failed load for multiple keys, should fail.", async () => {
        const pdl = new PeriodicDataLoader(100, (keys: number[]) => Promise.resolve([1, 2, new Error("error")]));
        return pdl.loadMultiple([1, 2, 3])
            .should
            .eventually
            .rejectedWith("error");
    });
});

describe("Caching", () => {
    it("Create simple periodic data loader with caching ability.", async () => {
        const pdl = new PeriodicDataLoader(
            100,
            (keys: number[]) => Promise.resolve(keys),
            true,
            new Map<number, number>());
        pdl.should.be.instanceOf(PeriodicDataLoader);
    });

    it("Creating caching enabled periodic data loader without cache map should fail.", async () => {
        (() => new PeriodicDataLoader(
            100,
            (keys: number[]) => Promise.resolve(keys),
            true,
        )).should.throw(Error, "Caching is set to true, but no cache map provided.");
    });

    it("Simple caching of a single key.", async () => {
        const loadRequestedKeys: number[][] = [];
        const pdl = new PeriodicDataLoader(
            100,
            (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            true,
            new Map<number, number>());

        const result1 = await pdl.loadSingle(1);
        result1.should.equals(1);
        loadRequestedKeys.should.deep.equals([[1]]);

        const result2 = await pdl.loadSingle(1);
        result2.should.equals(1);
        loadRequestedKeys.should.deep.equals([[1]]);
    });

    it("Simple caching of multiple keys.", async () => {
        const loadRequestedKeys: number[][] = [];
        const pdl = new PeriodicDataLoader(
            100,
            (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            true,
            new Map<number, number>());

        const result1 = await pdl.loadMultiple([100, 101, 102]);
        result1.should.deep.equals([100, 101, 102]);
        loadRequestedKeys.should.deep.equals([[100, 101, 102]]);

        const result2 = await pdl.loadMultiple([100, 200]);
        result2.should.deep.equals([100, 200]);
        loadRequestedKeys.should.deep.equals([[100, 101, 102], [200]]);
    });

    it("Clearing of single cache key.", async () => {
        const loadRequestedKeys: number[][] = [];
        const pdl = new PeriodicDataLoader(
            100,
            (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            true,
            new Map<number, number>());

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
        const pdl = new PeriodicDataLoader(
            100,
            (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            true,
            new Map<number, number>());

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
        const pdl = new PeriodicDataLoader(
            100,
            (keys: number[]) => {
                loadRequestedKeys.push(keys);
                return Promise.resolve(keys);
            },
            true,
            new Map<number, number>());

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
        const pdl = new PeriodicDataLoader(100, (keys: number[]) => Promise.resolve(keys));
        pdl.clearCache(1);
        pdl.clearCacheMultiple([1, 2]);
        pdl.clearCacheAll();
    });
});
