# Deep AQAtik Project
Deep AQAtik project aims at enhancing functions in Test Result Summary Service (TRSS) with machine learning technology.

## Prerequisites
- [Python 3](https://www.python.org/doc/)

## Local run/development steps
Execute the following commands after installing python 3 and cloning the repository:

- navigate to the folder
```
cd to aqa-test-tools/MachineLearningPrototype/Deployment folder
```

- (first time only) create an [environment](https://flask.palletsprojects.com/en/1.1.x/installation/#create-an-environment) with required packages
```
python3 -m venv deployenv
```

- activate the environment
```
source deployenv/bin/activate
```

- (first time only) install required packages
```
pip install wheel
pip install gunicorn flask
pip install flask_cors numpy pandas sklearn joblib
```

- start Flask development server
```
export FLASK_APP=deployment.py
flask run
```

User can navigate at http://127.0.0.1:5000

Note:
- stop the server by pressing CTRL+C
- quit the environment use `deactivate`


## Production server
https://trssml.adoptopenjdk.net/ (unavailable now)

### Deployment Instructions
- on TRSS production server machine with `jenkins` user, cd to source code folder and update the code
```
cd /home/jenkins/aqa-test-tools
git pull
```

- if new package is added, install it
```
cd MachineLearningPrototype/Deployment
source deployenv/bin/activate
pip install ${new_package_name}
```

- restart the service
```
sudo systemctl restart deployment
```

- log message can be found by using the following cmd
```
sudo journalctl -u deployment
```
