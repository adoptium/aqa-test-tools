const { MongoClient, ObjectID } = require('mongodb');
const ArgParser = require('./ArgParser');
const { logger } = require('./Utils');

let db;

(async function () {
    try {
        let url;
        let config = ArgParser.getConfigDB();
        if (config && config.connectionString) {
            url = config.connectionString;
        } else {
            const credential =
                config === null
                    ? ''
                    : `${encodeURIComponent(config.user)}:${encodeURIComponent(
                          config.password
                      )}@`;
            const { MONGO_CONTAINER_NAME = 'localhost' } = process.env;
            url =
                'mongodb://' +
                credential +
                MONGO_CONTAINER_NAME +
                ':27017/exampleDb';
        }

        logger.info('Connecting to MongoDB at: ' + url.replace(/\/\/.*@/, '//***@'));
        const dbConnect = await MongoClient.connect(url, {
            useUnifiedTopology: true,
        });
        db = dbConnect.db('exampleDb');
        logger.info('MongoDB connected successfully');
        
        for (let collection of ['testResults', 'output', 'auditLogs', 'user']) {
            try {
                await db.createCollection(collection);
            } catch (e) {
                // do nothing. The collection may already exist
            }
        }
        const testResultsDB = db.collection('testResults');
    
        const parentIdIndex = await testResultsDB.createIndex({ parentId: 1 });
        logger.info('Index created: ', parentIdIndex);
        const urlBuildNameBuildNumIndex = await testResultsDB.createIndex({
            buildName: 1,
            url: 1,
            buildNum: 1,
        });
        logger.info('Index created: ', urlBuildNameBuildNumIndex);
    
        const testIdIndex = await testResultsDB.createIndex({ 'tests._id': 1 });
        logger.info('Index created: ', testIdIndex);
    
        const result = await testResultsDB.listIndexes().toArray();
        logger.info('Existing testResults indexes:');
        for (const doc of result) {
            logger.info(doc);
        }
    } catch (error) {
        logger.error('Failed to connect to MongoDB:', error.message);
        logger.error('Stack trace:', error.stack);
        logger.error('Server will not function without database connection');
        process.exit(1);
    }
})();

class Database {
    populateDB(data) {
        return this.col.insertOne(data);
    }

    insertMany(data) {
        return this.col.insertMany(data);
    }

    getData(query, fields = {}) {
        return this.col.find(query, fields);
    }

    findOne(query, fields = {}) {
        return this.col.findOne(query, fields);
    }

    dropCollection() {
        return this.col.drop();
    }

    aggregate(array) {
        return this.col.aggregate(array).toArray();
    }

    distinct(field, query) {
        return this.col.distinct(field, query);
    }

    update(criteria, update, options = {}) {
        return this.col.updateOne(criteria, update, options);
    }

    deleteMany(fields) {
        return this.col.deleteMany(fields);
    }

    deleteOne(fields) {
        return this.col.deleteOne(fields);
    }

    async getSpecificData(query, specification) {
        if (query.buildNum) query.buildNum = parseInt(query.buildNum, 10);
        if (query._id) query._id = new ObjectID(query._id);
        if (query.parentId) query.parentId = new ObjectID(query.parentId);
        if (query['tests._id'])
            query['tests._id'] = new ObjectID(query['tests._id']);
        const result = await this.aggregate([
            {
                $match: query,
            },
            {
                $project: specification,
            },
        ]);
        return result;
    }

    async getTestById(testId) {
        const result = await this.aggregate([
            {
                $match: {
                    'tests._id': new ObjectID(testId),
                },
            },
            { $unwind: '$tests' },
            {
                $match: {
                    'tests._id': new ObjectID(testId),
                },
            },
        ]);
        return result;
    }

