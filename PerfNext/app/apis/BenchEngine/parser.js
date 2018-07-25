/*
#################################################################
#     ____                  __    ______            _           #
#    / __ )___  ____  _____/ /_  / ____/___  ____ _(_)___  ___  #
#   / __  / _ \/ __ \/ ___/ __ \/ __/ / __ \/ __ `/ / __ \/ _ \ #
#  / /_/ /  __/ / / / /__/ / / / /___/ / / / /_/ / / / / /  __/ #
# /_____/\___/_/ /_/\___/_/ /_/_____/_/ /_/\__, /_/_/ /_/\___/  #
#                                        /____/                 #
#################################################################
*/

var xml2js = require('xml2js');
var parser = new xml2js.Parser({explicitArray : false});
var dateTime = require('node-datetime');
var fs = require('fs');
var request = require('request');

module.exports = function(app) {

	/*
    * API to generate test script from XML Benchmark definition.     
    * 
    * Params: XML definition
    */
	app.post('/api/benchengine/generatescript', function(req, res) {
		var raw_definition = req.rawBody; //Raw XML to be parsed

		parseDefinition(raw_definition, function(generatedOutput){
			parseSetupScript(raw_definition, function(setupScript){
				var mergedScripts = setupScript + generatedOutput;
				res.send(mergedScripts)
			});
		});
	});


	/*
    * API to generate test script and submit it on Jenkins.     
    * 
    * Params: XML definition
    */
	app.post('/api/benchengine/submit', function(req, res) {
		var raw_definition = req.rawBody; //Raw XML to be parsed

		parseDefinition(raw_definition, function(generatedOutput){

			var setupScript = parseSetupScript(raw_definition, function(setupScript){

				//console.log('parser.js: setupScript: '+setupScript);
				
				var setupMachine=req.query.machine;
				console.log('parser.js: setupMachine: '+setupMachine);
				
				var jenkinsAPI =  global.APP_DATA.jenkins_base + "/buildWithParameters?token=xYz@123&setupScript="+encodeURIComponent(setupScript)+'&setupMachine='+encodeURIComponent(setupMachine)+'&benchmarkScript='+encodeURIComponent(generatedOutput)+'&benchmarkMachine='+encodeURIComponent(req.query.machine);  

				console.log(`the selected machine is ${req.query.machine}`);

				//console.log('parser.js: Calling jenkinsAPI: '+jenkinsAPI);
				
				var jenkinsURL =  global.APP_DATA.jenkins_base + "/buildWithParameters"
				var postBody = "token=xYz@123&setupScript="+encodeURIComponent(setupScript)+'&setupMachine='+encodeURIComponent(setupMachine)+'&benchmarkScript='+encodeURIComponent(generatedOutput)+'&benchmarkMachine='+encodeURIComponent(req.query.machine);  
				
				var jenkinsCrumbIssuer = global.APP_DATA.jenkins_root + '/crumbIssuer/api/xml?xpath=concat(//crumbRequestField,":",//crumb)';								
				
				var crumb;
				
				var getOptions = {
						url: jenkinsCrumbIssuer,
						auth: {
							'user': global.jenkinsUsername,
							'pass': global.jenkinsPwd,
						}
				};
				
				request.get(getOptions, function(error, response, body){
					console.log('parser.js: Making GET request for Jenkins Crumb');
					console.log('parser.js: request error: '+error);
					console.log('parser.js: request response: '+response);
					console.log('parser.js: request body: '+body); //Example: Jenkins-Crumb:0b91d58bb62f79cda34a1b7144a6530b

					crumb = body.split(':')[1]; //Example: 0b91d58bb62f79cda34a1b7144a6530b
					console.log('parser.js: request crumb: '+crumb+' crumb.length: '+crumb.length);					

					var postOptions = {
							url: jenkinsURL,
							headers: {
								'content-type': 'application/x-www-form-urlencoded', 
								'Jenkins-Crumb': crumb
							},
							auth: {
								'user': global.jenkinsUsername,
								'pass': global.jenkinsPwd,
							},
							body: postBody
					};					
					
					request.post(postOptions, function(error, response, body){
						console.log('parser.js: Making POST request for submitting job');
						console.log('parser.js: request error: '+error);
						console.log('parser.js: request response: '+response);
						console.log('parser.js: request body: '+body);
						
						/* Note: Don't delete the commented lines since they will be helpful in debugging. */
						//var str = JSON.stringify(response);
						//console.log('parser.js: str: '+str);
						
						var queueLocation = response.headers.location;
						console.log('parser.js: queueLocation: '+queueLocation);
						
						//Prints out JSON object in a nicely formatted and readable format
						//console.log(JSON.stringify(response, null, 4));

						getJenkinsBuildURL(queueLocation, crumb, function(jenkinsBuildURL){				
							
							console.log('parser.js: jenkinsBuildURL '+jenkinsBuildURL);
							res.send(jenkinsBuildURL);
						
						});
					});					
				});		
			});
		});
	});
}

