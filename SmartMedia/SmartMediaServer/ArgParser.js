const fs = require('fs');
const Twitter = require('twitter');
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

getGitConfig = () => {
    if ((_config.git) && (_config.git.token)) {
        return _config.git.token;
    } else {
        process.exit(console.error( "Cannot get cline git token, need to modify mediaConf.json"));
    }
}

getTwitterConfig = () => {
    if ((_config.twitter) && (_config.twitter.consumer_key) && (_config.twitter.consumer_secret) && (_config.twitter.access_token_key) && (_config.twitter.access_token_secret)) {
            return new Twitter (_config.twitter);
    } else {
        process.exit(console.error("Cannot get client twitter token, need to modify mediaConf.json"));
    }
}

module.exports = { parse, getConfig, getGitConfig, getTwitterConfig };