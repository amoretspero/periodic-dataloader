/**
 * Type for load function of periodic data loader.
 */
export type LoadFunction<TKey, TValue> = (keys: TKey[]) => Promise<Array<TValue | Error>>;

/**
 * Interface for pending key, internally used by periodic data loader.
 */
interface IPendingKey<TKey, TValue> {
    /**
     * Key of pending load.
     */
    key: TKey;

    /**
     * Resolve of pending load. Will be resolved when load is successful.
     */
    resolve: (value?: TValue | PromiseLike<TValue>) => void;

    /**
     * Reject of pending load. Will be rejected when load failed.
     */
    reject: (reason?: any) => void;
}

export type CacheMap<TKey, TValue> = Map<TKey, TValue>;

/**
 * Option interface for periodic data loader.
 */
export interface IPeriodicDataLoaderOption<TKey, TValue> {
    /**
     * Interval of single period to execute batch load function.
     */
    batchInterval: number;

    /**
     * Load function to execute.
     */
    loadFn: LoadFunction<TKey, TValue>;

    /**
     * Whether caching should be used.
     */
    cache?: boolean;

    /**
     * Cache map to use for caching.
     * 
     * Cache map should be provided when `cache` is set to `true`.
     */
    cacheMap?: CacheMap<TKey, TValue>;

    /**
     * Whether to pass unique keys only to `loadFn`.
     */
    unique?: boolean;
}

/**
 * Periodic Dataloader class.
 *
 * This dataloader executes batch load function PERIODICALLY, with period given in construction time.
 *
 * Supports single/multiple load.
 */
export class PeriodicDataLoader<TKey, TValue> {
    /**
     * Resolve-pending keys, with corresponding promises' resolve and reject.
     */
    private pendingKeys: Array<IPendingKey<TKey, TValue>> = [];

    /**
     * Interval of single period to execute batch load function.
     */
    private batchInterval: number;

    /**
     * Load function to execute.
     */
    private loadFn: LoadFunction<TKey, TValue>;

    /**
     * Last execution time of batch load function, in UNIX timestamp.
     */
    private lastExecutionTime: number;

    /**
     * Whether caching should be used.
     */
    private cache: boolean;

    /**
     * Cache map to use for caching.
     *
     * Cache map should be provided when `cache` is set to `true`.
     */
    private cacheMap: CacheMap<TKey, TValue> | undefined;

    /**
     * Whether to pass unique keys only to `loadFn`.
     */
    private unique: boolean;

    /**
     * Creates `PeriodicDataLoader` instance with given interval and batch load function.
     *
     * Constraints:
     *  1. Batch interval should be an non-negative integer, in milliseconds.
     *  2. Batch load function should return same number of values to number of keys provided.
     *  3. Each result of batch load function should be in same order with each key provided.
     * @param batchInterval Interval of single period to execute `loadFn`.
     * @param loadFn Batch load function.
     * @param cache Whether to use caching or not. When set to `true`, must provide `cacheMap`.
     * @param cacheMap Cache map to use for caching.
     * @param unique Whether to pass unique keys only to `loadFn` or not.
     */
    constructor(opts: IPeriodicDataLoaderOption<TKey, TValue>) {
        this.batchInterval = opts.batchInterval;
        this.loadFn = opts.loadFn;
        this.lastExecutionTime = Date.now();
        this.cache = opts.cache || false;
        this.cacheMap = opts.cacheMap;
        this.unique = opts.unique || false;

        if (this.cache === true) {
            if (this.cacheMap === undefined) {
                throw new Error(`Caching is set to true, but no cache map provided.`);
            }
        }
    }

    /**
     * Loads a single value.
     * @param key Key of value to load by batch load function.
     */
    public async loadSingle(key: TKey) {
        return new Promise<TValue>((resolve, reject) => {
            if (this.cache) {
                if (this.cacheMap!.has(key)) {
                    resolve(this.cacheMap!.get(key));
                    return;
                }
            }
            this.addToPendingKeys(key, resolve, reject);
        });
    }

    /**
     * Loads multiple values.
     * @param keys Keys of values to load by batch load function.
     */
    public loadMultiple(keys: TKey[]) {
        return Promise.all(keys.map((key) => this.loadSingle(key)));
    }

    /**
     * Clears cached value for given key.
     * @param key Key to clear cached value.
     */
    public clearCache(key: TKey) {
        if (this.cache) {
            this.cacheMap!.delete(key);
        }
    }

