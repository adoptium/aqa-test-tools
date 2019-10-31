const { MongoClient, ObjectID } = require( 'mongodb' );
const ArgParser = require("./ArgParser");

const credential = ArgParser.getConfigDB() === null ? "" : `${encodeURIComponent(ArgParser.getConfigDB().user)}:${encodeURIComponent(ArgParser.getConfigDB().password)}@`;
const url = 'mongodb://' + credential + 'localhost:27017/exampleDb';

let db;
( async function() {
    const dbConnect = await MongoClient.connect( url );
    db = dbConnect.db("exampleDb");
    await db.createCollection( 'testResults' );
    await db.createCollection( 'output' );
} )()

class Database {
    populateDB( data ) {
        return this.col.insert( data );
    }

    getData( query, fields = {} ) {
        return this.col.find( query, fields );
    }
    
    findOne( query, fields = {} ) {
        return this.col.findOne( query, fields );
    }

    dropCollection() {
        return this.col.drop();
    }

    aggregate( array ) {
        return this.col.aggregate( array ).toArray();
    }

    distinct( field, query ) {
        return this.col.distinct( field, query );
    }

    update( criteria, update, options = {} ) {
        return this.col.update( criteria, update, options );
    }

    deleteMany( fields ) {
        return this.col.deleteMany( fields );
    }

    deleteOne( fields ) {
        return this.col.deleteOne( fields );
    }

    async getSpecificData( query, specification ) {
        if ( query.buildNum ) query.buildNum = parseInt( query.buildNum, 10 );
        if ( query._id ) query._id = new ObjectID( query._id );
        if ( query.parentId ) query.parentId = new ObjectID( query.parentId );
        if ( query["tests._id"] ) query["tests._id"] = new ObjectID( query["tests._id"] );
        const result = await this.aggregate( [
            {
                $match: query,
            },
            {
                $project: specification,
            },
        ] );
        return result;
    }

    async getTestById( testId ) {
        const result = await this.aggregate( [
            {
                $match: {
                    "tests._id": new ObjectID( testId )
                }
            },
            { $unwind: "$tests" },
            {
                $match: {
                    "tests._id": new ObjectID( testId )
                }
            }
        ] );
        return result;
    }

    // ToDo: impl check can be added once we have impl stored
    async getTotals(query) {
        const url = query.url;
        const buildName = query.buildName;
        let buildNum = query.buildNum;
        if (!url || !buildName || !buildNum) {
            return { error: `Cannot find url ${url}, buildName ${buildName} or buildNum ${buildNum}` };
        }

        if (buildNum && parseInt(buildNum, 10)) {
            buildNum = parseInt(buildNum, 10);
        } else {
            return { error: `invalid buildNum: ${buildNum}` };
        }
        let buildNameRegex = `^Test.*`;
        if (query.level) buildNameRegex = `${buildNameRegex}${query.level}..*`;
        if (query.group) buildNameRegex = `${buildNameRegex}${query.group}-.*`;
        if (query.platform) buildNameRegex = `${buildNameRegex}${query.platform}`;

        const result = await this.aggregate([
            { $match: { url, buildName, buildNum } },
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
}
class TestResultsDB extends Database {
    constructor() {
        super();
        this.col = db.collection( 'testResults' );
    }
}

class OutputDB extends Database {
    constructor() {
        super();
        this.col = db.collection( 'output' );
    }
}

class BuildListDB extends Database {
    constructor() {
        super();
        this.col = db.collection( 'buildList' );
    }
}

module.exports = { TestResultsDB, OutputDB, BuildListDB, ObjectID };