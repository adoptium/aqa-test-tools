const { TestResultsDB, OutputDB, ApplicationTestsDB, AuditLogsDB } = require( './Database' );
const ObjectID = require( 'mongodb' ).ObjectID;
const Parsers = require( `./parsers/` );
const DefaultParser = require( `./parsers/Default` );
const { logger } = require( './Utils' );
const Utils = require( './parsers/Utils' );

class DataManager {
    findParserType( buildName, output ) {
        const keys = Object.keys( Parsers );
        for ( let i = 0; i < keys.length; i++ ) {
            const type = keys[i];
            if ( Parsers[type].canParse( buildName, output ) ) {
                return type;
            }
        }
    }

    async parseOutput( buildName, output ) {
        let parserType = this.findParserType( buildName, output );
        let parser;
        if ( parserType ) {
            parser = new Parsers[parserType]( buildName );
        } else {
            parser = new DefaultParser();
            parserType = "Default";
        }
        const obj = await parser.parse( output );
        return { parserType, ...obj };
    }

    async updateOutput( data ) {
        let { id, output } = data;
        const outputDB = new OutputDB();

        //Due to 16M document size limit, only store last ~12M output
        const size = 12 * 1024 * 1024;
        if (output && output.length > size) {
            output = output.substr(-size);
        }
        if ( id ) {
            const result = await outputDB.update( { _id: new ObjectID( id ) }, { $set: { output } } );
            return id;
        } else {
            const status = await outputDB.populateDB( { output } );
            if ( status && status.insertedCount === 1 ) {
                return status.insertedIds[0];
            }
        }
        return -1;
    }

    async updateApplicationTests( data ) {
        const { testName, testData, buildName, timestamp, _id, ...newData } = data;
        if ( testData && testData.externalTestExtraData ) {
            const buildInfo = Utils.getInfoFromBuildName(buildName);
            if ( buildInfo ) {
                const appDB = new ApplicationTestsDB();
                const { dockerOS, appVersion, appName, javaVersionOutput } = testData.externalTestExtraData;
                const { jdkVersion, jdkImpl, platform } = buildInfo;
                let query = {
                    testName,
                    jdkVersion,
                    jdkImpl,
                    jdkPlatform: platform,
                    dockerOS,
                    appVersion,
                    appName,
                };
                const update = {
                    testId: _id,
                    timestamp,
                    javaVersionOutput,
                    buildName,
                    ...newData
                }
                const existingData = await appDB.getData(query).toArray();
                if ( existingData && existingData.length === 1 ) {
                    if ( timestamp > existingData.timestamp ) {
                        await appDB.update( { _id: existingData._id }, { $set: update } );
                    }
                } else if ( existingData && existingData.length > 1 ) {
                    logger.error("Detected duplicated data in Application Tests DB:", existingData);
                } else {
                    await appDB.populateDB( { ...query, ...update });
                }
            }
        }
    }

    async updateBuild( data ) {
        logger.verbose( "updateBuild", data );
        const { _id, buildName, ...newData } = data;
        const criteria = { _id: new ObjectID( _id ) };
        const testResults = new TestResultsDB();
        const result = await testResults.update( criteria, { $set: newData } );
    }

    async updateBuildWithOutput(data) {
        logger.verbose("updateBuildWithOutput", data.buildName, data.buildNum);
        const { _id, buildName, output, rootBuildId, ...newData } = data;
        const criteria = { _id: new ObjectID(_id) };
        const { builds, tests, build, ...value } = await this.parseOutput(buildName, output);
        const testResults = new TestResultsDB();
        const outputDB = new OutputDB();
        let update = {
            ...newData,
            ...value
        };
        if (!rootBuildId) {
            const rootBuildId = await testResults.getRootBuildId(_id);
            update.rootBuildId = new ObjectID(rootBuildId);
        }
        if ( builds && builds.length > 0 ) {
            let commonUrls = data.url.split("/job/")[0];
            commonUrls = commonUrls.split("/view/")[0];
            await Promise.all(builds.map( async b => {
                const childBuild = {
                    url: commonUrls + b.url,
                    buildName: b.buildName,
                    buildNameStr: b.buildNameStr,
                    buildNum: parseInt( b.buildNum, 10 ),
                    rootBuildId: rootBuildId ? rootBuildId : update.rootBuildId,
                    parentId: _id,
                    type: b.type,
                    status: "NotDone"
                };
                const id = await this.createBuild( childBuild );
                await new AuditLogsDB().insertAuditLogs({
                    _id : id,
                    url: commonUrls + b.url,
                    buildName: b.buildName,
                    buildNum: b.buildNum,
                    status: "NotDone",
                    action: "[createBuild]"
                });
            } ));

            const outputData = {
                id: data.buildOutputId ? data.buildOutputId : null,
                output,
            };
            // store output
            const outputId = await this.updateOutput( outputData );
            if ( !data.buildOutputId && outputId !== -1 ) {
                update.buildOutputId = outputId;
            }
            update.hasChildren = true;
        } else if ( tests && tests.length > 0 ) {
            const testsObj = await Promise.all( tests.map( async ( { testOutput, ...test } ) => {
                let testOutputId = null;
                if ( testOutput ) {
                    const outputData = {
                        id: null,
                        output: testOutput,
                    };
                    // store output
                    testOutputId = await this.updateOutput( outputData );
                }
                const rt = {
                    _id: new ObjectID(),
                    testOutputId,
                    ...test
                };
                await this.updateApplicationTests( { buildName, buildUrl: update.buildUrl, buildNum: update.buildNum, timestamp: update.timestamp, url: update.url, ...rt } );
                return rt;
            } ) );
            update.tests = testsObj;
            update.hasChildren = false;
        } else if ( build === null ) {
            const buildOutputId = await this.updateOutput( { id: null, output } );
            update.buildOutputId = buildOutputId;
            update.hasChildren = false;
        }
        const result = await testResults.update( criteria, { $set: update } );
    }

    // create build only if the build does not exist in database
    async createBuild( data ) {
        const { url, buildName, buildNum } = data;
        const testResults = new TestResultsDB();
        const result = await testResults.getData( { url, buildName, buildNum } ).toArray();
        if ( result && result.length === 0 ) {
            const status = await testResults.populateDB( data );
            if ( status && status.insertedCount === 1 ) {
                logger.debug( "createBuild", data.buildName, data.buildNum );
                return status.insertedIds[0];
            }
            return -1;
        }
    }
}

module.exports = DataManager;