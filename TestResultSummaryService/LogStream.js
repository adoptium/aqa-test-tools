const Promise = require( 'bluebird' );
const got = require( 'got' );
const url = require( 'url' );
const { logger } = require( './Utils' );

class LogStream {
    constructor( options ) {
        const build = options.build || 'lastBuild';
        const urlParsed = url.parse( options.baseUrl + '/job/' + options.job + '/' + build + '/logText/progressiveText' );
        this.url = urlParsed.protocol + '//' + urlParsed.host + urlParsed.path;
        this.pollInterval = options.pollInterval || 5000;
        this.n = 0;
    }
    async next( startPtr ) {
        const maxNumTry = 10;
        for ( let i = 0; i < maxNumTry; i++ ) {
            try {
                const response = await got.get( this.url, {
                    followRedirect: true,
                    query: { start: startPtr },
                } );
                //this.n = response.headers['x-text-size'];
                if ( response.body.length === 0 ) {
                    await Promise.delay( this.pollInterval );
                } else {
                    return response.body;
                }
            }
            catch ( e ) {
                const message = "LogStreamError";
                logger.warn( `Try #${i + 1}: ${message} `, e );
                if ( i + 1 === maxNumTry ) {
                    throw new Error( message );
                }
                await Promise.delay( 5 * 1000 );
            }
        }
    }
}

module.exports = LogStream;