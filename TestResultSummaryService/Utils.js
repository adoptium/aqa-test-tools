const winston = require('winston');
const logLevel = process.env.LOG_LEVEL || 'verbose';

const tsFormat = () => new Date().toLocaleTimeString();
const logger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            timestamp: tsFormat,
            colorize: true, // colorize the output to the console
            level: logLevel, // error|warn|info|verbose|debug|silly
        }),
    ],
});

const addCredential = (credentails, url) => {
    if (credentails) {
        for (const k in credentails) {
            if (url.startsWith(k)) {
                const user = encodeURIComponent(credentails[k].user);
                const password = encodeURIComponent(credentails[k].password);
                const tokens = url.split('://');
                if (tokens.length == 2 && user && password) {
                    return `${tokens[0]}://${user}:${password}@${tokens[1]}`;
                }
            }
        }
    }
    return url;
};

// remove ANSI escape code in Jenkins raw output
// remove everything between \x1B[8m and \x1B[0m
const removeAnsiCode = (output) => {
    return output.replace(/\x1B\[8m[\s\S]*?\x1B\[0m/g, '');
};

module.exports = { logger, addCredential, removeAnsiCode };
