const ArgParser = require( './ArgParser' );
ArgParser.parse();

const express = require( 'express' );
const cors = require( 'cors' );
const app = express();
const bodyParser = require( 'body-parser' );
const routes = require( './routes' );
const compression = require( 'compression' );
const { logger } = require( './Utils' );
const expressSwagger = require('express-swagger-generator')(app);

app.use( compression() ); // GZIP all assets
app.use( cors() );
app.use( bodyParser.urlencoded( { extended: true } ) ); // support encoded bodies
app.use( bodyParser.json() ); // support json encoded bodies

app.use( '/api', routes );

let options = {
    swaggerDefinition: {
        info: {
            description: 'TRSS server',
            title: 'TRSS',
        },
        produces: [
            "application/json",
            "application/xml"
        ],
        schemes: ['http', 'https'],
        securityDefinitions: {
            JWT: {
                type: 'apiKey',
                in: 'header',
                name: 'Authorization',
                description: "",
            }
        }
    },
    basedir: __dirname, //app absolute path
    files: ['./routes/**/*.js'] //Path to the API handle folder
};
expressSwagger(options);

// all environments
app.set( 'port', process.env.PORT || 3001 );

app.listen( app.get( 'port' ), function() {
    logger.info( 'Express server listening on port ' + app.get( 'port' ) );
} );
