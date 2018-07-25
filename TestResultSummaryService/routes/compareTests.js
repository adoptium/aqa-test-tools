const { TestResultsDB } = require( '../Database' );
module.exports = async ( req, res ) => {
    let { url1, buildName1, buildNum1, testName1, ...params } = req.query;
    const fields = { _id: false, testOutput: true };

    if ( buildNum1 ) buildNum1 = parseInt( buildNum1, 10 );

    let query1 = {
        jenkinsUrl: url1,
        buildName: buildName1,
        buildNum: buildNum1,
        testName: testName1,
    }
    const data = [];
    const db = new TestResultsDB();
    const result1 = await db.getData( query1, fields ).toArray();
    query1.testOutput = result1.length === 0 ? null : result1[0].testOutput;
    data.push( query1 );

    // if second set of values is not provided, use the first set of values
    let query2 = {
        jenkinsUrl: params.url2 ? params.url2 : url1,
        buildName: params.buildName2 ? params.buildName2 : buildName1,
        buildNum: params.buildNum2 ? parseInt( params.buildNum2, 10 ) : buildNum1,
        testName: params.testName2 ? params.testName2 : testName1,
    }

    const result2 = await db.getData( query2, fields ).toArray();
    query2.testOutput = result2.length === 0 ? null : result2[0].testOutput;
    data.push( query2 );
    res.send( data );
}