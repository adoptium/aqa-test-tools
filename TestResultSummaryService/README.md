

# TestResultSummaryService
Project for logging test results and viewing history. Should be abstract enough for any build to log results to and present results in a personalized dashboard.

## Prerequisites
* Node Version: 8.4.0 [Install Node](https://nodejs.org/en/download/)
* System Dependencies: npm (comes packaged with Node)
* MongoDB 3.0.2 and above
* Access to [Jenkins Instances](https://ci.adoptopenjdk.net)

## Local run/development steps
Execute the following commands after installing Node + npm + mongoDB and cloning the repository:
- start MongoDB

```
cd C:\Program Files\MongoDB\Server\3.0\bin
mongod.exe
```

- start TestResultSummaryService

```
cd to TestResultSummaryService folder
npm install
npm start
```

- start react client

```
cd to test-result-summary-client folder
yarn install
npm start
``` 

User can navigate at http://localhost:3000
Note: database needs to be populated before any data can be view on the web page


## Production server
TBD

## Deployment Instructions
- make sure you have LDAP account and can login to machine `TBD`
(if not, please make sure you are in bluebird group)
- if the change is in TestResultSummaryService (server), upload changed file under `/data/testci/TestResultSummaryService` in `TBD`
- if new module is added, then run `npm install` on `TBD`
- if the change is in test-result-summary-client (react client), build client code
```
cd testci/test-result-summary-client
yarn build
```
- upload the generated `build` folder under `/data/testci/` in `TBD`
- restart the service
```
service TestResultsSummaryService restart
```
- log message can be found by using the following cmd
```
tail -f /var/log/TestResultsSummaryService.log
```

## Configure File
Credentials maybe needed for the server access (i.e., database, Jenkins, etc). In this case, please provide a `--configFile=<path to config json file>` when starting the server. The default value is  `--configFile=./trssConf.json` when using `npm start`.

Config file example:
```
{
	"https://exampleserver2.com": {
		"user" : "abc@example.com",
		"password" : "123"   <=== the value can be password or token
	},
	"https://exampleserver1.com": {
		"user" : "xyz@example.com",
		"password" : "456"
	}
}
```

If any server name matches with url in `DashboardBuildInfo.json` or domain in build monitoring list, credentials will be used when querying these servers.