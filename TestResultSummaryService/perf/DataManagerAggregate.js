const BenchmarkMath = require( './BenchmarkMathCalculation' );
const math = require('mathjs');
const ObjectID = require( 'mongodb' ).ObjectID;

class DataManagerAggregate {
    static aggDataCollect(childBuild) {
        const benchmarkMetricsCollection = {};
        let name, variant, product;
        if (Array.isArray(childBuild.tests) && childBuild.tests.length > 0 ) {
            name = childBuild.tests[0].benchmarkName;
            variant = childBuild.tests[0].benchmarkVariant;
            product = childBuild.tests[0].benchmarkProduct;
            for ( let {testData} of childBuild.tests){
                if ( Array.isArray(testData.metrics) ) {
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
        return {name, variant, product, benchmarkMetricsCollection};
    }

    static async updateBuildWithAggregateInfo(id, testResultsDB, name, variant, product, metricsCollection) {
        // calculate the aggregate data
        if (name != null && variant != null && product != null && metricsCollection != null) {
            const aggData = [];
            const aggregateInfo = [];
            Object.keys( metricsCollection ).forEach( function(key) {
                if (Array.isArray(metricsCollection[key]) && metricsCollection[key].length > 0 ){
                    const mean = math.mean(metricsCollection[key]);
                    const max = math.max(metricsCollection[key]);
                    const min = math.min(metricsCollection[key]);
                    const median = math.median(metricsCollection[key]);
                    const stddev = math.std(metricsCollection[key]);
                    const CI = BenchmarkMath.confidence_interval(metricsCollection[key]);
                    aggData.push({
                        name: key, 
                        value: { 
                            mean, max, min, median, stddev, CI,
                            validIterations: metricsCollection[key].length
                        }
                    });
                }
            })
            //add aggregate info for each node and update it in database
            aggregateInfo.push({
                benchmarkName: name,
                benchmarkVariant: variant,
                benchmarkProduct: product,
                metrics: aggData
            });
            const criteria = { _id: new ObjectID( id ) };
            const result = await testResultsDB.update( criteria, { $set: {aggregateInfo} } );    
        }
    }
}
module.exports = DataManagerAggregate;
