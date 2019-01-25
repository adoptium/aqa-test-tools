const { TestResultsDB, ObjectID } = require( '../Database' );

function _cleanParams(query) {
  for (let key in query) {
    if (Array.isArray(query[key])) {
      query[key] = {
        $in: query[key]
      }
    }
  }
};

module.exports = async ( req, res ) => {
  const { limit = 5, asc = false, ...query } = req.query;
  const sortData = {
    timestamp: asc ? 1 : -1
  };

  _cleanParams(query);

  if ( query.parentId ) query.parentId = new ObjectID( query.parentId );
  const db = new TestResultsDB();
  const result = await db.getData( query ).sort( sortData ).limit( parseInt( limit, 10 ) ).toArray();
  res.send( result );
}