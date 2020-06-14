const ArgParser = require( './ArgParser' );
ArgParser.parse();

const express = require( 'express' );
const cors = require( 'cors' );
const app = express();
const bodyParser = require( 'body-parser' );
const routes = require( './routes' );
const compression = require( 'compression' );
const { logger } = require( './Utils' );

app.use( compression() ); // GZIP all assets
app.use( cors({credentials: true, origin: 'http://localhost:3000'}) );
app.use( bodyParser.urlencoded( { extended: true } ) ); // support encoded bodies
app.use( bodyParser.json() ); // support json encoded bodies

app.use( '/api', routes );

// all environments
app.set( 'port', process.env.PORT || 3001 );

app.listen( app.get( 'port' ), function() {
    logger.info( 'Express server listening on port ' + app.get( 'port' ) );
} );
