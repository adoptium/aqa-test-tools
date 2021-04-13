const { TestResultsDB, ObjectID } = require( '../Database' );

function exceedDate(jdkDate) {
    return function(element) {
    	return new Date(element.jdkDate).getTime() <= new Date(jdkDate).getTime();
    }
}


module.exports = async ( req, res ) => {
    const data = [];
    const db = new TestResultsDB();
    
    const datas = [];
    // TODO: Use available api to get build directly
    const query = {buildName: {$regex: ".*_" + req.query.jdkVersion + "_" + req.query.jvmType + ".*perf_.*"}, url: req.query.buildServer};
    
    // Get list of distinct platforms and benchmarks that match the JDK pipeline
    const platBenchList = await db.aggregate( [
        {
            $match: query
        },
        // Needed to access values inside array
        {$unwind: "$aggregateInfo"},
        {$group :
            {
                _id:0,
                buildNames: {$addToSet: '$buildName'},
                benchmarks: {$addToSet: '$aggregateInfo.benchmarkName'},
    }}
    ] );
    
    let {platforms, benchmarks} = [];
    // Error handling in case no builds are found
    if (platBenchList[0]) {
        platforms = platBenchList[0].buildNames;
        benchmarks = platBenchList[0].benchmarks;
    }
    // Extra check to return builds whose sdkResource field does not exist or is null.
    let sdkResourceQuery;
    if (req.query.sdkResource === "null") {
    	sdkResourceQuery = null;
    } else {
    	sdkResourceQuery = req.query.sdkResource;
    }
    
    for (benchmarkIndex in benchmarks) {
        let benchmarkQuery;
        // Return all entries that match the current benchmark and platform
        for (item in platforms) {
            benchmarkQuery = {$and: [{ buildName: { $regex : platforms[item]}}, {sdkResource: sdkResourceQuery}, { aggregateInfo: { $elemMatch: { benchmarkName: benchmarks[benchmarkIndex] }}}
            ] };
            const result = await db.getData(benchmarkQuery).toArray();

            // Remove all entries whose build date exceeds the chosen date
            const exceedFilter = result.filter(exceedDate(req.query.jdkDate));
            // Setting the latest build date from the available dates
            const latestDate = Math.max.apply(Math, exceedFilter.map(function(o) { return new Date(o.jdkDate); }));
            // Remove all runs that are not the latest
            const dateFilter = exceedFilter.filter(entry => new Date(entry.jdkDate).getTime() === latestDate);
            const latest = Math.max.apply(Math, dateFilter.map(function(o) { return o.timestamp; }));
            // Keep the latest build with the latest timestamp
            const latestRun = dateFilter.find(function(o){ return o.timestamp == latest; })

            if (latestRun !== undefined) {datas.push( latestRun );}
        }
    }
    // Return the list of unique pipeline names for column generation
    const buildNames = [...new Set(datas.map(item => item.buildName))];
    datas.push(buildNames);
    res.send(datas);
}
