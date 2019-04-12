const express = require('express')
const app = express()
const port = 3000
const ArgParser = require( './ArgParser' );
ArgParser.parse();

app.get('/', (req, res) => res.send('Hello World!'))
app.get('/getSearchTweets', require( "./getSearchTweets" ) );

app.listen(port, () => console.log(`Example app listening on port ${port}!`))