function getJenkinsBuildURL(queueLocation, crumb, callback){

	console.log('parser.js: Entering getJenkinsBuildURL()');
	
	var jenkinsBuildURL;
	var jenkinsURL = queueLocation + '/api/json?pretty=true'
	var getOptions = {
			url: jenkinsURL,
			headers: {
				'content-type': 'application/x-www-form-urlencoded', 
				'Jenkins-Crumb': crumb
			},
			auth: {
				'user': global.jenkinsUsername,
				'pass': global.jenkinsPwd,
			},
	};
	
	request.get(getOptions, function(error, response, body){
		console.log('parser.js: getJenkinsBuildURL() Making POST request for submitting job');
		console.log('parser.js: getJenkinsBuildURL() request error: '+error);
		
		/* Note: Both response and body are strings and not JSON objects 
		 * unlike in our previous requests. response also has the 
		 * same body along with some other info such as header */
		
		//console.log('parser.js: getJenkinsID() request response: '+response); 
		//console.log('parser.js: getJenkinsID() request body: '+body);
		
		//Convert body from string to JSON object
		var bodyObject = JSON.parse(body); 
		if (bodyObject.executable)
			{
			console.log("parser.js: getJenkinsBuildURL() Build has been scheduled by Jenkins.");
			jenkinsBuildURL = bodyObject.executable.url;
			}
		else
			{
			console.log("parser.js: getJenkinsBuildURL() Build hasn't been scheduled by Jenkins yet since bodyObject.executable is NULL");
			
			/* Since we don't have the build URL, return the URL to the Jenkins Project instead */
			jenkinsBuildURL = global.APP_DATA.jenkins_base;
			}		

		console.log('parser.js: getJenkinsBuildURL() jenkinsBuildURL '+jenkinsBuildURL);
		
		callback(jenkinsBuildURL);
		
	});	
	
	
}

function getPackageType(packageURL)
{
	console.log("util.js: Entering getPackageType()");
	var packageType = "";
	if (packageURL.indexOf(".zip") >= 0)
	{
		packageType = ".zip";
	}
	else if (packageURL.indexOf(".tar.gz") >= 0)
	{
		packageType = ".tar.gz";
	}
	else if (packageURL.indexOf(".jar") >= 0)
	{
		packageType = ".jar";
	}
	else
	{
		console.log("getPackageType() ERROR: Unknown Package Type");
	}
	console.log("getPackageType() packageType:"+packageType);
	return packageType;
	
}

function getExtractedPackageName(result, packageURL)
{
	console.log("util.js: Entering getExtractedPackageName()");
	var packageName;
	
	var isCustomBuild = (result.benchmarks.benchmark.isCustomBuild == "true");
	console.log('parser.js: getExtractedPackageName() isCustomBuild: '+isCustomBuild);
	
	if (isCustomBuild)
	{
		var packageType = getPackageType(packageURL);
		console.log("parser.js: getExtractedPackageName() It's a custom build");
    	var packageURLSplits = packageURL.split('/');
    	packageName = packageURLSplits[packageURLSplits.length - 1].replace(packageType,''); 
	}
	else
	{
		packageName = result.benchmarks.benchmark.buildName;			
	}
	console.log('parser.js: getExtractedPackageName() packageName: '+packageName);	
	return packageName;
}

