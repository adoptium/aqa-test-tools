## PerfNext Development Instructions

### Setup

## Prerequisites

- Node Version: 6.10.3
- System Dependencies: npm (comes packaged with Node)

```
> check npm has been installed correctly by running:
	>> npm -v
```

- [Install Node](https://nodejs.org/en/download/)

```
> check node has been installed correctly by running:
	>> node -v
> depending on your OS, you may need to run:
	>> sudo apt install npm
	>> sudo npm install -g n
	>> sudo n latest
	>> and add node bin location to your PATH
```

- Access to [Runtimes Jenkins Instance](https://ci.adoptium.net/) (Not required for now)

## Passwords Requirements

All passwords used in PerfNext should be put inside the file "credentials.json" under the PerfNext directory on any machine hosting this application. This file is listed in .gitignore so that it does not get pushed to GIT since it contains sensitive information.
This file should be updated whenever the required accounts' passwords are updated.

## URLS

All custom server urls should be specified in PerfNext/config/APP_DATA.json
The urls required are the following:

- "jenkins_base": "Link for jenkins pipeline to run the benchmark jobs, example: https://customJenkinsServer.com/view/performance/job/Example-Pipeline"
- "jenkins_root": "Root link of jenkins, example: https://customJenkinsServer.com/"
- "packages_base_url" : "Url of server containing benchmark packages, example: http://customServer.com/packages"
- "builds_server_url": "Url of server containing the builds/sdks to run, example: https://customServer.com:8888/perl/secure/fetch/packages/"
- "machine_list_url" : "Url to download machine info xml"

## Steps

Execute the following commands after installing Node + npm and cloning the repository:

```
> cd PerfNext
> npm install
> node app.js
```

You should now be able to navigate to localhost:8888 from your web browser

### Development Steps

- Create feature branches off of master (until we have a staging branch): `git checkout -b feature-branch-name origin/master`
- Git pull and rebase your feature branch onto master regularly to ensure freshness: `git rebase master`
- Always git pull and rebase onto master prior to submitting a pull request.
- When submitting a pull request to _master_, always **squash and merge**!

## Production server

TBD

## Deployment Instructions

- If the change is in PerfNext, upload changed file under `/data/testci/PerfNext` in `TBD`.
  - You'll have to manually upload the files since Git version does not have modules.
- Refer to the Password Requirement section above in order to configure the passwords file needed by PerfNext. It should already exist from before.
- If new module is added, then run `npm install` on `TBD`.
- You'll have to manually restart the service if you updated the back-end since only the front-end gets updated automatically and not the back-end.
- You'll need to be added to the sudo list in order to restart the service.

```
service PerfNext restart
```

- log message can be found by using the following cmd

```
tail -f /var/log/PerfNext.log
```
