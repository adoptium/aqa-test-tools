

# TestResultSummaryService
Project for logging test results and viewing history. Should be abstract enough for any build to log results to and present results in a personalized dashboard.

## Prerequisites
* Node Version: 11.4.0 [Install Node](https://nodejs.org/en/download/)
* System Dependencies: npm (comes packaged with Node)
* MongoDB 4.0.6 and above
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
npm install
npm start
``` 

User can navigate at http://localhost:3000
Note: 
- Dashboard can be configured using DashboardBuildInfo.json
- Database needs to be populated before any data can be view on the side menu


## Production server
https://trss.adoptopenjdk.net/

## Deployment Instructions
- on TRSS production server machine, cd to source code folder and update the code
```
cd /home/jenkins/openjdk-test-tools
git pull
```

- if new module is added, then run `npm ci`
- if the change is in test-result-summary-client (react client), build client code
```
cd /home/jenkins/openjdk-test-tools/test-result-summary-client
npm run build
```

- restart the service
```
sudo service TRSSFrontend restart
sudo service TRSSBackend restart
```

- log message can be found by using the following cmd
```
tail -f /var/log/TRSSFrontend.log
tail -f /var/log/TRSSBackend.log
```

## Configure File
Credentials maybe needed for the server access (i.e., database, Jenkins, etc). In this case, please provide a `--configFile=<path to config json file>` when starting the server. The default value is  `--configFile=./trssConf.json` when using `npm start`.

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

- `NotDone` - The inital state. The build is created in the database, but not all information is processed and stored.
- `Streaming` - Special state. When enabled, the build will be processed while it is still running.
- `CurrentBuildDone` - The current build is processed and all informaiton is stored in the database, but its child builds may not be done.
- `Done` - The build and its child builds are processed and stored.

## Plugins
Plugins can be added. Please refer [Plugins ReadMe](./plugins/README.md) for implementation detail.

## Configure Crontab on server

- step 1: run command `env`, copy the field SHELL and PATH
- step 2: run command `crontab -e` to install a cron job, using SHELL and PATH value from step1

    example cron job: 
    ```
    SHELL=/bin/bash
    MAILTO=/home/oscar/log
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin
    0 8 * * 5 <path>/openjdk-test-tools/exportMongo.sh 
    ```
    This cron job will run exportMongo.sh once every week at Saturday 8am
- step 3: run command `sudo chmod u+x exportMongo.sh` to grant cron access to shell scipt