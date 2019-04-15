const ArgParser = require("./ArgParser.js");
const Twitter = require('twitter');
const client = new Twitter (ArgParser.getConfig().twitter);

module.exports = function (req, res) {
    if (!req.query.q) {
        res.send("No request was sent");
    }
    if (!req.query.count) req.query.count=10;
    client.get('search/tweets', req.query, function (error, tweets, response) {;
        res.send(tweets);
    });
}
