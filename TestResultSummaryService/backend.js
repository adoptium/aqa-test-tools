// Accept all certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const ArgParser = require( './ArgParser' );
ArgParser.parse();

const EventHandler = require( './EventHandler' );

// running processBuild() and monitorBuild() in parallel
setTimeout(() => {
    const handler = new EventHandler();
    handler.processBuild();
    handler.monitorBuild();
}, 1 * 1000 );