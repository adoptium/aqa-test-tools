const { MongoClient, ObjectID } = require('mongodb');
const ArgParser = require("./ArgParser");

let db;
(async function () {
    let url;
    let config = ArgParser.getConfigDB()
    if (config && config.connectionString) {
        url = config.connectionString;
    } else {
        const credential = config === null ? "" : `${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@`;
        const hostname = (process.env.MONGO_CONTAINER_NAME !== undefined ? process.env.MONGO_CONTAINER_NAME : 'localhost');
        url = 'mongodb://' + credential + hostname + ':27017/exampleDb';
    }

    const dbConnect = await MongoClient.connect(url, { useUnifiedTopology: true });
    db = dbConnect.db("exampleDb");
})()

class Database {
    populateDB(data) {
        return this.col.insertOne(data);
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
        if (query["tests._id"]) query["tests._id"] = new ObjectID(query["tests._id"]);
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
                    "tests._id": new ObjectID(testId)
                }
            },
            { $unwind: "$tests" },
            {
                $match: {
                    "tests._id": new ObjectID(testId)
                }
            }
        ]);
        return result;
    }

    // ToDo: impl check can be added once we have impl stored
    async getTotals(query) {
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
            return { error: `Cannot find id ${id}, url ${url}, buildName ${buildName} or buildNum ${buildNum}` };
        }


        let buildNameRegex = `^Test.*`;
        if (query.level) buildNameRegex = `${buildNameRegex}${query.level}..*`;
        if (query.group) buildNameRegex = `${buildNameRegex}${query.group}-.*`;
        if (query.platform) buildNameRegex = `${buildNameRegex}${query.platform}`;

        const result = await this.aggregate([
            { $match: matchQuery },
            {
                $graphLookup: {
                    from: "testResults",
                    startWith: "$_id",
                    connectFromField: "_id",
                    connectToField: "parentId",
                    as: "childBuilds",
                }
            },
            {
                $project: {
                    "childBuilds": "$childBuilds"
                }
            },
            { $unwind: "$childBuilds" },
            { $match: { "childBuilds.buildName": { $regex: buildNameRegex } } },
            {
                $group: {
                    _id: {},
                    total: { $sum: "$childBuilds.testSummary.total" },
                    executed: { $sum: "$childBuilds.testSummary.executed" },
                    passed: { $sum: "$childBuilds.testSummary.passed" },
                    failed: { $sum: "$childBuilds.testSummary.failed" },
                    disabled: { $sum: "$childBuilds.testSummary.disabled" },
                    skipped: { $sum: "$childBuilds.testSummary.skipped" },
                }
            }
        ]);
        return result[0] || {};
    }

    async getRootBuildId(id) {
        const _id = new ObjectID(id);
        const info = { _id };
        const result = await this.aggregate([
            { $match: info },
            {
                $graphLookup: {
                    from: "testResults",
                    startWith: "$parentId",
                    connectFromField: "parentId",
                    connectToField: "_id",
                    as: "buildHierarchy",
                }
            },
        ]);

        if (result && result.length > 0) {
            if (result[0].buildHierarchy && result[0].buildHierarchy.length > 0) {
                return result[0].buildHierarchy[0]._id;
            }
            // if no result or no build hierarchy, this is a root build. Set rootBuildId = _id
            return id;
        }
        return -1;
    }

    async getAvgDuration(info) {
        const { matchQuery = {}, testName, platform, jdkVersion, impl, level, group, buildResult, limit = 500 } = info;
        let buildNameRegex = `^Test.*`;
        if (jdkVersion) buildNameRegex = `${buildNameRegex}_openjdk${jdkVersion}.*`;
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
            "$exists": true, 
            "$ne": null
        };

        // the aggregate order is important. Please change with caution
        const aggregateQuery = [
            { $match: matchQuery },
            { $sort: { 'timestamp': -1 } },
            { $limit: parseInt(limit, 10) },
            { $unwind: "$tests" }
        ];

        if (testName) {
            let testNameRegex = `.*${testName}.*`;
            const testNameQuery = {
                $match: {
                    "tests.testName": { $regex: testNameRegex }
                }
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
                "tests.testName": 1,
                "tests.duration": 1,
            }
        };

        const groupQuery = {
            $group: {
                _id: "$tests.testName",
                avgDuration: { $avg: "$tests.duration" }
            },
        };

        aggregateQuery.push(projectQuery);
        aggregateQuery.push(groupQuery);
        aggregateQuery.push({ $sort: { 'avgDuration': -1 } });
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
            action
        });
    }
}
class TestResultsDB extends Database {
    constructor() {
        super();
        this.col = db.collection('testResults');
    }
}

class OutputDB extends Database {
    constructor() {
        super();
        this.col = db.collection('output');
    }
}

class ApplicationTestsDB extends Database {
    constructor() {
        super();
        this.col = db.collection('ApplicationTests');
    }
}

class BuildListDB extends Database {
    constructor() {
        super();
        this.col = db.collection('buildList');
    }
}

class AuditLogsDB extends Database {
    constructor() {
        super();
        this.col = db.collection('auditLogs');
    }
}

class UserDB extends Database {
    constructor() {
        super();
        this.col = db.collection('user');
    }
}

module.exports = { TestResultsDB, OutputDB, BuildListDB, ApplicationTestsDB, AuditLogsDB, UserDB, ObjectID };