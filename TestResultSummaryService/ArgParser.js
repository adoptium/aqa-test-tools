let _config;

parse = () => {
    for (let i = 0; i < process.argv.length; i++) {
        let argv = process.argv[i];
        if (argv.startsWith('--configFile=')) {
            _config = require(argv.substring(argv.indexOf('=') + 1));
        }
    }
}

getConfig = () => {
    return _config;
}

module.exports = { parse, getConfig };