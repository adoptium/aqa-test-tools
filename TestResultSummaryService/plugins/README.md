
# Plugins

Users can create their own plugins. The plugin files can be added under `plugins` folder or they can be stored in another repo. The program will try to find all available files under `plugins` folder at runtime.

Below is the format of the plugin. For detail, please see `examplePlugin.js`

```
module.exports.onBuildDone = async (task, { testResultsDB, logger }) => {
	...
}

```

## Available functions

`onBuildDone` -  it will be invoked when the status of the build is `Done`.