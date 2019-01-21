# CHANGELOG  
  
## `v0.1.0` -> `v0.2.0`  
  
### Fixed  
- Passing unique keys only to batch load function does not work.([Github Link](https://github.com/amoretspero/periodic-dataloader/issues/1))
  - Added `unique` option to `IPeriodicDataLoaderOption`. Unique keys only feature will be enabled when `unique` is set to `true`.  
  
### Changed  
- Constructor option has been changed from 'one parameter one option' to 'single option object containing all options'.([Github Link](https://github.com/amoretspero/periodic-dataloader/issues/2))
  - See [README#options](https://github.com/amoretspero/periodic-dataloader#options)  
    
## `v0.1.0`  
  
THE INITIAL COMMIT.