const { OutputDB, ObjectID } = require( '../Database' );
const { removeTimestamp } = require( './utils/removeTimestamp' );
const matchStrings = [
    "Unhandled exception",
];

module.exports = async ( req, res ) => {
    if (req.query.id) {
        req.query.id = new ObjectID( req.query.id );
        const outputDB = new OutputDB();
        const result = await outputDB.getData( req.query.id ).toArray();

        if (result && result.length > 0 && result[0].output){
            const output = removeTimestamp(result[0].output);

            // build regex expression based on error scenarios
            const matchRegex = new RegExp(matchStrings.join("|"));
        
            let lastLines = [];
            // search console output backward
            for (let line of output.split("\n").reverse()) {
                lastLines.push(line);
                if (line.match(matchRegex)) {
                    // return 10 lines of console output of error message
                    return res.send( {
                        output: lastLines.reverse().slice(0, 10).join('\n')
                    } );
                }
            }
        }
    }
    res.send( { output: null } );
}