/* TODO: Cleanup this function after both the setup and benchmark scripts are finalized.
 * Leaving all the variables here just in case they are needed. Remove the unused ones eventually.
 * */
function parseSetupScript(raw_definition, callback){
	console.log('parser.js: Entering parseSetupScript()');
	parser.parseString(raw_definition, function (err, result) { //Convert XML to JSON

//		var str = JSON.stringify(result);
//		console.log('parser.js: parseSetupScript() str: '+str);
		
		var benchmarkName = result.benchmarks.benchmark.$.name;
		var benchmarkVariant = result.benchmarks.benchmark.$.variant;
		console.log('parser.js: parseSetupScript() benchmarkName: '+benchmarkName+' benchmarkVariant: '+benchmarkVariant);	
		
		var buildCompressionType;
		var buildExtractCmd = '';
		var buildSetupCmds = '';
		
		var platform = result.benchmarks.benchmark.platform;
		console.log('parser.js: parseSetupScript() platform: '+platform);
		
		var scriptType = Object.keys(result.benchmarks.benchmark.properties.scripts)[0];	
		var iterations = result.benchmarks.benchmark.iterations;
		
		//Need to be defined before evaluating Header script below
		var buildURL = result.benchmarks.benchmark.build;
		console.log('parser.js: parseSetupScript() buildURL: '+buildURL);
		
		var buildName = getExtractedPackageName(result, buildURL);
		
		var pkgName = result.benchmarks.benchmark.properties.scripts[scriptType].$.pkgName;
		console.log('parser.js: parseSetupScript() pkgName: '+pkgName);		
		
		var script = 'setup.sh';
		var packageURL = global.APP_DATA.packages_base_url + `/${pkgName}_Package.zip`;					
		var zipFilename = packageURL.substring(packageURL.lastIndexOf('/')+1);
		
		var benchmarkExtractCmd = `unzip -q "${zipFilename}"`;

		var buildUsername = '$PERFFARM_CMVC_USERNAME';
		var buildPassword = '$PERFFARM_CMVC_PASSWORD';
		
		if (buildURL.toLowerCase().indexOf("artifactory") >= 0)
		{
			console.log("parser.js: parseSetupScript() It's an Artifactory Build");
			
			buildUsername = '$JTCTSTSL_ARTIFACTORY_USERNAME';
			buildPassword = '$JTCTSTSL_ARTIFACTORY_PASSWORD';			
		}
		else
		{
			console.log("parser.js: parseSetupScript() It's NOT an Artifactory Build");
		}	
		
		if (buildURL.toLowerCase().indexOf("adoptopenjdk") >= 0)
		{
			console.log("parser.js: parseSetupScript() It's an AdoptOpenJDK Build");
			
			platform = platform.substring(1, 5);
			
			if (platform == 'wa64')
			{
				buildCompressionType = '.zip';
				buildExtractCmd = `unzip -q ${buildName}${buildCompressionType} -d ${buildName}/sdk`;
			}
			else
			{
				buildCompressionType = '.tar.gz';
				buildExtractCmd = `tar -xf ${buildName}${buildCompressionType} -C ${buildName}/sdk --strip-components=2`;
			}
			buildSetupCmds += `curl -OLJs ${buildURL}` + '\n\t';
			buildSetupCmds += `mkdir -p ${buildName}/sdk` + '\n\t';
			buildSetupCmds += `${buildExtractCmd}` + '\n\t';
			buildSetupCmds += `chmod -R 755 ${buildName}`;
		}
		else
		{
			platform = platform.substring(1, 3);
			
			if (platform == 'mz')
			{
				packageURL = global.APP_DATA.packages_base_url + `/${pkgName}_Package.pax.Z`;
				zipFilename = packageURL.substring(packageURL.lastIndexOf('/')+1);
				benchmarkExtractCmd = `pax -r -f "${zipFilename}"`;
				
				buildSetupCmds += `curl -knOs -u ${buildUsername}:${buildPassword} ${buildURL}` + '\n\t';
				buildSetupCmds += `filename=$(basename "${buildURL}")` + '\n\t';
				buildSetupCmds += `mkdir -p $SDK` + '\n\t';
				buildSetupCmds += `cd $SDK` + '\n\t';
				buildSetupCmds += `jar -xf "../$filename"` + '\n\t';
				buildSetupCmds += `chmod -R 755 $SDK`;
			}
			else
			{
				buildSetupCmds += `curl -knOs -u ${buildUsername}:${buildPassword} ${buildURL}` + '\n\t';
				buildSetupCmds += `filename=$(basename "${buildURL}")` + '\n\t';
				buildSetupCmds += `mkdir -p ${buildName}` + '\n\t';
				buildSetupCmds += `unzip -q "$filename" -d ${buildName}` + '\n\t';
				buildSetupCmds += `chmod -R 755 ${buildName}`;
			}
			
			var streamName = result.benchmarks.benchmark.streamName;
			if (streamName == 'OpenJ9')
			{
				console.log('parser.js: parseSetupScript() streamName: OpenJ9');
				buildSetupCmds += '\n\t' + `mv ${buildName}/jdk ${buildName}/sdk`;
			}
		}
		
		var setupFile = fs.readFileSync(script, 'utf8');
		var setupScript = eval('`'+setupFile+'`'); //Evaluate script params (${XXXXXX})
		callback(setupScript);

	});
}

