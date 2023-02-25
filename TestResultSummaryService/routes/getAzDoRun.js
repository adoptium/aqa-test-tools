const request = require('request');
const Parsers = require('../parsers');
const DefaultParser = require('../parsers/Default');
const DataManagerAggregate = require('../perf/DataManagerAggregate');
const ArgParser = require('../ArgParser');
const math = require('mathjs');
const BenchmarkMath = require('../perf/BenchmarkMathCalculation');

module.exports = async (req, res) => {
    const { user, password, server } =
        ArgParser.getConfig() === undefined ? {} : ArgParser.getConfig().AzDo;

    // extract buildId from url
    const buildId = req.query.buildId;

    const auth = {
        user,
        password,
    };

    // Fetch job details from the Azure Devops api
    request.get(
        server + '/_apis/build/builds/' + buildId,
        {
            auth: auth,
        },
        function (err, body) {
            if (err) {
                return res.json({ error: err });
            }
            const buildInfo = JSON.parse(body.body);
            let benchmarkVariant = buildInfo.templateParameters.suite;
            const startTime = new Date(buildInfo.startTime).toLocaleString();

            // extract benchmark name from benchmarkVariant
            let benchmarkName;
            switch (true) {
                case benchmarkVariant.includes('specjbb'):
                    benchmarkName = 'SPECjbb2015';
                    break;
                default:
                    benchmarkName = benchmarkVariant;
            }

            // fetch the timeline
            request.get(
                server + '/_apis/build/builds/' + buildId + '/timeline',
                {
                    auth: auth,
                },
                function (err, body) {
                    if (err) {
                        return res.json({ error: err });
                    }
                    const results = JSON.parse(body.body);
                    // extract worker name from timeline
                    const agentName = results.records.find(
                        (job) =>
                            job.name ===
                            `Run ${buildInfo.templateParameters.suite}`
                    ).workerName;
                    // find the log with the name of the benchmark
                    const logURL = results.records.find(
                        (job) =>
                            job.name ===
                            `Run ${buildInfo.templateParameters.suite}`
                    ).log.url;
                    // fetch the log
                    request.get(
                        logURL,
                        {
                            auth: auth,
                        },
                        async function (err, body) {
                            if (err) {
                                return res.json({ error: err });
                            }
                            const log = body.body;

                            const parserTypes = await Promise.all(
                                Object.keys(Parsers).map(async (type) => {
                                    if (
                                        Parsers[type].canParse(
                                            benchmarkName,
                                            log
                                        )
                                    ) {
                                        const parser = new Parsers[type](
                                            benchmarkName
                                        );
                                        return await parser.parse(log);
                                    }
                                })
                            );

                            let results = parserTypes.filter((element) => {
                                return element !== undefined;
                            });

                            if (results.length === 0) {
                                const parser = new DefaultParser();
                                results = await parser.parse(log);
                            }

                            // fetch aggregate data
                            const aggRawMetricValues =
                                DataManagerAggregate.aggDataCollect(results[0]);

                            const aggregateInfo = [];

                            if (
                                aggRawMetricValues &&
                                Object.keys(aggRawMetricValues).length > 0
                            ) {
                                Object.keys(aggRawMetricValues).forEach(
                                    function (name_variant) {
                                        benchmarkName =
                                            name_variant.split('&&')[0];
                                        benchmarkVariant =
                                            name_variant.split('&&')[1];
                                        const metrics = [];
                                        let benchmarkMetricsCollection =
                                            aggRawMetricValues[name_variant];
                                        Object.keys(
                                            benchmarkMetricsCollection
                                        ).forEach(function (key) {
                                            if (
                                                Array.isArray(
                                                    benchmarkMetricsCollection[
                                                        key
                                                    ]
                                                ) &&
                                                benchmarkMetricsCollection[key]
                                                    .length > 0
                                            ) {
                                                const mean = math.round(
                                                    math.mean(
                                                        benchmarkMetricsCollection[
                                                            key
                                                        ]
                                                    ),
                                                    3
                                                );
                                                const max = math.round(
                                                    math.max(
                                                        benchmarkMetricsCollection[
                                                            key
                                                        ]
                                                    ),
                                                    3
                                                );
                                                const min = math.round(
                                                    math.min(
                                                        benchmarkMetricsCollection[
                                                            key
                                                        ]
                                                    ),
                                                    3
                                                );
                                                const median = math.round(
                                                    math.median(
                                                        benchmarkMetricsCollection[
                                                            key
                                                        ]
                                                    ),
                                                    3
                                                );
                                                const stddev = math.round(
                                                    math.std(
                                                        benchmarkMetricsCollection[
                                                            key
                                                        ]
                                                    ),
                                                    3
                                                );
                                                const CI = math.round(
                                                    BenchmarkMath.confidence_interval(
                                                        benchmarkMetricsCollection[
                                                            key
                                                        ]
                                                    ),
                                                    3
                                                );
                                                metrics.push({
                                                    name: key,
                                                    statValues: {
                                                        mean,
                                                        max,
                                                        min,
                                                        median,
                                                        stddev,
                                                        CI,
                                                        validIterations:
                                                            benchmarkMetricsCollection[
                                                                key
                                                            ].length,
                                                    },
                                                    rawValues:
                                                        benchmarkMetricsCollection[
                                                            key
                                                        ],
                                                });
                                            }
                                        });
                                        //add aggregate info for each node and update it in both parent and child node database
                                        aggregateInfo.push({
                                            benchmarkName,
                                            benchmarkVariant,
                                            metrics,
                                        });
                                    }
                                );
                            }

                            for (const result of results) {
                                result.startBy =
                                    buildInfo.requestedBy.displayName;
                                result.machine = agentName;
                                result.jdkDate = startTime;
                                result.javaVersion =
                                    buildInfo.templateParameters.javaVersion;
                                result.aggregateInfo = aggregateInfo;
                            }

                            return res.json(results);
                        }
                    );
                }
            );
        }
    );
};
