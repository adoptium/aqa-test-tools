const benchmarkMetric = require( '../parsers/BenchmarkMetric');
module.exports = async ( req, res ) => {
    res.json({benchmarkMetric});
}