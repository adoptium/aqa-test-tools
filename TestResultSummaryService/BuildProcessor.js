const DataManager = require( './DataManager' );
const JenkinsInfo = require( './JenkinsInfo' );
const LogStream = require( './LogStream' );
const Parsers = require( `./parsers/` );
const ParentBuild = require( `./parsers/ParentBuild` );
const ObjectID = require( 'mongodb' ).ObjectID;
const { OutputDB } = require( './Database' );
const { logger } = require( './Utils' );

class BuildProcessor {
    async execute( task ) {
        const { url, buildName, buildNum } = task;
        const jenkinsInfo = new JenkinsInfo();
        const buildInfo = await jenkinsInfo.getBuildInfo( task.url, task.buildName, task.buildNum );

        if ( buildInfo ) {
            let output = "";
            if ( task.status === "Streaming" ) {
                let startPtr = 0;
                //if output exists, get last position from output and continue stream. Otherwise, create build.
                if ( task.buildOutputId ) {
                    const outputDB = new OutputDB();
                    const result = await outputDB.getData( { _id: new ObjectID( task.buildOutputId ) } ).toArray();

                    if ( result && result.length === 1 ) {
                        startPtr = result[0].output.length;
                        output = result[0].output;
                    } else {
                        throw new Error( "outputDB.getData cannot find match", result );
                    }
                }

                let chunk = null;
                try {
                    const logStream = new LogStream( {
                        baseUrl: url,
                        job: buildName,
                        build: buildNum,
                        pollInterval: 1 * 60 * 1000,
                    } );
                    chunk = await logStream.next( startPtr );
                } catch ( e ) {
                    logger.error( e );
                    logger.error( "Cannot get log stream ", task );
                }
                output += chunk;
                logger.debug( "startPtr", startPtr );
                logger.silly( "chunk", chunk );

                task.output = output;
                await new DataManager().updateBuildWithOutput( task );

                if ( !buildInfo.building && buildInfo.result !== null ) {
                    await new DataManager().updateBuild( {
                        _id: task._id,
                        buildDuration: buildInfo.duration,
                        buildResult: buildInfo.result,
                        buildUrl: buildInfo.url,
                        timestamp: buildInfo.timestamp,
                        status: "Done",
                    } );
                } else if ( !task.timestamp || !task.buildUrl ) {
                    await new DataManager().updateBuild( {
                        _id: task._id,
                        buildUrl: buildInfo.url,
                        timestamp: buildInfo.timestamp,
                    } );
                }
            } else if ( task.status === "NotDone" ) {
                // if the build is done, update the record in db.
                // else if no timestamp or buildUrl, update the record in db.
                // Otherwise, do nothing.
                if ( buildInfo && !buildInfo.building && buildInfo.result !== null ) {
                    task.timestamp = buildInfo.timestamp;
                    task.buildUrl = buildInfo.url;
                    task.buildDuration = buildInfo.duration;
                    task.buildResult = buildInfo.result;
                    task.status = "Done";

                    output = await jenkinsInfo.getBuildOutput( task.url, task.buildName, task.buildNum );
                    task.output = output;
                    await new DataManager().updateBuildWithOutput( task );
                } else if ( !task.timestamp || !task.buildUrl ) {
                    await new DataManager().updateBuild( {
                        _id: task._id,
                        buildUrl: buildInfo.url,
                        timestamp: buildInfo.timestamp,
                    } );
                }
            }
        } else {
            /* 
             if the build does not exist on Jenkins any more, just 
             set status to Done and store the build info
             */
            // TODO: the code can be more precise and check for error
            // that is caught in jenkinsInfo.getBuildInfo() to 
            // determine if it is a build does not exist or connection
            // issue.
            task.status = "Done";
            await new DataManager().updateBuild( task );
        }

    }
}
module.exports = BuildProcessor;