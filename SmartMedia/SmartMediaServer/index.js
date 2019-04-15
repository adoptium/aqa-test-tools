const express = require('express')
const app = express()
const port = 3000
const ArgParser = require( './ArgParser' );
ArgParser.parse();

app.get('/getSearchTweets', require( "./getSearchTweets" ) );
app.get('/getGitCloneInfo', require( "./getGitCloneInfo" ) );

app.listen(port, () => console.log(`Example app listening on port ${port}!`))