    // ToDo: impl check can be added once we have impl stored
    /**
     * Base function for aggregating data from testResults.
     * @param {Object} query - The query object.
     * @param {string} type - The type of request (e.g., 'totals', 'rerunDetails', 'jobsDetails').
     * @returns {Object} - The aggregation result.
     */
    async testResultsBaseAggregation(query, type) {
        const url = query.url;
        const buildName = query.buildName;
        let id = query.id;
        let buildNum = query.buildNum;
        let matchQuery = {};
        if (id) {
            const _id = new ObjectID(id);
            matchQuery = { _id };
        } else if (url && buildName && buildNum) {
            if (buildNum && parseInt(buildNum, 10)) {
                buildNum = parseInt(buildNum, 10);
            } else {
                return { error: `invalid buildNum: ${buildNum}` };
            }
            matchQuery = { url, buildName, buildNum };
        } else {
            return {
                error: `Cannot find id ${id}, url ${url}, buildName ${buildName} or buildNum ${buildNum}`,
            };
        }

        let buildNameRegex = `^(Test|Perf).*`;
        if (query.level) buildNameRegex = `${buildNameRegex}${query.level}..*`;
        if (query.group) buildNameRegex = `${buildNameRegex}${query.group}-.*`;
        if (query.platform)
            buildNameRegex = `${buildNameRegex}${query.platform}`;

        // Call the routing function to get the specific aggregation
        const specificAggregation = this.getSpecificAggregation(type, buildNameRegex, query);

        try {
            const result = await this.aggregate([
                { $match: matchQuery },
                {
                    $graphLookup: {
                        from: 'testResults',
                        startWith: '$_id',
                        connectFromField: '_id',
                        connectToField: 'parentId',
                        as: 'childBuilds',
                    },
                },
                {
                    $project: {
                        childBuilds: '$childBuilds',
                    },
                },
                ...specificAggregation,
            ]);
            return result[0] || {};
        } catch (error) {
            console.error('Error:', error);
        }
    }

    /**
     * Routing function to get the specific aggregation based on the type.
     * @param {string} type - The type of request (e.g., 'totals', 'rerunDetails', 'jobsDetails').
     * @param {string} buildNameRegex - The build name regex.
     * @param {Object} query - The query object.
     * @returns {Array} - The specific aggregation steps.
     */
    getSpecificAggregation(type, buildNameRegex, query) {
        switch (type) {
            case 'totals':
                return this.getTotalsAggregation(query, buildNameRegex);
            case 'rerunDetails':
                return this.getRerunDetailsAggregation();
            case 'jobsDetails':
                return this.getJobsDetailsAggregation();
            default:
                throw new Error(`Unknown type: ${type}`);
        }
    }

    getTotalsAggregation(query, buildNameRegex) {
        return [
            { $unwind: '$childBuilds' },
            { $match: { 'childBuilds.buildName': { $regex: buildNameRegex } } },
            {
                $group: {
                    _id: query.id,
                    total: { $sum: '$childBuilds.testSummary.total' },
                    executed: { $sum: '$childBuilds.testSummary.executed' },
                    passed: { $sum: '$childBuilds.testSummary.passed' },
                    failed: { $sum: '$childBuilds.testSummary.failed' },
                    disabled: { $sum: '$childBuilds.testSummary.disabled' },
                    skipped: { $sum: '$childBuilds.testSummary.skipped' },
                },
            },
        ];
    }