    /**
     * Clears cached values for given keys.
     * @param keys Keys to clear cached value.
     */
    public clearCacheMultiple(keys: TKey[]) {
        if (this.cache) {
            keys.forEach((key) => this.cacheMap!.delete(key));
        }
    }

    /**
     * Clears cache map when caching is used.
     */
    public clearCacheAll() {
        if (this.cache) {
            this.cacheMap!.clear();
        }
    }

    /**
     * Adds provided key, with resolve and reject to list of pending keys.
     * @param key User provided key to add.
     * @param resolve Resolve of promise corresponding to provided key.
     * @param reject Reject of promise corresponding to provided key.
     */
    private async addToPendingKeys(
        key: TKey,
        resolve: (value?: TValue | PromiseLike<TValue>) => void,
        reject: (reason?: any) => void,
    ) {
        const currentPendingKeysCount = this.pendingKeys.length;
        if (currentPendingKeysCount > 0) {
            this.pendingKeys.push({ key, resolve, reject });
        } else {
            this.pendingKeys.push({ key, resolve, reject });
            const timestamp = Date.now();
            const timeAfterLastExecution = timestamp - this.lastExecutionTime;
            const targetDelay = Math.max(this.batchInterval - timeAfterLastExecution, 0);
            setTimeout(async () => {
                if (this.unique) {
                    await this.executeUnique();
                } else {
                    await this.execute();
                }
            }, targetDelay);
        }
    }

    /**
     * Executes batch load function with keys from currently unique pending keys,
     * resolving or rejecting promise corresponding to each key.
     */
    private async executeUnique() {
        const targetPendingKeys = this.pendingKeys.splice(0);
        this.lastExecutionTime = Date.now();

        const mergedTargetPendingKeys = new Map<TKey, { key: TKey, resolves: Array<(value?: TValue | PromiseLike<TValue>) => void>, rejects: Array<(reason?: any) => void> }>();
        for (const targetPendingKey of targetPendingKeys) {
            if (mergedTargetPendingKeys.has(targetPendingKey.key)) {
                mergedTargetPendingKeys.get(targetPendingKey.key)!.resolves.push(targetPendingKey.resolve);
                mergedTargetPendingKeys.get(targetPendingKey.key)!.rejects.push(targetPendingKey.reject);
            } else {
                mergedTargetPendingKeys.set(targetPendingKey.key, { key: targetPendingKey.key, resolves: [targetPendingKey.resolve], rejects: [targetPendingKey.reject] });
            }
        }

        const targetKeys = Array.from(mergedTargetPendingKeys.keys());
        const values = await this.loadFn(targetKeys);

        if (targetKeys.length !== values.length) {
            Array.from(mergedTargetPendingKeys.values()).forEach((mtpk) => {
                mtpk.rejects.forEach((reject) => reject(new Error(`Number of values load function returned does not match that of keys provided.`)));
            });
        }

        for (let tkidx = 0; tkidx < targetKeys.length; tkidx++) {
            const targetKey = targetKeys[tkidx];
            const mergedTargetPendingKey = mergedTargetPendingKeys.get(targetKey)!;
            const value = values[tkidx];
            if (value instanceof Error) {
                mergedTargetPendingKey.rejects.forEach((reject) => reject(value));
            } else {
                if (this.cache) {
                    this.cacheMap!.set(targetKey, value);
                }
                mergedTargetPendingKey.resolves.forEach((resolve) => resolve(value));
            }
        }
    }

    /**
     * Executes batch load function with keys from currently pending keys,
     * resolving or rejecting promise corresponding to each key.
     */
    private async execute() {
        const targetPendingKeys = this.pendingKeys.splice(0);
        this.lastExecutionTime = Date.now();

        const targetKeys = targetPendingKeys.map((tpk) => tpk.key);
        const values = await this.loadFn(targetKeys);

        if (targetKeys.length !== values.length) {
            targetPendingKeys.forEach((tpk) => {
                tpk.reject(new Error(`Number of values load function returned does not match that of keys provided.`));
            });
        }

        for (let tpkidx = 0; tpkidx < targetPendingKeys.length; tpkidx++) {
            const targetPendingKey = targetPendingKeys[tpkidx];
            const value = values[tpkidx];
            if (value instanceof Error) {
                targetPendingKey.reject(value);
            } else {
                if (this.cache) {
                    this.cacheMap!.set(targetPendingKey.key, value);
                }
                targetPendingKey.resolve(value);
            }
        }
    }
}
