const fs = require('fs');

// find all existing files (except index.js and README.md) under plugins folder and require them
const plugins = fs.readdirSync("./plugins").filter(file => !file.startsWith("index") && !file.startsWith("README")).map(file => {
    return require("./" + file);
});

// loop through all plugins to run the matching function
const run = async (name, args) => {
    for (let plugin of plugins) {
        if (plugin[name]) {
            await plugin[name].apply(plugin[name], args);
        }
    }
}

module.exports = {
    onBuildDone: (...args) => run("onBuildDone", args),
}