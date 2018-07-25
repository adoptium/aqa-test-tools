const winston = require( 'winston' );
const logLevel = process.env.LOG_LEVEL || 'debug';

const tsFormat = () => ( new Date() ).toLocaleTimeString();
const logger = new ( winston.Logger )( {
    transports: [
        new ( winston.transports.Console )( {
            timestamp: tsFormat,
            colorize: true, // colorize the output to the console
            level: logLevel // error|warn|info|verbose|debug|silly
        } )
    ]
} );


module.exports = { logger };