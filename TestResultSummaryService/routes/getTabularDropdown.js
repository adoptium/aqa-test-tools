const { TestResultsDB, ObjectID } = require( '../Database' );
const ArgParser = require('../ArgParser');

module.exports = async ( req, res ) => {
    const db = new TestResultsDB();
    const query = {buildName: {$regex: ".*perf_.*"}};
    
    const server = ArgParser.getConfig() === undefined ? {} : ArgParser.getConfig().defaultTabularViewJenkins;
    // Get all unique buildNames, sdkResource, url from database
    const data = await db.aggregate( [
        {
            $match: query
        },
        {$unwind: "$tests"},
        {$group :
        {
          _id:0,
          buildNames: {$addToSet: '$buildName'},
          sdkResource: {$addToSet: '$sdkResource'},
          buildServer: {$addToSet: '$url'},
    }}
    ] );
    //Based on buildName convention, assume index 1 is openjdk version, index 2 is jvm type
    let jdkVersion = new Set();
    let jvmType = new Set();
    for (buildName in data[0].buildNames) {
        let buildNameSplit = data[0].buildNames[buildName].split('_');
        jdkVersion.add(buildNameSplit[1]);
        jvmType.add(buildNameSplit[2]);
    }
    // Data is an array with a single item
    data[0].jdkVersion = Array.from(jdkVersion);
    data[0].jvmType = Array.from(jvmType);

    // Make sure null is at the top of the dropdown
    data[0].sdkResource = data[0].sdkResource.filter(n => n);
    data[0].sdkResource.unshift(null);

    res.send( data[0] );

}