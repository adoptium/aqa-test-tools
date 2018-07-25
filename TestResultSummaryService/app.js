// Accept all certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const express = require( 'express' );
const cors = require( 'cors' );
const TestParser = require( `./parsers/Test` );
const app = express();
const bodyParser = require( 'body-parser' );
const routes = require( './routes' );
const compression = require( 'compression' );
const EventHandler = require( './EventHandler' );
const { logger } = require( './Utils' );

app.use( compression() ); // GZIP all assets
app.use( cors() );
app.use( bodyParser.urlencoded( { extended: true } ) ); // support encoded bodies
app.use( bodyParser.json() ); // support json encoded bodies

app.use( '/api', routes );

// all environments
app.set( 'port', process.env.PORT || 3001 );

app.listen( app.get( 'port' ), function() {
    logger.info( 'Express server listening on port ' + app.get( 'port' ) );
} );

setTimeout(() => {
    const handler = new EventHandler();
    handler.processBuild();
    handler.monitorBuild();
}, 1 * 1000 );