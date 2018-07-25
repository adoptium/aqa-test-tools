const { TestResultsDB, OutputDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    const { id } = req.query;
    const outputDB = new OutputDB();
    const result = await outputDB.getData( { _id: new ObjectID( id ) } ).toArray();
    res.send( {
        output: result[0].output,
    } );
}