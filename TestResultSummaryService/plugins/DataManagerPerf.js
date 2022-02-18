const DataManagerAggregate = require('../perf/DataManagerAggregate');
const { logger } = require('../Utils');

module.exports.onBuildDone = async (task, { testResultsDB, logger }) => {
    logger.debug(
        'DataManagerPerf: onBuildDone:',
        task.buildName,
        task.buildNum
    );
    if (task.type === 'Perf') {
        if (!task.aggregateInfo) {
            let jdkDate, javaVersion, nodeRunDate, nodeVersion;
            let aggRawMetricValuesOfChildren = {}; //aggRawMetricValuesOfChildren is a new aggregate collection used to collect all children's aggRawMetricValues
            if (task.hasChildren) {
                // parent node.
                // get all the children nodes under this parent node
                const parentId = task._id;
                const childBuildList = await testResultsDB
                    .getData({ parentId })
                    .toArray();
                // get the javaVersion and jdkDate from the first child node
                if (
                    Array.isArray(childBuildList) &&
                    childBuildList.length > 0
                ) {
                    jdkDate = childBuildList[0].jdkDate;
                    javaVersion = childBuildList[0].javaVersion;
                    nodeRunDate = childBuildList[0].nodeRunDate;
                    nodeVersion = childBuildList[0].nodeVersion;
                }
                /**
                 * loop into the child build list
                 * Example: 2 Jenkins builds:
                 * Jenkins build-1 (running 2 benchmarks with 2 iterations) in this order: Benchmark_1, Benchmark_2, Benchmark_1, Benchmark_2,
                 * Jenkins build-2 (running 2 benchmarks with 2 iterations) in this order: Benchmark_1, Benchmark_2, Benchmark_1, Benchmark_2
                 *
                 * Using the following loops to aggregate the raw datas of the above builds under different benchmarks.
                 */
                for (let childBuild of childBuildList) {
                    //loop into each child's tests array and collect its raw data collection.
                    const aggRawMetricValues =
                        DataManagerAggregate.aggDataCollect(childBuild);
                    if (
                        Array.isArray(Object.keys(aggRawMetricValues)) &&
                        Object.keys(aggRawMetricValues).length > 0
                    ) {
                        Object.keys(aggRawMetricValues).forEach(function (
                            name_variant
                        ) {
                            if (
                                Object.keys(
                                    aggRawMetricValuesOfChildren
                                ).includes(name_variant)
                            ) {
                                Object.keys(
                                    aggRawMetricValues[name_variant]
                                ).forEach(function (merics) {
                                    let value =
                                        aggRawMetricValues[name_variant][
                                            merics
                                        ];
                                    aggRawMetricValuesOfChildren[name_variant][
                                        merics
                                    ] =
                                        aggRawMetricValuesOfChildren[
                                            name_variant
                                        ][merics].concat(value);
                                });
                            } else {
                                // create a new benchmark metrics
                                aggRawMetricValuesOfChildren[name_variant] =
                                    aggRawMetricValues[name_variant];
                            }
                        });
                    }
                }
                // update aggregateInfo in the database.
                await DataManagerAggregate.updateBuildWithAggregateInfo(
                    task.hasChildren,
                    task._id,
                    testResultsDB,
                    jdkDate,
                    javaVersion,
                    nodeRunDate,
                    nodeVersion,
                    aggRawMetricValuesOfChildren
                );
            } else {
                // not a parent node.
                const aggRawMetricValues =
                    DataManagerAggregate.aggDataCollect(task);
                jdkDate = task.jdkDate;
                javaVersion = task.javaVersion;
                nodeRunDate = task.nodeRunDate;
                nodeVersion = task.nodeVersion;
                await DataManagerAggregate.updateBuildWithAggregateInfo(
                    task.hasChildren,
                    task._id,
                    testResultsDB,
                    jdkDate,
                    javaVersion,
                    nodeRunDate,
                    nodeVersion,
                    aggRawMetricValues
                );
            }
        }
    }
};
