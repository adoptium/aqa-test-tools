const { MongoClient, ObjectID } = require( 'mongodb' );
const url = 'mongodb://localhost:27017/exampleDb';

let db;
( async function() {
    db = await MongoClient.connect( url );
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