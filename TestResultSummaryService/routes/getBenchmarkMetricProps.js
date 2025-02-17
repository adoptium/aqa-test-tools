const benchmarkMetric = require('../parsers/BenchmarkMetric');
const utils = require('../parsers/Utils');
module.exports = async (req, res) => {
    const { benchmarkName } = req.query;
    if (benchmarkName) {
        const key = utils.getBenchmarkParserKey(benchmarkName);
        if (key) {
            res.json(benchmarkMetric[key]['metrics']);
        }
    } else {
        res.json(benchmarkMetric);
    }
    res.json();
};
