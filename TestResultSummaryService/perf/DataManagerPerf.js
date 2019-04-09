const { TestResultsDB, OutputDB } = require( '../Database' );
const ObjectID = require( 'mongodb' ).ObjectID;
const Parsers = require( `../parsers/` );
const DefaultParser = require( `../parsers/Default` );
const { logger } = require( '../Utils' );
const BenchmarkMath = require( './BenchmarkMathCalculation' );
const math = require('mathjs');

class DataManagerPerf {
    async updateBuildWithAggResult ( task ) {
        if ( task.type === "Perf") {
            if( task.aggregateInfo === undefined ) {
                let allDone = true;
                const parentId = task._id;
                let testResults = new TestResultsDB();
                const childBuildList = await testResults.getData({parentId}).toArray();
                if ( childBuildList && childBuildList.length > 0 ) {
                    for ( let i = 0; i < childBuildList.length; i++ ) {
                        if ( childBuildList[i].status === "NotDone" ) {
                            allDone = false;
                        }
                    }
                } else {
                    allDone = false;
                }
                if ( allDone ) {
                    await this.updateBuild(task);
                    task.status = "Done";
                }
            } else {
                task.status = "Done";
            }
        } else {
            task.status = "Done";
        }
    }
    async updateBuild( task ) {
        logger.debug("Update Aggregate Info", task._id, task.buildName, task.buildNum);
        let testResults = new TestResultsDB();
        let parentId = task._id;
        let childBuildList = await testResults.getData({parentId}).toArray();
        if(childBuildList && childBuildList.length > 0){
            const parentAggregationStructure = [];
            let BenchmarkName, BenchmarkVariant, BenchmarkProduct;
            const childrenAggData = [];
            const metricsCollection = {};
            for ( let j = 0; j < childBuildList.length; j++ ) {
                if (childBuildList[j].aggregateInfo && childBuildList[j].aggregateInfo.length > 0) {
                    for (let k = 0 ; k < childBuildList[j].aggregateInfo.length; k++){
                        BenchmarkName = childBuildList[j].aggregateInfo[k].benchmarkName;
                        BenchmarkVariant = childBuildList[j].aggregateInfo[k].benchmarkVariant;
                        BenchmarkProduct = childBuildList[j].aggregateInfo[k].benchmarkProduct;
                        if( childBuildList[j].aggregateInfo[k] && childBuildList[j].aggregateInfo[k]["metrics"] && childBuildList[j].aggregateInfo[k]["metrics"].length > 0 ){
                            for ( let l = 0 ; l < childBuildList[j].aggregateInfo[k]["metrics"].length; l++ ){
                                const childMetricName = childBuildList[j].aggregateInfo[k]["metrics"][l]["name"];
                                const childMean = childBuildList[j].aggregateInfo[k]["metrics"][l]["value"]["mean"];
                                if ( !metricsCollection[childMetricName] ){
                                    metricsCollection[childMetricName] = [childMean];
                                } else {
                                    metricsCollection[childMetricName].push(childMean);
                                }
                            }
                        }
                    }
                }
            }
            Object.keys( metricsCollection ).forEach( function(key) {
                const meanMetric = math.mean(metricsCollection[key]);
                const maxMetric = math.max(metricsCollection[key]);
                const minMetric = math.min(metricsCollection[key]);
                const medianMetric = math.median(metricsCollection[key]);
                const stddevMetric = math.std(metricsCollection[key]);
                const ciMetric = BenchmarkMath.confidence_interval(metricsCollection[key]);
                childrenAggData.push({name: key, value: { mean: meanMetric, max: maxMetric, min: minMetric, median: medianMetric, stddev: stddevMetric, CI: ciMetric, iteration: metricsCollection[key].length } });
            })
            parentAggregationStructure.push({
                benchmarkName: BenchmarkName,
                benchmarkVariant: BenchmarkVariant,
                benchmarkProduct: BenchmarkProduct,
                metrics: childrenAggData
            });
            const { _id, ...value } = task;
            const criteria = { _id: new ObjectID( _id ) };
            const update = {
                ...value
            };
            update.aggregateInfo = parentAggregationStructure;
            const result = await testResults.update( criteria, { $set: update } );
        }
    }
}

module.exports = DataManagerPerf;
