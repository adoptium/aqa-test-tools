const DataManagerAggregate = require('../perf/DataManagerAggregate');

module.exports.onBuildDone = async (task, { testResultsDB, logger }) => {
    logger.debug("onBuildDone", task.buildName);
    if ( task.type === "Perf" ) {
        if ( !task.aggregateInfo ) {
            let benchmarkName, benchmarkVariant, jdkDate;
            const metricsCollection = {};
            if ( task.hasChildren ) {
                // parent node.
                const parentId = task._id;
                const childBuildList = await testResultsDB.getData({parentId}).toArray();
                //loop into the child build list
                for ( let childBuild of childBuildList ) {
                    //loop into each child's tests info.
                    const {name, variant, jdkBuildDate, benchmarkMetricsCollection} = DataManagerAggregate.aggDataCollect(childBuild)
                    if (name === null || variant === null || jdkBuildDate === null || benchmarkMetricsCollection === null ) {
                        // failed child build, continue with other children
                        continue;
                    } else {
                        if (benchmarkName === undefined && benchmarkVariant === undefined && jdkDate === undefined) {
                            benchmarkName = name;
                            benchmarkVariant = variant;
                            jdkDate = jdkBuildDate;
                        } else if ( name != benchmarkName || variant != benchmarkVariant || jdkBuildDate != jdkDate ){
                            //children's builds information are not the same
                            benchmarkName = null;
                            benchmarkVariant = null;
                            jdkDate = null;
                            metricsCollection = null;
                            break;
                        }
                        
                        // collect the raw data in the metrics.
                        Object.keys( benchmarkMetricsCollection ).forEach( function(key) {
                            metricsCollection[key] = metricsCollection[key] || [];
                            if (Array.isArray(benchmarkMetricsCollection[key])) {
                                metricsCollection[key] = metricsCollection[key].concat(benchmarkMetricsCollection[key]);
                            }
                            // remove the bad data, ie: null
                            metricsCollection[key] = metricsCollection[key].filter (n => n);
                        })
                    }
                }
                // update aggregateInfo in the database.
                await DataManagerAggregate.updateBuildWithAggregateInfo(task._id, testResultsDB, benchmarkName, benchmarkVariant, jdkDate, metricsCollection);
            } else {
                // not a parent node.
                const {name, variant, jdkBuildDate, benchmarkMetricsCollection} = DataManagerAggregate.aggDataCollect(task)
                await DataManagerAggregate.updateBuildWithAggregateInfo(task._id, testResultsDB, name, variant, jdkBuildDate, benchmarkMetricsCollection);
            }
        }
    }
}
