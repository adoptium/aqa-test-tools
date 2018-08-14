const DataManager = require( './DataManager' );
const JenkinsInfo = require( './JenkinsInfo' );
const ObjectID = require( 'mongodb' ).ObjectID;
const { TestResultsDB } = require( './Database' );
const { logger } = require( './Utils' );

class BuildMonitor {
    async execute( task ) {
        let { buildUrl, type } = task;
        if ( buildUrl && type ) {
            //remove space and last /
            buildUrl = buildUrl.trim().replace( /\/$/, "" );

            let url = null;
            let buildName = null;
            let tokens = null;
            if ( buildUrl.includes( "/view/" ) ) {
                tokens = buildUrl.split( /\/view\// );
            } else if ( buildUrl.includes( "/job/" ) ) {
                tokens = buildUrl.split( /\/job\// );
            }
            if ( tokens && tokens.length == 2 ) {
                url = tokens[0];
                const strs = tokens[1].split( "/" );
                buildName = strs[strs.length - 1];

                logger.debug( "BuildMonitor: url", url, "buildName", buildName );

                const jenkinsInfo = new JenkinsInfo();
                const allBuilds = await jenkinsInfo.getAllBuilds( url, buildName );
                if ( allBuilds ) {
                    // sort the allBuilds to make sure build number is in descending order
                    allBuilds.sort(( a, b ) => parseInt(b.id) - parseInt(a.id));
                    /*
                     Loop through allBuilds or past 20 builds
                     (whichever is less) to avoid OOM error.
                     If there is not a match in db, create the new 
                     build. Otherwise, break.
                     Since allBuilds are in descending order, we assume
                     if we find a match, all remaining builds that has 
                     a lower build number is in db.
                    */
                    const limit = Math.min( 20, allBuilds.length );
                    for ( let i = 0; i < limit; i++ ) {
                        const buildNum = parseInt( allBuilds[i].id, 10 );
                        const testResults = new TestResultsDB();
                        const buildsInDB = await testResults.getData( { url, buildName, buildNum } ).toArray();
                        if ( !buildsInDB || buildsInDB.length === 0 ) {
                            let status = "NotDone";
                            // Turn off streaming
                            //if ( allBuilds[i].result === null ) {
                            //    status = "Streaming";
                            //}
                            const buildData = {
                                url,
                                buildName,
                                buildNum,
                                buildDuration: null,
                                buildResult: allBuilds[i].result ? allBuilds[i].result : null,
                                timestamp: allBuilds[i].timestamp ? allBuilds[i].timestamp : null,
                                type: type === "FVT" ? "Test" : type,
                                status,
                            };
                            await new DataManager().createBuild( buildData );
                        } else {
                            break;
                        }
                    }
                } else {
                    logger.error( "Cannot find the build ", buildUrl );
                }
            } else {
                logger.error( "Cannot parse buildUrl ", buildUrl );
            }
        } else {
            logger.error( "Invalid buildUrl and/or type", buildUrl, type );
        }
    }
}
module.exports = BuildMonitor;