    getRerunDetailsAggregation() {
        return [
            {
                $addFields: {
                    manual_rerun_needed_list: {
                      $filter: {
                          input: '$childBuilds',
                          as: 'build',
                          cond: {
                                  $and: [
                                  { $in: ['$$build.buildResult', ['UNSTABLE', 'FAILED', 'ABORTED']] },
                                  {
                                      $or: [
                                      {
                                        $regexMatch: { input: '$$build.buildName', regex: /_rerun$/ }
                                      },
                                      {
                                          // If buildName does not end with '_rerun', check if another build with the same name exists that ends with '_rerun'
                                          $and: [
                                          { $not: [{ $regexMatch: { input: '$$build.buildName', regex: /_rerun$/ } }] },
                                          {
                                              // Veriy that there is no '_rerun' build for this build
                                              $eq: [
                                              {
                                                  $size: {
                                                  $filter: {
                                                      input: '$childBuilds',
                                                      as: 'internal_build',
                                                      cond: {
                                                      $and: [
                                                          {
                                                              $regexMatch: {
                                                                  input: '$$internal_build.buildName',
                                                                  regex: { $concat: ['^', '$$build.buildName'] }
                                                              }
                                                              },
                                                          { $regexMatch: { input: '$$internal_build.buildName', regex: /_rerun$/ } }
                                                      ]
                                                      }
                                                  }
                                                  }
                                              },
                                              0
                                              ]
                                          }
                                          ]
                                      }
                                      ]
                                  }
                                  ]
                              },
                          }
                      }
                  },
            },
            {
                $addFields: {
                    manual_rerun_needed: {
                        $size:
                            '$manual_rerun_needed_list'
                    }
                  },
            },
            {
                $addFields: {
                    tests_needed_manual_rerun: {
                        $reduce: {
                            input: '$manual_rerun_needed_list',
                            initialValue: 0,
                            in: {
                                $add: [
                                    '$$value',
                                    { $ifNull: ['$$this.testSummary.failed', 0] }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    manual_rerun_needed_regex: {
                        $concat: [
                            '^(',
                            {
                                $reduce: {
                                    input: '$manual_rerun_needed_list',
                                    initialValue: '',
                                    in: {
                                        $cond: [
                                            { $eq: ['$$value', ''] }, // If the first item
                                            { $replaceAll: { input: '$$this.buildName', find: '.', replacement: '\\.' } },
                                            {
                                                $concat: [
                                                    '$$value',
                                                    '|',
                                                    { $replaceAll: { input: '$$this.buildName', find: '.', replacement: '\\.' } }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            ')$'
                        ]
                    }
                }
            },
            { $unset: ['childBuilds', 'manual_rerun_needed_list'] }
        ];
    }

    getJobsDetailsAggregation() {
        return [
            {
                $addFields: {
                    job_success_rate: {
                        $round: [
                            {
                                $multiply: [
                                    {
                                        $divide: [
                                            {
                                                $size: {
                                                    $filter: {
                                                        input: "$childBuilds",
                                                        as: "build",
                                                        cond: { $eq: ["$$build.buildResult", "SUCCESS"] }
                                                    }
                                                }
                                            },
                                            { $size: "$childBuilds" }
                                        ]
                                    },
                                    100
                                ]
                            },
                            2
                        ]
                    }
                }
            },
            { $unset: ['childBuilds'] }
        ];
    }

    async getRootBuildId(id) {
        const _id = new ObjectID(id);
        const info = { _id };
        const result = await this.aggregate([
            { $match: info },
            {
                $graphLookup: {
                    from: 'testResults',
                    startWith: '$parentId',
                    connectFromField: 'parentId',
                    connectToField: '_id',
                    as: 'buildHierarchy',
                },
            },
        ]);

        if (result && result.length > 0) {
            if (
                result[0].buildHierarchy &&
                result[0].buildHierarchy.length > 0
            ) {
                return result[0].buildHierarchy[0]._id;
            }
            // if no result or no build hierarchy, this is a root build. Set rootBuildId = _id
            return id;
        }
        return -1;
    }

    async getAvgDuration(info) {
        const {
            matchQuery = {},
            testName,
            platform,
            jdkVersion,
            impl,
            level,
            group,
            buildResult,
            limit = 500,
        } = info;
        let buildNameRegex = `^Test.*`;
        if (jdkVersion)
            buildNameRegex = `${buildNameRegex}_openjdk${jdkVersion}.*`;
        if (impl) buildNameRegex = `${buildNameRegex}${impl}_.*`;
        if (level) buildNameRegex = `${buildNameRegex}${level}..*`;
        if (group) buildNameRegex = `${buildNameRegex}${group}_.*`;
        if (platform) buildNameRegex = `${buildNameRegex}${platform}.*`;

        // remove .* at the end of buildNameRegex
        buildNameRegex = buildNameRegex.replace(/\.\*$/, '');

        // when calculate test average duration, exclude Personal builds
        buildNameRegex = buildNameRegex + `(?:(?!_Personal).)*$`;

        const buildResultRegex = buildResult || 'SUCCESS|UNSTABLE';

        matchQuery.buildName = { $regex: buildNameRegex, $options: 'i' };
        matchQuery.buildResult = { $regex: buildResultRegex };
        matchQuery.hasChildren = false;
        matchQuery.tests = {
            $exists: true,
            $ne: null,
        };

        // the aggregate order is important. Please change with caution
        const aggregateQuery = [
            { $match: matchQuery },
            { $sort: { timestamp: -1 } },
            { $limit: parseInt(limit, 10) },
            { $unwind: '$tests' },
        ];

        if (testName) {
            let testNameRegex = `.*${testName}.*`;
            const testNameQuery = {
                $match: {
                    'tests.testName': { $regex: testNameRegex },
                },
            };
            aggregateQuery.push(testNameQuery);
        }

        const projectQuery = {
            $project: {
                _id: 1,
                buildName: 1,
                buildNum: 1,
                machine: 1,
                buildUrl: 1,
                'tests.testName': 1,
                'tests.duration': 1,
            },
        };

        const groupQuery = {
            $group: {
                _id: '$tests.testName',
                avgDuration: { $avg: '$tests.duration' },
            },
        };

        aggregateQuery.push(projectQuery);
        aggregateQuery.push(groupQuery);
        aggregateQuery.push({ $sort: { avgDuration: -1 } });
        const result = await this.aggregate(aggregateQuery);
        return result;
    }

    async insertAuditLogs(info) {
        const { _id, url, buildName, buildNum, status, action } = info;
        await this.populateDB({
            timestamp: new Date(),
            buildId: _id,
            url,
            buildName,
            buildNum,
            status,
            action,
        });
    }
}
class TestResultsDB extends Database {
    constructor() {
        super();
        if (!db) {
            const error = new Error('Database not initialized. MongoDB connection not ready.');
            logger.error('TestResultsDB constructor error:', error.message);
            throw error;
        }
        this.col = db.collection('testResults');
    }
}

class OutputDB extends Database {
    constructor() {
        super();
        if (!db) {
            const error = new Error('Database not initialized. MongoDB connection not ready.');
            logger.error('OutputDB constructor error:', error.message);
            throw error;
        }
        this.col = db.collection('output');
    }
}

class ApplicationTestsDB extends Database {
    constructor() {
        super();
        if (!db) {
            const error = new Error('Database not initialized. MongoDB connection not ready.');
            logger.error('ApplicationTestsDB constructor error:', error.message);
            throw error;
        }
        this.col = db.collection('ApplicationTests');
    }
}

class BuildListDB extends Database {
    constructor() {
        super();
        if (!db) {
            const error = new Error('Database not initialized. MongoDB connection not ready.');
            logger.error('BuildListDB constructor error:', error.message);
            throw error;
        }
        this.col = db.collection('buildList');
    }
}

class AuditLogsDB extends Database {
    constructor() {
        super();
        if (!db) {
            const error = new Error('Database not initialized. MongoDB connection not ready.');
            logger.error('AuditLogsDB constructor error:', error.message);
            throw error;
        }
        this.col = db.collection('auditLogs');
    }
}

class UserDB extends Database {
    constructor() {
        super();
        if (!db) {
            const error = new Error('Database not initialized. MongoDB connection not ready.');
            logger.error('UserDB constructor error:', error.message);
            throw error;
        }
        this.col = db.collection('user');
    }
}

class FeedbackDB extends Database {
    constructor() {
        super();
        if (!db) {
            const error = new Error('Database not initialized. MongoDB connection not ready.');
            logger.error('FeedbackDB constructor error:', error.message);
            throw error;
        }
        this.col = db.collection('feedback');
    }
}

module.exports = {
    TestResultsDB,
    OutputDB,
    BuildListDB,
    ApplicationTestsDB,
    AuditLogsDB,
    UserDB,
    ObjectID,
    FeedbackDB,
};
