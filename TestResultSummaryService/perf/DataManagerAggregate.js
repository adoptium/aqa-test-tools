const BenchmarkMath = require( './BenchmarkMathCalculation' );
const math = require('mathjs');
const ObjectID = require( 'mongodb' ).ObjectID;

class DataManagerAggregate {
    static aggDataCollect(childBuild) {
        const benchmarkMetricsCollection = {};
        let name, variant;
        if (Array.isArray(childBuild.tests) && childBuild.tests.length > 0 ) {
            for ( let {benchmarkName, benchmarkVariant, testData} of childBuild.tests){
                //define the first time benchmarkName and benchmarkVariant for name, variant.
                if (benchmarkName && benchmarkVariant && !name && !variant) {
                    name = benchmarkName;
                    variant = benchmarkVariant;
                }
                if ( benchmarkName === name && benchmarkVariant === variant && testData && Array.isArray(testData.metrics) ) {
                    for ( let {name, value} of testData.metrics ){
                        benchmarkMetricsCollection[name] = benchmarkMetricsCollection[name] || [];
                        if ( Array.isArray(value) ) {
                            benchmarkMetricsCollection[name] = benchmarkMetricsCollection[name].concat(value);
                        }
                        benchmarkMetricsCollection[name] = benchmarkMetricsCollection[name].filter (n => n);
                    }
                }
            }
        }
        return {name, variant, benchmarkMetricsCollection};
    }

    static async updateBuildWithAggregateInfo(hasChildren, id, testResultsDB, benchmarkName, benchmarkVariant, jdkDate, javaVersion, nodeRunDate, nodeVersion, metricsCollection) {
        // calculate the aggregate data
        
        /* added validAggregateInfo as a new variable in database for saving the checking time on aggregateInfo array in Perf Compare and Dashboard display, etc..
         * Expecting at least one valid metric value in the aggregateInfo, requiring all benchmarkName, benchmarkVariant, jdkDate and metrics[0]. 
         * Also metrics[0] data should have name and all relevant data under value array such as mean, max and statistical info.
        */
           let validAggregateInfo = false;
        const aggregateInfo = [];
        if (benchmarkName && benchmarkVariant && ((nodeRunDate && nodeVersion )|| (javaVersion && jdkDate)) && metricsCollection) {
            const aggData = [];
            Object.keys( metricsCollection ).forEach( function(key) {
                if (Array.isArray(metricsCollection[key]) && metricsCollection[key].length > 0 ){
                    const mean = math.round(math.mean(metricsCollection[key]), 3);
                    const max = math.round(math.max(metricsCollection[key]), 3);
                    const min = math.round(math.min(metricsCollection[key]), 3);
                    const median = math.round(math.median(metricsCollection[key]), 3);
                    const stddev = math.round(math.std(metricsCollection[key]), 3);
                    const CI = math.round(BenchmarkMath.confidence_interval(metricsCollection[key]), 3);
                    aggData.push({
                        name: key, 
                        value: { 
                            mean, max, min, median, stddev, CI,
                            validIterations: metricsCollection[key].length
                        }
                    });
                    validAggregateInfo = true;
                }
            })
            //add aggregate info for each node and update it in both parent and child node database
            aggregateInfo.push({
                benchmarkName,
                benchmarkVariant,
                metrics: aggData
            });
        }
        const criteria = { _id: new ObjectID( id ) };
        //update jdkDate and javaVersion for parent node in the database 
        if (hasChildren) {
            await testResultsDB.update( criteria, { $set: {aggregateInfo , validAggregateInfo , jdkDate , javaVersion , nodeRunDate , nodeVersion}} );
        } else {
            await testResultsDB.update( criteria, { $set: {aggregateInfo, validAggregateInfo}} );
        }
    }
}
module.exports = DataManagerAggregate;
