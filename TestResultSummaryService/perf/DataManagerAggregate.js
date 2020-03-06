const BenchmarkMath = require( './BenchmarkMathCalculation' );
const math = require('mathjs');
const ObjectID = require( 'mongodb' ).ObjectID;

class DataManagerAggregate {
    static aggDataCollect(childBuild) {
        let aggRawMetricValues = {};
        if (Array.isArray(childBuild.tests) && childBuild.tests.length > 0 ) {
            for ( let {benchmarkName, benchmarkVariant, testData} of childBuild.tests){
                if (benchmarkName && benchmarkVariant && testData && Array.isArray(testData.metrics) && testData.metrics.length > 0){
                    // Example: Jenkins build (running 2 benchmarks with 2 iterations) in this order: Benchmark_1, Benchmark_2, Benchmark_1, Benchmark_2.
                    let name_variant_key = benchmarkName+"&&"+benchmarkVariant;//use benchmarkName and benchmarkVariant to make a unique name_variant key
                    /**
                     * Check aggRawMetricValues JSON object and see if it could include an existing name_variant key,
                     * If yes, we should concatenate our raw value collections to the end of the existing name_variant value
                     * Otherwise, we should create a new object.
                     */
                    aggRawMetricValues[name_variant_key] = aggRawMetricValues[name_variant_key] || {};
                    for ( let {name, value} of testData.metrics ){
                        aggRawMetricValues[name_variant_key][name] = aggRawMetricValues[name_variant_key][name] || [];
                        if ( Array.isArray(value) ) {
                            aggRawMetricValues[name_variant_key][name] = aggRawMetricValues[name_variant_key][name].concat(value);
                        }
                        aggRawMetricValues[name_variant_key][name] = aggRawMetricValues[name_variant_key][name].filter (n => n);
                    }
                }
            }
        }
        return aggRawMetricValues;
    }

    static async updateBuildWithAggregateInfo(hasChildren, id, testResultsDB, jdkDate, javaVersion, nodeRunDate, nodeVersion, aggRawMetricValues) {
        // calculate the aggregate data

        /*
         * Add validAggregateInfo here as a new variable in database for saving checking time on aggregateInfo array in Perf Compare and Dashboard display, etc..
         * Expecting at least one valid metric value in the aggregateInfo, requiring all benchmarkName, benchmarkVariant, jdkDate and metrics[0] valid.
         * Also metrics[0] data should have name and all relevant data under statValues and rawValues arrays.
        */
        let validAggregateInfo = true;
        const aggregateInfo = [];
        let benchmarkName, benchmarkVariant;
        if(((jdkDate && javaVersion) || (nodeRunDate && nodeVersion)) && aggRawMetricValues && Object.keys(aggRawMetricValues).length > 0) {
            Object.keys( aggRawMetricValues ).forEach( function(name_variant)  {
                benchmarkName = name_variant.split("&&")[0];
                benchmarkVariant = name_variant.split("&&")[1];
                const metrics = [];
                let benchmarkMetricsCollection = aggRawMetricValues[name_variant];
                Object.keys( benchmarkMetricsCollection ).forEach( function(key) {
                    if (Array.isArray(benchmarkMetricsCollection[key]) && benchmarkMetricsCollection[key].length > 0 ){
                        const mean = math.round(math.mean(benchmarkMetricsCollection[key]), 3);
                        const max = math.round(math.max(benchmarkMetricsCollection[key]), 3);
                        const min = math.round(math.min(benchmarkMetricsCollection[key]), 3);
                        const median = math.round(math.median(benchmarkMetricsCollection[key]), 3);
                        const stddev = math.round(math.std(benchmarkMetricsCollection[key]), 3);
                        const CI = math.round(BenchmarkMath.confidence_interval(benchmarkMetricsCollection[key]), 3);
                        metrics.push({
                            name: key,
                            statValues: {
                                mean, max, min, median, stddev, CI,
                                validIterations: benchmarkMetricsCollection[key].length
                            },
                            rawValues: benchmarkMetricsCollection[key]
                        });
                    }
                })
                //add aggregate info for each node and update it in both parent and child node database
                aggregateInfo.push({
                    benchmarkName,
                    benchmarkVariant,
                    metrics
                });
            });
        }
        //identify if the aggregateinfo is valid, save duplicate checks in front end usage.
        if (!(Array.isArray(aggregateInfo) && aggregateInfo.length > 0)) {
            validAggregateInfo = false;
        } else {
            for(let {benchmarkName, benchmarkVariant, metrics} of aggregateInfo){
                if(!(benchmarkName && benchmarkVariant && Array.isArray(metrics) && metrics.length > 0)){
                    validAggregateInfo = false;
                } else {
                    for(let{name, statValues} of metrics) {
                        if (!(name && Object.keys(statValues).length > 0 && statValues.validIterations > 0)) {
                            validAggregateInfo = false;
                        }
                    }
                }
            }
        }
        const criteria = { _id: new ObjectID( id ) };
        await testResultsDB.update( criteria, { $set: {aggregateInfo, validAggregateInfo} } );

        //update jdkDate/nodeRunDate and javaVersion/nodeVersion for parent node in the database
        if (hasChildren){
            if (jdkDate && javaVersion) {
                await testResultsDB.update( criteria, { $set: {jdkDate, javaVersion} } );
            }
            if (nodeRunDate && nodeVersion) {
                await testResultsDB.update( criteria, { $set: {nodeRunDate, nodeVersion} } );
            }
        }
    }
}
module.exports = DataManagerAggregate;
