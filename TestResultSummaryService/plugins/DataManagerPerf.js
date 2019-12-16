const DataManagerAggregate = require('../perf/DataManagerAggregate');
const { logger } = require( '../Utils' );


module.exports.onBuildDone = async (task, { testResultsDB, logger }) => {
    logger.debug("onBuildDone", task.buildName);
    if ( task.type === "Perf" ) {
        if ( !task.aggregateInfo ) {
            let benchmarkName, benchmarkVariant, jdkDate, javaVersion, nodeVersion, nodeRunDate;
            const metricsCollection = {};
            if ( task.hasChildren ) {// parent node.
                // get all the children nodes under this parent node
                const parentId = task._id;
                const childBuildList = await testResultsDB.getData({parentId}).toArray();
                // get the javaVersion and jdkDate from the first child node
                if ( Array.isArray(childBuildList) && childBuildList.length > 0 ) {
                    jdkDate = childBuildList[0].jdkDate;
                    javaVersion = childBuildList[0].javaVersion;
                    nodeRunDate = childBuildList[0].nodeRunDate;
                    nodeVersion = childBuildList[0].nodeVersion;
                }
                //loop into the child build list
                for ( let childBuild of childBuildList ) {
                    //loop into each child's tests info.
                    const {name, variant, benchmarkMetricsCollection} = DataManagerAggregate.aggDataCollect(childBuild)
                    if (name === null || variant === null || (javaVersion === null && !nodeVersion) || (jdkDate === null && !nodeRunDate) || benchmarkMetricsCollection === null ) {
                        // failed child build, continue with other children
                        continue;
                    } else {
                        if ( benchmarkName === undefined && benchmarkVariant === undefined ) {
                            benchmarkName = name;
                            benchmarkVariant = variant;
                        } else if ( name != benchmarkName || variant != benchmarkVariant ){
                            //children's builds information are not the same
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
                await DataManagerAggregate.updateBuildWithAggregateInfo(task.hasChildren, task._id, testResultsDB, benchmarkName, benchmarkVariant, jdkDate, javaVersion, nodeRunDate, nodeVersion, metricsCollection);
            } else {
                // not a parent node.
                const {name, variant, benchmarkMetricsCollection} = DataManagerAggregate.aggDataCollect(task)
                jdkDate = task.jdkDate;
                javaVersion = task.javaVersion;
                nodeRunDate = task.nodeRunDate;
                nodeVersion = task.nodeVersion;
                await DataManagerAggregate.updateBuildWithAggregateInfo(task.hasChildren, task._id, testResultsDB, name, variant, jdkDate, javaVersion, nodeRunDate, nodeVersion, benchmarkMetricsCollection);
            }
        }
    }
}
