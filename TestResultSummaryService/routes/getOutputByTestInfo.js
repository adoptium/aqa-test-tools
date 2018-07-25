const { TestResultsDB, OutputDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    const { url, buildName, buildNum, testName } = req.query;
    const testResultsDB = new TestResultsDB();
    const outputDB = new OutputDB();
    const data = await testResultsDB.aggregate( [
        {
            $match: {
                "url": url,
                "buildName": buildName,
                "buildNum": parseInt( buildNum, 10 ),
            }
        },
        { $unwind: "$tests" },
        {
            $match: {
                "tests.testName": testName,
            }
        },
        {
            $project: {
                tests: 1,
            }
        },
    ] );
    if ( data[0] ) {
        const result = await outputDB.getData( { _id: new ObjectID( data[0].tests.testOutputId ) } ).toArray();
        res.send( {
            output: result[0].output,
        } );
    } else {
        res.json( { output: undefined } );
    }
}