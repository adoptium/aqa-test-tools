const { TestResultsDB, OutputDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    let { buildId, searchText } = req.query;
    const testResultsDB = new TestResultsDB();
    const outputDB = new OutputDB();

    const build = await testResultsDB.getSpecificData( { _id: new ObjectID( buildId ) }, { _id: 1, buildName: 1, buildNum: 1, buildResult: 1, buildUrl: 1, type: 1, hasChildren: 1, tests: 1, buildOutputId: 1, timestamp: 1, url: 1, testSummary: 1, machine: 1 } );

    const allOutputIds = await searchOutputId( build[0] );

    const testOutputIds = await outputDB.aggregate( [
        {
            $match: 
            {
                output: { $regex: searchText, $options: 'i' },
                _id: { $in: Object.keys(allOutputIds.testOutputIds).map( entry => new ObjectID(entry) ) },
            }
        },
        {
            $project: {
                _id: 1,
            }
        },
    ] );

    const buildOutputIds = await outputDB.aggregate( [
        {
            $match: 
            {
                output: { $regex: searchText, $options: 'i' },
                _id: { $in: Object.keys(allOutputIds.buildOutputIds).map( entry => new ObjectID(entry) ) },
            }
        },
        {
            $project: {
                _id: 1,
            }
        },
    ] );
    const tests = testOutputIds.map( key => allOutputIds.testOutputIds[key._id] );

    const builds = buildOutputIds.map( key => allOutputIds.buildOutputIds[key._id] );

    const result = { tests, builds };
    res.send( result );
};

searchOutputId = async ( build ) => {

    const testResultsDB = new TestResultsDB();
    let rt = {buildOutputIds: {}, testOutputIds: {}};
    if ( build.buildOutputId ) {
        rt.buildOutputIds[build.buildOutputId] = { _id: build._id, buildName: build.buildName, buildNum: build.buildNum, buildResult: build.buildResult, buildUrl: build.buildUrl, type: build.type, hasChildren: build.hasChildren, timestamp: build.timestamp, url: build.url, testSummary: build.testSummary };
    }
    if ( !build.hasChildren ) {
        if ( build.tests ) {
            build.tests.forEach( test => {
                rt.testOutputIds[test.testOutputId] = { _id: test._id, buildName: build.buildName, buildNum: build.buildNum, buildUrl: build.buildUrl, testName: test.testName, testResult: test.testResult, duration: test.duration, machine: build.machine };
            } );
        }
    } else {
        let builds = await testResultsDB.getSpecificData( { parentId: new ObjectID( build._id ) }, { _id: 1, buildName: 1, buildNum: 1, buildResult: 1, buildUrl: 1, type: 1, hasChildren: 1, tests: 1, buildOutputId: 1, timestamp: 1, url: 1, testSummary: 1, machine: 1  } );
        await Promise.all( builds.map( async ( b ) => {
            let res = await searchOutputId(b);
            if ( res.testOutputIds ) {
                rt.testOutputIds = Object.assign( {}, rt.testOutputIds, res.testOutputIds );
            }
            if ( res.buildOutputIds ) {
                rt.buildOutputIds = Object.assign( {}, rt.buildOutputIds, res.buildOutputIds );
            }
            return b;
        } ) );
    }
    return rt;
};
