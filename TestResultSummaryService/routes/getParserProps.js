const benchmarkMetric = require( '../parsers/BenchmarkMetric');
const benchmarkMetricRouter = require( '../parsers/BenchmarkMetricRouter');
module.exports = async ( req, res ) => {
    res.json({'benchmarkMetricRouter':benchmarkMetricRouter,'benchmarkMetric':benchmarkMetric});
}