const Promise = require( 'bluebird' );
const BuildProcessor = require( './BuildProcessor' );
const BuildMonitor = require( './BuildMonitor' );
const { TestResultsDB, BuildListDB, AuditLogsDB } = require( './Database' );
const { logger } = require( './Utils' );

const elapsed = [2 * 60, 5 * 60, 30 * 60];
/*
* EventHandler processes builds that have status != Done
* Once all builds are in status Done, it delays the process based on the time in elapsed array
*/
class EventHandler {
    async processBuild() {

        let count = 0;
        // break if all builds are done for consecutively 5 queries
        while ( true ) {
            try {
                const testResults = new TestResultsDB();
                let tasks = await testResults.getData( { status: { $ne: "Done" } } ).toArray();

                if ( !tasks || tasks.length === 0 ) {
                    count++;
                } else {
                    count = 0;
                }

                for ( let task of tasks ) {
                    try {
                        const buildProcessor = new BuildProcessor();
                        await buildProcessor.execute( task );
                    } catch ( e ) {
                        logger.error( "Exception in BuildProcessor: ", e );
                        await new AuditLogsDB().insertAuditLogs({
                            action: "[exception] " + e,
                            ...task
                        });
                    }
                }
            } catch ( e ) {
                logger.error( "Exception in database query: ", e );
                await new AuditLogsDB().insertAuditLogs({
                    action: "[exception] " + e,
                    ...task
                });
            }
            const elapsedTime = elapsed[Math.min( count, elapsed.length - 1 )];
            logger.verbose( `processBuild is waiting for ${elapsedTime} sec` );
            await Promise.delay( elapsedTime * 1000 );
        }
    }

    //this function monitors build in Jenkins
    async monitorBuild() {
        while ( true ) {
            try {
                const testResults = new BuildListDB();
                const tasks = await testResults.getData().toArray();
                if ( tasks && tasks.length > 0 ) {
                    for ( let task of tasks ) {
                        try {
                            const buildMonitor = new BuildMonitor();
                            await buildMonitor.deleteOldBuilds(task);
                            await buildMonitor.deleteOldAuditLogs();
                            await buildMonitor.execute( task );
                        } catch ( e ) {
                            logger.error( "Exception in BuildMonitor: ", e );
                            await new AuditLogsDB().insertAuditLogs({
                                action: "[exception] " + e,
                                ...task
                            });
                        }
                    }
                }
            } catch ( e ) {
                logger.error( "Exception in database query: ", e );
                await new AuditLogsDB().insertAuditLogs({
                    action: "[exception] " + e,
                    ...task
                });
            }
            const elapsedTime = 15 * 60;
            logger.verbose( `monitorBuild is waiting for ${elapsedTime} sec` );
            await Promise.delay( elapsedTime * 1000 );
        } 
    }
}
module.exports = EventHandler;