const ArgParser = require('./ArgParser');
ArgParser.parse();

const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const routes = require('./routes');
const compression = require('compression');
const { logger } = require('./Utils');
const expressSwagger = require('express-swagger-generator')(app);
const rateLimit = require('express-rate-limit');

app.use(compression()); // GZIP all assets
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(bodyParser.json()); // support json encoded bodies

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minutes
    max: 1000, // Limit each IP to 1000 requests per `window`
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use('/api', apiLimiter);
app.use('/api', routes);

let options = {
    swaggerDefinition: {
        info: {
            description: 'TRSS server',
            title: 'TRSS',
        },
        produces: ['application/json', 'application/xml'],
        schemes: ['http', 'https'],
        securityDefinitions: {
            JWT: {
                type: 'apiKey',
                in: 'header',
                name: 'Authorization',
                description: '',
            },
        },
    },
    basedir: __dirname, //app absolute path
    files: ['./routes/**/*.js'], //Path to the API handle folder
};
expressSwagger(options);

// all environments
app.set('port', process.env.PORT || 3001);

// Wait for MongoDB connection before starting server
const { isDbReady, getDbConnectionError } = require('./Database');

const startServer = () => {
    app.listen(app.get('port'), function () {
        logger.info('Express server listening on port ' + app.get('port'));
    });
};

// Check if DB is ready, wait up to 30 seconds
let dbCheckAttempts = 0;
const maxDbCheckAttempts = 30; // 30 seconds
const dbCheckInterval = setInterval(() => {
    dbCheckAttempts++;
    if (isDbReady()) {
        clearInterval(dbCheckInterval);
        logger.info('MongoDB connection verified. Starting Express server...');
        startServer();
    } else if (dbCheckAttempts >= maxDbCheckAttempts) {
        clearInterval(dbCheckInterval);
        const dbError = getDbConnectionError();
        if (dbError) {
            logger.error('MongoDB connection timeout. Server not starting.');
            logger.error('MongoDB connection error:', dbError.message);
            logger.error('Stack trace:', dbError.stack);
        } else {
            logger.error('MongoDB connection timeout. Database not ready after 30 seconds.');
        }
        logger.error('Express server will not start without database connection.');
        // Exit with error code
        process.exit(1);
    }
}, 1000);