function parseDefinition(raw_definition, callback){
	console.log('parser.js: Entering parseDefinition()');
	parser.parseString(raw_definition, function (err, result) { //Convert XML to JSON

		let benchmarkName = result.benchmarks.benchmark.$.name;
		let benchmarkVariant = result.benchmarks.benchmark.$.variant;

		//Need to be defined before evaluating Header script below
		var buildURL = result.benchmarks.benchmark.build;
		console.log('parser.js: parseDefinition() buildURL: '+buildURL);
		
		var scriptType = Object.keys(result.benchmarks.benchmark.properties.scripts)[0];	
		console.log('parser.js: parseDefinition() scriptType: '+scriptType);
		
		var pkgName = result.benchmarks.benchmark.properties.scripts[scriptType].$.pkgName;
		
		console.log('parser.js: parseDefinition() pkgName: '+pkgName);
		var packageURL = global.APP_DATA.packages_base_url + `/${pkgName}_Package.zip`;

		console.log('parser.js: parseDefinition() packageURL: '+packageURL);
		
		var buildName = getExtractedPackageName(result, buildURL);
		
		var zipFilename = packageURL.substring(packageURL.lastIndexOf('/')+1);
		let iterations = result.benchmarks.benchmark.iterations;

		// Changes to this delimiter affect TestResultSummaryService's BenchmarkParser class.
		// Please confirm any delimiter changes
		let benchmarkJobDelimiter = "********** START OF NEW TESTCI BENCHMARK JOB **********";

		getHeader(function (header){

			var generatedOutput = generateDate();
			generatedOutput += eval('`'+header+'`'); //Evaluate header params (${XXXXXX})
			generatedOutput += '\n######### Generated Script #########\n';

			if(iterations > 1){
				generatedOutput += `for iteration in {1..${iterations}}` + '\n';
				generatedOutput += 'do \n';
				generatedOutput += "echo \"Start of iteration $iteration\" \n";
			}

			generatedOutput += `echo ""\n`;
			generatedOutput += `echo "${benchmarkJobDelimiter}"\n`;
			generatedOutput += `echo "Benchmark Name: ${benchmarkName} Benchmark Variant: ${benchmarkVariant}"\n`;
			generatedOutput += `echo "Benchmark Product: ${buildName}"\n`;
			generatedOutput += `echo ""\n`;
			generatedOutput += generateENV(result);
			generatedOutput += '\n## HW Specific Environment Vars ##\n';
			generatedOutput += generateHWENV(result);
			generatedOutput += '\n';
			
			if (scriptType == 'java')
			{
				generatedOutput += generateJavaRunCommands(result);
			}
			else
			{
				generatedOutput += generateScriptCommands(result);
			}			

			if(iterations > 1){
				generatedOutput += "echo \"End of iteration $iteration\" \n";
				generatedOutput = generatedOutput + 'done'
			}

			fs.readFile('logo.txt', 'utf8', function(err, contents) {
				generatedOutput = contents + '\n' +  generatedOutput;

				callback(generatedOutput);
			});
		});      		
	});
}

