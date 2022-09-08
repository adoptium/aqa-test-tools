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

app.listen(app.get('port'), function () {
    logger.info('Express server listening on port ' + app.get('port'));
});
