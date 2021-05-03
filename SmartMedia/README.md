## Local run/development steps
- start SmartMediaServer, and create configure file mediaConf.json
```
cd SmartMedia/SmartMediaServer
npm install
npm start
```
- open http://localhost:3000 and go to the API you want to use, then search.

Use API example:
For more Twitter API parameters, see [Search Tweets](https://developer.twitter.com/en/docs/tweets/search/api-reference/get-search-tweets)
```
http://localhost:3000/getGitCloneInfo?search=eclipse-openj9/openj9
http://localhost:3000/getSearchTweets?q=openj9
```

## Configure File
Credentials are needed for the server access (i.e., twitter, git, etc). In this case, please provide a `--configFile=<path to config json file>` when starting the server. The default value is  `--configFile=./mediaConf.json` when using `npm start`.

Config file example:
```
{
    "twitter": {
        "consumer_key": "********************",
        "consumer_secret": "********************",
        "access_token_key": "********************",
        "access_token_secret": "********************"
	},
    "git": {
        "token" : "********************",
    }
}
```
Get your twitter token by [Generating Twitter Access Token](https://developer.twitter.com/en/docs/basics/authentication/guides/access-tokens),
and get your git token by [Generating Git Access Tokens](https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line).
