const { TestResultsDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    const { url, buildName, buildNum } = req.query;
    const testResultsDB = new TestResultsDB();

    const data = await testResultsDB.aggregate( [
        {
            $match: {
                "url": url,
                "buildName": buildName,
                "buildNum": parseInt( buildNum, 10 ),
            }
        },
    ] );

    if ( data[0] ) {
        res.json( {
            testInfo: data,
        } );
    } else {
        res.json( { testInfo: undefined } );
    }
}