function getHeader(callback){
	console.log('parser.js: Entering getHeader()');
    fs.readFile('script_header.sh', 'utf8', function(err, contents) {
        callback(contents);
    });
}

function generateDate(){
	console.log('parser.js: Entering generateDate()');
	var dt = dateTime.create();
	var formatted = dt.format('Y-m-d H:M'); 
	return '# ' + formatted + '\n';
}

function generateENV(result){
	console.log('parser.js: Entering generateENV()');
    var ENV = result.benchmarks.benchmark.properties.ENV.property;
    var ENVString = '';
    for (var property in ENV){
	    var envVar = ENV[property].$.name;
	    var envVal = ENV[property]._ ? ENV[property]._ : '';        
	    
	    ENVString += `export ${envVar}="${envVal}"\n`;
	}

	return ENVString;
}

function generateHWENV(result){
	console.log('parser.js: Entering generateHWENV()');
    var HW_ENV = result.benchmarks.benchmark.properties.HW_ENV.property;
    var ENVString = '';
    for (var property in HW_ENV){
	    var envVar = HW_ENV[property].$.name;
	    var envVal = HW_ENV[property]._ ? HW_ENV[property]._ : '';        
	    
	    ENVString += `export ${envVar}="${envVal}"\n`;
	}

	return ENVString;
}

function insertSpecificCommands(result){
	console.log('parser.js: Entering insertSpecificCommands()');
	
	var benchmarkName = result.benchmarks.benchmark.$.name;
	var platform = result.benchmarks.benchmark.platform.substring(1, 3);
	
	var command = '';
	if (benchmarkName == 'ILOG_WODM' && platform == 'mz')
	{
		console.log("parser.js: insertSpecificCommands() benchmarkName == 'ILOG_WODM' && platform == 'mz'");
		command = "bash encode.sh -execute 'run_ilog_with_gcmv.sh configure.sh ../gcmv/summarizer/scripts/*.pl ../gcmv/summarizer/lib/GCMV/*.pm'\n";
	}
	return command;
}

function generateScriptCommands(result){

	console.log('parser.js: Entering generateScriptCommands()');
	
	var scripts = result.benchmarks.benchmark.properties.scripts;
 	var commandString = '';

    for (var script in scripts){
	    var interpretor = script;
	    var dir = scripts[script].$.dir;
	    var file = scripts[script].$.file;
	    var args = scripts[script].argument;

	    var argString = '';

	    for(var arg in args){

	        var param,input;

	        try {
	            param = args[arg].$.arg;
	            input = args[arg]._;
	        }
	        catch(err) { // Temp solution: There's no array when we only have one param and input
	            param = args.$.arg;
	            input = args._;
	            argString += `${param} ${input}` + ' ';

	            break;
	        }

	        argString += `${param} ${input}` + ' ';
	    }
	    commandString += insertSpecificCommands(result);
	    commandString += `${interpretor} ./${file} ${argString}\n`;
	}

	return commandString;
}

function generateJavaRunCommands(result){

	console.log('parser.js: Entering generateJavaRunCommands()');
	
	var scripts = result.benchmarks.benchmark.properties.scripts;
	
	var buildName = result.benchmarks.benchmark.buildName;
	console.log('parser.js: generateJavaRunCommands() buildName: '+buildName);
	
	var jdkDir="$WORKSPACE/../../sdks";
	
 	var commandString = '';

    for (var script in scripts){
	    var interpretor = script;
	    var dir = scripts[script].$.dir;
	    var args = scripts[script].argument;

	    var argString = '';

	    for(var arg in args){

	        var param,input;

	        try {
	            input = args[arg]._;
	            //console.log('parser.js: generateJavaRunCommands() input:' +input);
	        }
	        catch(err) { // Temp solution: There's no array when we only have one param and input
	            input = args._;
	            argString += `${input}` + ' ';

	            break;
	        }

	        argString += `${input}` + ' ';
	    }

	    commandString += `${jdkDir}/${buildName}/sdk/bin/${interpretor} ${argString}\n`;
	}

	return commandString;
}
