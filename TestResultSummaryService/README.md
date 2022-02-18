# TestResultSummaryService

Project for logging test results and viewing history. Should be abstract enough for any build to log results to and present results in a personalized dashboard.

## Prerequisites

-   Node Version: 11.4.0 [Install Node](https://nodejs.org/en/download/)
-   System Dependencies: npm (comes packaged with Node)
-   MongoDB 4.0.6 and above
-   Access to [Jenkins Instances](https://ci.adoptopenjdk.net)

## Local run/development steps

Execute the following commands after installing Node + npm + mongoDB and cloning the repository:

-   start MongoDB

```
cd C:\Program Files\MongoDB\Server\3.0\bin
mongod.exe
```

-   start TestResultSummaryService

```
cd to TestResultSummaryService folder
npm ci
npm start
```

-   start react client

```
cd to test-result-summary-client folder
npm ci
npm start
```

User can navigate at http://localhost:3000
Note:

-   Dashboard can be configured using DashboardBuildInfo.json
-   Database needs to be populated before any data can be displayed on the side menu
-   Optional: database GUI client (i.e., Robo 3T) can be installed to view data in database

For swagger API docs, please check http://localhost:3001/api-docs

## Optional: import sample data

If you do not have Jenkins access or you do not want to monior Jenkins server, you can import our sample data

-   turn off TestResultSummaryService if it is running

-   import sample data

```
mongorestore --archive=./data/sampleData.gz --db exampleDb --gzip
```

-   start TestResultSummaryService

```
cd to TestResultSummaryService folder
npm install
npm start
```

-   Open http://localhost:3000 in your broswer, you should see sample data showing up!

## Production server

https://trss.adoptium.net/

## Deployment Instructions

-   run the deployment scripts/deployment.sh

```
cd TestResultSummaryService/scripts
./deployment.sh
```

-   log message can be found by using the following cmd

```
tail -f /var/log/TRSSFrontend.log
tail -f /var/log/TRSSBackend.log
```

## Configure File

Credentials maybe needed for the server access (i.e., database, Jenkins, etc). In this case, please provide a `--configFile=<path to config json file>` when starting the server. The default value is `--configFile=./trssConf.json` when using `npm start`.

Config file example:

```
{
	"https://exampleserver2.com": {
		"user" : "abc@example.com",
		"password" : "123"   <=== the value can be token
	},
	"https://exampleserver1.com": {
		"user" : "xyz@example.com",
		"password" : "456"
	},
	"DB": {
		"user" : "abc",
		"password" : "789"
	}
}
```

If any server name matches with url in `DashboardBuildInfo.json` or domain in build monitoring list, credentials will be used when querying these servers.

##Build Status

A build can have the following status in database:

-   `NotDone` - The inital state. The build is created in the database, but not all information is processed and stored.
-   `Streaming` - Special state. When enabled, the build will be processed while it is still running.
-   `CurrentBuildDone` - The current build is processed and all informaiton is stored in the database, but its child builds may not be done.
-   `Done` - The build and its child builds are processed and stored.

## Plugins

Plugins can be added. Please refer [Plugins ReadMe](./plugins/README.md) for implementation detail.

## Configure Crontab on server

-   step 1: run command `env`, copy the field SHELL and PATH
-   step 2: run command `crontab -e` to install a cron job, using SHELL and PATH value from step1

    example cron job:

    ```
    SHELL=/bin/bash
    MAILTO=/home/oscar/log
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin
    0 8 * * 5 <path>/openjdk-test-tools/exportMongo.sh
    ```

    This cron job will run exportMongo.sh once every week at Saturday 8am

-   step 3: run command `sudo chmod u+x exportMongo.sh` to grant cron access to shell scipt

## Docker

Go to top directory, run command `docker-compose --env-file .docker.env up`, TRSS will be up at http://localhost:3000

Using Docker is a good way to test and development locally. For more details, please see a [recorded demonstration](https://youtu.be/9Adwk2qkL1A) of running TRSS locally in Docker.

## Testing

-   We are using Cypress for testing. To run UI testing, start TRSS server and client, then:

```
cd /home/jenkins/openjdk-test-tools/test-result-summary-client
npm run cy
```
