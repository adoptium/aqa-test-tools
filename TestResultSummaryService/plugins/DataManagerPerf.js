const ObjectID = require( 'mongodb' ).ObjectID;
const BenchmarkMath = require( '../perf/BenchmarkMathCalculation' );
const math = require('mathjs');

module.exports.onBuildDone = async (task, { testResultsDB, logger }) => {
    logger.debug("onBuildDone", task.buildName);
    if ( task.hasChildren ) {
        const parentId = task._id;
        const childBuildList = await testResultsDB.getData({parentId}).toArray();
        if ( childBuildList && childBuildList.length > 0 ) {
            const parentAggregationStructure = [];
            let benchmarkName, benchmarkVariant, benchmarkProduct;
            const childrenAggData = [];
            const metricsCollection = {};
            //loop into the child build list
            for ( let j = 0; j < childBuildList.length; j++ ) {
                if (childBuildList[j].aggregateInfo && childBuildList[j].aggregateInfo.length > 0) {
                    //loop into the each child's aggregate info.
                    for (let k = 0 ; k < childBuildList[j].aggregateInfo.length; k++){
                        benchmarkName = childBuildList[j].aggregateInfo[k].benchmarkName;
                        benchmarkVariant = childBuildList[j].aggregateInfo[k].benchmarkVariant;
                        benchmarkProduct = childBuildList[j].aggregateInfo[k].benchmarkProduct;
                        if( childBuildList[j].aggregateInfo[k] && childBuildList[j].aggregateInfo[k].metrics && childBuildList[j].aggregateInfo[k].metrics.length > 0 ){
                            //loop into each child's metrics
                            for ( let {name, value} of childBuildList[j].aggregateInfo[k].metrics ){
                                const childMean = value.mean;
                                if ( !metricsCollection[name] ){
                                    metricsCollection[name] = [childMean];
                                } else {
                                    metricsCollection[name].push(childMean);
                                }
                                //remove the bad data, ie: null.
                                metricsCollection[name] = metricsCollection[name].filter (n => n);
                            }
                        }
                    }
                }
            }
            // calculate the aggregate data
            Object.keys( metricsCollection ).forEach( function(key) {
                const meanMetric = math.mean(metricsCollection[key]);
                const maxMetric = math.max(metricsCollection[key]);
                const minMetric = math.min(metricsCollection[key]);
                const medianMetric = math.median(metricsCollection[key]);
                const stddevMetric = math.std(metricsCollection[key]);
                const ciMetric = BenchmarkMath.confidence_interval(metricsCollection[key]);
                childrenAggData.push({name: key, value: { mean: meanMetric, max: maxMetric, min: minMetric, median: medianMetric, stddev: stddevMetric, CI: ciMetric, iteration: metricsCollection[key].length } });
            })
            //add aggregate info for master node and update it in database
            parentAggregationStructure.push({
                benchmarkName: benchmarkName,
                benchmarkVariant: benchmarkVariant,
                benchmarkProduct: benchmarkProduct,
                metrics: childrenAggData
            });
            const { _id, ...value } = task;
            const criteria = { _id: new ObjectID( _id ) };
            const update = {
                ...value
            };
            update.aggregateInfo = parentAggregationStructure;
            const result = await testResultsDB.update( criteria, { $set: update } );  
        }
    }
}
