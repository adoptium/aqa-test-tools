const { TestResultsDB, ObjectID } = require('../Database');
module.exports = async (req, res) => {
    let { type } = req.query;
    const db = new TestResultsDB();
    let result = ""
    if ( req.query.AQAvitCert ){
        result = await db.aggregate([
            {
                $match: {
                    parentId: { $exists: false },
                    type: type,
                    AQAvitCert : true
                }
            },
            {
                $group: {
                    _id: {
                        url: '$url',
                        buildName: '$buildName'
                    },
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]); 
    }
    else {
        result = await db.aggregate([
            {
                $match: {
                    parentId: { $exists: false },
                    type: type
                }
            },
            {
                $group: {
                    _id: {
                        url: '$url',
                        buildName: '$buildName'
                    },
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);
    }
    
    res.send(result);
}