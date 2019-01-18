# Periodic Data Loader  
  
[![Build Status](https://travis-ci.com/amoretspero/periodic-data-loader.svg?branch=master)](https://travis-ci.com/amoretspero/periodic-data-loader)
[![Coverage Status](https://coveralls.io/repos/amoretspero/periodic-data-loader/badge.svg?branch=master)](https://coveralls.io/r/amoretspero/periodic-data-loader?branch=master)
  
## Brief Description  
  
**Periodic Data Loader** provides seperating data loading layer from layer that fetches data from backend service and layer which uses fetched data. As anyone can guess from the name, data loading will be done periodically, batching requests within single period. This can be useful when there are too many async/awaits or then callbacks, making it difficult to batching requests within single javascript event loop.  
  
### Logic behind periodic data loading  
  
Periodic data loader will execute batch load function periodically, while **pending keys for loader exists**. When pending keys for loader does not exist, periodic data loader will not run batch function since running it with empty array of pending keys will result in, of course, no loaded data.  
To achieve this, periodic data loader internally keeps last execution time of batch load function given. This internal data is initialized on construction of periodic data loader instance, to construction time. Every time when new key or keys are provided to periodic data loader, it will determine whether there are other pending keys exist. If there are, it will add provided new key or keys to pending keys list, and if there are none, it will calculate how many time has been passed since last execution of batch load function. If time passed is longer then period, it will execute batch load function instantly, or if not, it will execute batch load function after remaining time gap has been passed.  
By above strategy, periodic data loader can guarantee for every key passed to it, loading for that key will occur at least before given period of time after load request to periodic data loader instance.  
  
### Unique keys only to batch load function.  
  
For efficiency, periodic data loader will execute on **unique** pending keys when internally calling provided batch load function. If a same key has been provided multiple times, this should result in same key with different promises to resolve or reject. To resolve or reject them with single data, periodic data loader will calculate unique pending keys and execute batch load function with only those keys, and after that it will iterate through each key to resolve or reject all promises that corresponds to that key.  
  
### Caching  
  
Periodic data loader provides caching ability to efficiently loading data that does not change often. User must specify cache map, instance of javascript `Map<K, V>` when caching is used.  
  
---  
  
## Usage  
  
### Batch load function  
  
Periodic data loader needs a batch load function to execute periodically, which fetches data from backend service. This batch load function should take keys of data to fetch, and should return promise of values corresponding to provided keys. Plus, batch load function should return values with indices that corresponds to indices of provided keys. As code speaks itself, type of batch load function should look like below.
```typescript
/**
 * Type for load function of periodic data loader.
 */
type LoadFunction<TKey, TValue> = (keys: TKey[]) => Promise<Array<TValue | Error>>;
```  
  
### Period  
  
Periodic data loader also needs a period to execute provided batch load function. Unit is milliseconds, and value should be non-negative.

### Creating `PeriodicDataLoader` instance  
  
```typescript
import { PeriodicDataLoader } from "periodic-data-loader";

const pdl = new PeriodicDataLoader(interval, periodicLoadFunction);
```  
Just provided period of execution and batch load function to execute.  
  
### Loading data  
  
There are two method for loading data. One is for single data and the other is for multiple data.  
  
#### Loading data - single  
  
For single data load, use as follows.  
  
```typescript
const singleData = await pdl.load(123);
```  
This will load single data with key `123`.  
  
#### Loading data - multiple  
  
For multiple data loade, use as follows.  
  
```typescript
const multipleData = await pdl.load([456, 789]);
```  
This will load multiple data for keys `456` and `789`. `multipleData[0]` will contain data for key `456` and `multipleData[1]` will contain data for key `789`.  
  
### Caching  
  
Periodic data loader supports caching successfully resolved values. Those values will be cached at provided `CacheMap<TKey, TValue>` instance, which is javascript `Map<TKey, TValue>` instance. When caching is set to `true`, all values will be cached when successfully resolved. If a value or values corresponding to a key or keys should be cleared or there is a need to clear entire cache, use `clearCache(key: TKey)`, `clearCacheMultiple(keys: TKey[])` or `clearCacheAll()` method.  
  
#### Periodic data loader with cache enabled  
  
```typescript
const cacheMap = new Map<TKey, TValue>();

const pdl = new PeriodicDataLoader(interval, periodicLoadFunction, true, cacheMap);
```  
Setting `cache` parameter to `true` and providing appropriately typed cache map will enable caching.  
  
#### Clearing single cache key.  
  
```typescript
pdl.clearCache(1);
```  
This will clear cached value corresponding to key `1`.  
  
#### Clearing multiple cache keys.  
  
```typescript
pdl.clearCacheMultiple([1, 2, 3]);
```  
This will clear cached values corresponding to keys `1`, `2` and `3`.  
  
#### Clearing entire cache.  
  
```typescript
pdl.clearCacheAll();
```  
This will clear the entire cache.  
  
---  
  
## Testing  
  
Periodic data loader uses below testing tools.  
- Testing framework: [Mocha](https://mochajs.org)
- BDD assertion library: [Chai](https://www.chaijs.com/), [Chai as Promised](https://www.chaijs.com/plugins/chai-as-promised/)
- Code coverage tool: [Istanbul](https://istanbul.js.org)  
  
To test source codes
1. clone this repository - `git clone https://github.com/amoretspero/periodic-data-loader`
2. install packages - `npm i`  
3. run test command - `npm run test`  
  
---  
  
## License  
  
See [LICENSE.md](https://github.com/amoretspero/periodic-data-loader/blob/master/LICENSE.md)