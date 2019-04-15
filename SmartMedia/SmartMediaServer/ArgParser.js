const fs = require('fs');
let _config;

parse = () => {
    for (let i = 0; i < process.argv.length; i++) {
        let argv = process.argv[i];
        if (argv.startsWith('--configFile=')) {
            const file = argv.substring(argv.indexOf('=') + 1);
            if (fs.existsSync(file)) {
                _config = require(file);
            } else {
                process.exit(console.error("Cannot find the config file: ", argv));
            }
        }
    }
}

getConfig = () => {
    return _config;
}

module.exports = { parse, getConfig };