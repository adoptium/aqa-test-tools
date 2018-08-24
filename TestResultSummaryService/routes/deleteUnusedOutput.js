const { TestResultsDB, OutputDB } = require( '../Database' );

/*
 * This API deletes all orphan outputs that do not have reference in 
 * testResults collection. That is, _id output does not match any
 * testOutputId or buildOutputId in testResults.
 * 
 * This API should only be used for DB clean up purpose only.
 */
module.exports = async ( req, res ) => {
    const results = await ( new TestResultsDB().getData( {} ).toArray() );

    // concat all testOutputId and buildOutputId into an array and remove null
    const outputs = [].concat( ...results.map( result => {
        let res = [];
        if ( result.tests ) {
            res = result.tests.map( test => {
                return test.testOutputId;
            } );
        }
        if ( result.buildOutputId ) {
            res.push( result.buildOutputId );
        }
        return res;
    } ) ).filter( v => !!v );

    // delete all outputs that are not in outputs array
    const response = await new OutputDB().deleteMany( { '_id': { '$nin': outputs } } );

    res.json( response );
}