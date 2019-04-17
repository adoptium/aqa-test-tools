const ArgParser = require("./ArgParser.js");
const client = ArgParser.getTwitterConfig();

module.exports = function (req, res) {
    if (!req.query.q) {
        res.send("No request was sent");
    }
    if (!req.query.count) req.query.count=10;
    client.get('search/tweets', req.query, function (error, tweets, response) {
        if (error) console.log(error);
        res.send(tweets);
    })
}
