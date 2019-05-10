// Accept all certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const EventHandler = require( './EventHandler' );

setTimeout(() => {
    const handler = new EventHandler();
    handler.processBuild();
    handler.monitorBuild();
}, 1 * 1000 );