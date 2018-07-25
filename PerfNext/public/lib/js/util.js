//Data model to represent the UI info
var benchmarkMeta;

function populateMachines(data, isMainLauncher) {
	console.log('util.js: Entering populateMachines()');
    console.log(data);
  
	for (var key in data)
	{
		//console.log('util.js: data[key]: '+key);
		$('#machine-selection').append(`<option>${key}</option>`)
	}
}

function getBuildDateID(isBaseline) {
	console.log('Entering getBuildDateID()');
	var buildDateID = '#BuildDate';
	
	if (isBaseline)
	{
		buildDateID = '#BaselineBuildDate';
	}
	return buildDateID;
	
}

function getReleaseHost(isBaseline) {
	console.log('Entering getReleaseHost()');
	var releaseHost;

    if (isBaseline)
    {
    	releaseHost = $('#Baseline-ReleaseHost').val();
    }
    else
    {
    	releaseHost = $('#ReleaseHost').val();
    }	
	return releaseHost;	
}

function populateAOJBuilds(aojData, isMainLauncher, isBaseline) {
	console.log('Entering populateAOJBuilds() **********');
	
	var buildDateID = getBuildDateID(isBaseline);   
    //console.log(aojData);
	
	if (aojData != 'No matches for your query!')
	{
		aojData = JSON.parse(aojData); //Convert string to JSON
		
		var buildDate;

		if (aojData.hasOwnProperty('length'))
		{
			console.log('populateAOJBuilds() aojData has length: '+aojData.length);

			for(var i = 0; i < aojData.length; i++) {
				console.log('populateAOJBuilds() Populating AOJ builds');
				buildDate = aojData[i].release_name;
				$(buildDateID).append(`<option>${buildDate}</option>`);
			}   
		}
		else
		{
			console.log('populateAOJBuilds() aojData has NO length. Hence, one build available');
			buildDate = aojData.release_name;
			$(buildDateID).append(`<option>${buildDate}</option>`);
		}
	}
    
}

function populateEspressoBuilds(data, isMainLauncher, isBaseline) {
	console.log('util.js: Entering populateEspressoBuilds() **********');
    //console.log(data);
    
	var buildDateID = getBuildDateID(isBaseline); 
	var streamName = getStreamName(isBaseline);
	
    var lines = data.split('|');

    $(buildDateID).empty();
    
    console.log('lines: '+lines.length);
    var buildDate;
    for(var i = 0; i < lines.length; i=i+3){
    	//console.log('lines['+i+']: '+lines[i]);
    	buildDate = lines[i];
    	//console.log('util.js: buildDate: '+buildDate+ 'date length='+buildDate.length);

    	//OpenJ9 SDK signature: pxa6490ea-20171013_367158-openj9.zip
    	//Regular SDK signature: pxa6490ea-20170928_01-sdk.jar
    	
    	// All build dates (i.e. 20170905_01) except for OpenJ9 are 11 characters
    	// OpenJ9 build dates are 15 characters
    	
    	//Add +1 to the above number (i.e. 11) since buildDate has a extra space char
    	//Hence, using 12 instead of 11 below
    	
    	if (streamName == 'OpenJ9')
    	{
    		console.log('util.js: Stream selected: OpenJ9');

    		if (buildDate.length > 12)
    		{
    			$(buildDateID).append(`<option>${buildDate}</option>`);
    		}
    	}
    	else if (streamName == 'Java 9')
    	{
    		console.log('util.js: Stream selected: Java 9');

    		if (buildDate.length <= 12)
    		{
    			$(buildDateID).append(`<option>${buildDate}</option>`);
    		}
    	}
    	else 
    	{
    		$(buildDateID).append(`<option>${buildDate}</option>`);
    	}	
    	
    }
}

function getStreamName(isBaseline) {
	console.log('Entering getStreamName()');
	
	var stream;

	if (isBaseline)
	{
		stream = $('#Baseline-Runtime-version').val();
	}
	else
	{
		stream = $('#Runtime-version').val();
	}
	return stream;
}

function getStream(isBaseline) {
	console.log('Entering getStream()');
	
	var stream = getStreamName(isBaseline);
	
	switch (stream) {
	
	case 'Java 7':
		return 70;
	case 'Java 8':
		return 80;
	case 'Java 9':
		return 90;
	case 'OpenJ9':
		return 90;
	default:
		console.log('util.js: getStream: ERROR stream: '+stream);
	
	}
}

function getAOJPlatform() {
	console.log('Entering getAOJPlatform()');
	
    var OS = document.getElementById('dtextlabel').innerText;
    console.log('OS: '+OS);
	
    var platform;
    
    switch (OS) {
    
    case 'Windows AMD x64 64 bit':
    	platform = 'x64_Win';
    	break;
    case 'AIX PPC 64 bit':
    	platform = 'ppc64_AIX';
    	break;
    case 'Linux AMD x64 64 bit':
    	platform = 'x64_Linux';
    	break;
    case 'Linux PPCLE 64 bit':
    	platform = 'ppc64le_Linux';
    	break;
    case 'Linux z Series 64 bit':
    	platform = 's390x_Linux';
    	break;
	default:
		console.log('updateAOJProduct: Unsupported AdoptOpenJDK Platorm: '+OS);
		platform = '';
	
    }
    return platform;
}

function getEspressoPlatform() {
	console.log('Entering getEspressoPlatform()');
	
    OS = document.getElementById('dtextlabel').innerText;
    console.log('OS: '+OS);
    
    var platform;
    
    switch (OS) {
    
    case 'Windows Intel x86 32 bit':
    	platform = 'pwi32';
    	break;
    case 'Windows AMD x64 64 bit':
    	platform = 'pwa64';
    	break;
    case 'AIX PPC 64 bit':
    	platform = 'pap64';
    	break;
    case 'Linux Intel x86 32 bit':
    	platform = 'pxi32';
    	break;
    case 'Linux AMD x64 64 bit':
    	platform = 'pxa64';
    	break;
    case 'Linux PPC 32 bit':
    	platform = 'pxp32';
    	break;
    case 'Linux PPC 64 bit':
    	platform = 'pxp64';
    	break;
    case 'Linux PPCLE 64 bit':
    	platform = 'pxl64';
    	break;
    case 'Linux z Series 31 bit':
    	platform = 'pxz31';
    	break;
    case 'Linux z Series 64 bit':
    	platform = 'pxz64';
    	break;
    case 'MVS z Series 31 bit':
    	platform = 'pmz31';
    	break;
    case 'MVS z Series 64 bit':
    	platform = 'pmz64';
    	break;
	default:
		console.log('updateProduct() ERROR OS: '+OS);
	
    }
    return platform;
}

/* Returns the buildPath for AdoptOpenJDK builds: /<variant>/<build type>/<platform>/<build>/<data type> */

function getAOJBuildPath(isBaseline, dataType, forDownload) {
	console.log('Entering updateAOJBuildPath()');
	
    var variant, buildType, platform, build, buildPath, chosenBuild;
    
    platform = getAOJPlatform();
    
    if (isBaseline)
    	{
    	variant = $('#Baseline-AOJ-Variant').val();
    	buildType = $('#Baseline-AOJ-BuildType').val();
    	build = $('#Baseline-AOJ-Build').val();
    	chosenBuild = $('#BaselineBuildDate').val();
    	}
    else
    	{
    	variant = $('#AOJ-Variant').val();
    	buildType = $('#AOJ-BuildType').val();
    	build = $('#AOJ-Build').val();
    	chosenBuild = $('#BuildDate').val();
    	}
    
    if (forDownload)
    	{
        buildPath = "/"+variant+"/"+buildType+"/"+platform+"/"+chosenBuild+"/"+dataType;
    	}
    else
    	{
        buildPath = "/"+variant+"/"+buildType+"/"+platform+"/"+build+"/"+dataType;
    	}
    
    return buildPath;
}

function updateAOJProduct(isBaseline) {
	console.log('Entering updateAOJProduct()');
    
	var buildDateID = getBuildDateID(isBaseline);
    $(buildDateID).empty();  
    
    var variant, platform, dataType, product;
    dataType = 'info';
    
    if (isBaseline)
    	{
    	variant = $('#Baseline-AOJ-Variant').val();
    	}
    else
    	{
    	variant = $('#AOJ-Variant').val();
    	}
    
    platform = getAOJPlatform();

    if (platform)
    {
    	console.log('updateAOJProduct: platform: '+platform);
    	product = variant + '_' + platform;

    	if (isBaseline)
    	{
    		document.getElementById('BaselineProductID').value = product;
    	}
    	else
    	{
    		document.getElementById('ProductID').value = product;
    	}	

    	buildPath = getAOJBuildPath(isBaseline, dataType, false);
    	
    	console.log('updateAOJProduct: buildPath: '+buildPath);

    	$.get("/api/aojBuilds?buildPath="+buildPath, function(data, status) {
    		console.log('util.js: Calling populateAOJBuildDates()');
    		populateAOJBuilds(data, isMainLauncher, isBaseline);
    	});
    }
}

function updateEspressoProduct(isBaseline) {
    console.log('util.js: Entering updateEspressoProduct()');
    
	var buildDateID = getBuildDateID(isBaseline);
    $(buildDateID).empty(); 
    
    var stream = getStream(isBaseline);
    
    var sr, fp, ifx;
    if (isBaseline)
    {
    	sr = $('#Baseline-Runtime-sub-version-1').val().toLowerCase();
    	fp = $('#Baseline-Runtime-sub-version-2').val().toLowerCase();
    	ifx = $('#Baseline-Runtime-sub-version-3').val().toLowerCase();
    }
    else
    {
    	sr = $('#Runtime-sub-version-1').val().toLowerCase();
    	fp = $('#Runtime-sub-version-2').val().toLowerCase();
    	ifx = $('#Runtime-sub-version-3').val().toLowerCase();
    }
    
    if (sr == 'ga')
    {
    	console.log('utils.js: SR is GA');
    	sr = 'ea';
    }
    
    var nonOSBuildInfo = stream+sr+fp+ifx;
    console.info('util.js: nonOSBuildInfo: '+nonOSBuildInfo);      
    
    var product = getEspressoPlatform() + nonOSBuildInfo;
    
	console.log('util.js: updateProduct: product: '+product);
	
	if (isBaseline)
	{
		document.getElementById('BaselineProductID').value = product;
	}
	else
	{
		document.getElementById('ProductID').value = product;
	}	
	
    $.get("/api/espressoBuilds?product="+product, function(data, status) {
    	console.log('util.js: Calling populateEspressoBuilds()');
    	populateEspressoBuilds(data, isMainLauncher, isBaseline);
    });

}

function updateProduct(isBaseline) {
    console.log('Entering updateProduct()');
    
    var releaseHost = getReleaseHost(isBaseline);
	
	if (releaseHost == 'AdoptOpenJDK')
	{
		updateAOJProduct(isBaseline);
	}
	else
	{
		updateEspressoProduct(isBaseline);
	}
	
}

function populateSelectedBmArguments(name, variant) {
	
	console.log('util.js: Entering populateSelectedBmArguments()');
    var idToFind = populateArguments(name, variant);

    selectedBenchmark.name = name;
    selectedBenchmark.variant = variant;
    selectedBenchmark.data = benchmarkArgData[idToFind];
    selectedBenchmark.iterations = 'iteration-input-' + idToFind;
    
    var benchmark = {};
    benchmark.name = name;
    benchmark.variant = variant;
    benchmark.data = benchmarkArgData[idToFind];
    benchmark.iterations = 'iteration-input-' + idToFind;

    /* Can't simply do selectedBenchmarks[idToFind]=selectedBenchmark;
     * Since selectedBenchmark is global variable, it leads to a bug where the benchmark id
     * does not correspond to its related info (i.e. name, variant etc). Instead, it corresponds
     * to the last selected benchmark.
     */
    selectedBenchmarks[idToFind]=benchmark;
    
}

function getHostID() {
	
	console.log('util.js: Entering getHostID()');
	
	var machine = $('#machine-selection').val();
	console.log("util.js: getHostID() machineName: "+machine);
	
	var hostID = machineList[machine];
	console.log('util.js: getHostID() hostID: '+hostID);
	
	return hostID;
}

function getHostNode() {

	console.log('util.js: Entering getHostNode()');
		
	var hostID = getHostID();

	var hostNode = allmachinesInfo.querySelector('[id="' + hostID + '"]');
	
	var hostName = hostNode.getElementsByTagName('name')[0].innerHTML;
	console.log("util.js populateMachineSpecificArguments hostName: "+hostName);
	
	return hostNode;
	
}

function getMachineNode() {
	
	console.log('util.js: Entering getMachineNode()');
	
	var hostNode = getHostNode() ;
	
	var machineId = hostNode.getElementsByTagName('machine')[0].getAttribute('id');
	console.log("util.js populateMachineSpecificArguments machineId: "+machineId);
	
	var machineNode = allmachinesInfo.querySelector('[id="' + machineId + '"]');
	
	return machineNode;
}


function getCPUAffinity() {

	console.log('util.js: Entering getCPUAffinity()');
	
	var platform = getEspressoPlatform().substring(1, 3);
	console.log('util.js: insertCPUAffinity() platform: '+platform);	
	
	var affCmd; 

	var machineNode = getMachineNode();
	var numPhysicalCpus = parseInt(machineNode.getElementsByTagName('physical')[0].innerHTML);
	var numLogicalCpus = parseInt(machineNode.getElementsByTagName('logical')[0].innerHTML);
	console.log("util.js populateMachineSpecificArguments numPhysicalCpus: "+numPhysicalCpus+" numLogicalCpus: "+numLogicalCpus); 
	
	var isSMTMachine = (numPhysicalCpus != numLogicalCpus);
	console.log('util.js: getCPUAffinity() isSMTMachine: '+isSMTMachine);
	
	var runSMT = document.getElementById('runSMT').checked;
	var chosenNumCores = $('#machine-cpu-affinity').val().split(' ')[0];
	
	/* TODO: Read up more on these affinity tools for different platforms 
	 * to verify if we're calculating these correctly 
	 * Numactl: Verified
	 * Taskset: Need to check the case for SMT
	 * Execrset: Need to check the case for SMT and formula 
	 * Windows Affinity: Add other cases beside 4 & 8
	 * zOS Affinity: User can manually enter the name of the script, that's on the Jenkins machine path*/
	var numactlCMD, tasksetCMD, execrsetCMD, windowsCMD, zosCMD;
	
	tasksetCMD = 'taskset -c 0-'+(chosenNumCores-1);
	execrsetCMD = 'execrset -c 0-'+((chosenNumCores*4)-1)+' -e';
	windowsCMD = 'cmd /C start /B /WAIT /AFFINITY ';
	zosCMD = '';
	
	if (chosenNumCores == 4)
		{
		windowsCMD += 'F';
		}
	else if (chosenNumCores == 8)
		{
		windowsCMD += 'FF';
		}
	else
		{
		console.log('util.js: getCPUAffinity() Need to read up more on Windows Affinity');
		}

	if (runSMT)
		{
		console.log('util.js: getCPUAffinity() runSMT is checked');
		numactlCMD = 'numactl --physcpubind=0-'+((chosenNumCores/2)-1)+','+(numPhysicalCpus)+'-'+(numPhysicalCpus+(chosenNumCores/2)-1)+' --membind=0';
		}
	else
		{
		console.log('util.js: getCPUAffinity() runSMT is NOT checked');
		numactlCMD = 'numactl --physcpubind=0-'+(chosenNumCores-1)+' --membind=0';
		}
	
	
	switch (platform) {

	case 'xi':
	case 'xa':
		affCmd = numactlCMD;
		break;
	case 'wi':
		affCmd = windowsCMD;
		break;
	case 'wa':
		affCmd = windowsCMD;
		break;
	case 'ap':
		affCmd = execrsetCMD;
		break;
	case 'xp':
		affCmd = numactlCMD;
		break;
	case 'xl':
		affCmd = numactlCMD;
		break;
	case 'xz':
		affCmd = tasksetCMD;
		break;
	case 'mz':
		affCmd = zosCMD;
		break;
	default:
		console.log('getCPUAffinity() ERROR OS: '+OS);

	}
	return affCmd;
}

function insertCapabilityEnvVars(capabilityName, hwEnvClassName, idToFind) {
	
	console.log('util.js: Entering insertCapabilityEnvVars()');
	
	var hostNode = getHostNode() ;
	
	//Will match all ids starting with the capabilityName
	var capabilityNode = hostNode.querySelector('[name^="' + capabilityName + '"]');
	var envVARs = 0;
	if (capabilityNode)
	{
		envVARs = capabilityNode.children;
		console.log("util.js insertCapabilityEnvVars capabilityNode envVARs.length: "+envVARs.length); 
	}
	
	if (envVARs.length > 0)
	{
		return populateArgumentsHelper(envVARs, hwEnvClassName, idToFind, true);
	}
	
}

function insertCPUAffinity(hwEnvClassName, idToFind) {
	
	console.log('util.js: Entering insertCPUAffinity()');
	
	var envVAR = 'CPU_AFFINITY';
	var value = getCPUAffinity();

	var id = 'ENV-' + envVAR;
	envData = {};
	envData.envVAR = envVAR;
	envData.value = value;
	
	benchmarkArgData[idToFind].HW_ENV[id] = envData;
	
	var size = value.length + 1;
	
	$('#'+idToFind).append('<tr class='+ hwEnvClassName +'><td style="padding-left: 30px">' + envVAR + '</td><td><input id=' + id + ' type="text" class="hw-env-input" style="background-color: transparent; border:none" size="' + size + '"value="' + value + '"></input></td></tr>');
	
}

function populateArgumentsHelper(environmentVARs, envClassName, idToFind, isHW) {
	
	console.log('util.js: Entering populateArgumentsHelper()');
	
	for (var i = 0; i < environmentVARs.length; i++) {
		var envVAR = environmentVARs[i].getAttribute('name');
		var value = environmentVARs[i].innerHTML;
		var id = 'ENV-' + envVAR;

		envData = {};
		envData.envVAR = envVAR;
		envData.value = value;
		
		var size = value.length + 1;
		var inputClassName;
		
		if (isHW)
			{
			benchmarkArgData[idToFind].HW_ENV[id] = envData;
			inputClassName = 'hw-env-input';
			}
		else
			{
			benchmarkArgData[idToFind].ENV[id] = envData;
			inputClassName = 'env-input';
			}

		//console.log(`[DEBUG] ${id} ${envVAR} ${value}`);
		//console.log(`Adding ENV id [${id}] to meta: \n` + JSON.stringify(envData, undefined, 2));

		$('#'+idToFind).append('<tr class='+ envClassName +'><td style="padding-left: 30px">' + envVAR + '</td><td><input id=' + id + ' type="text" class=' + inputClassName + ' style="background-color: transparent; border:none" size="' + size + '"value="' + value + '"></input></td></tr>');
	}
}

function populateHWSpecificArguments(name, variant) {
	
	console.log('util.js: Entering populateHWSpecificArguments() *********');
	
	var idToFind = 'benchmark-arguments-' + name + '-' + variant; //ID of the benchmark table
	
	var hwEnvClassName = 'hw-env-var'+ '-' + name + '-' + variant;
	
	$('.'+hwEnvClassName).remove();

	var hostID = getHostID();
	
	// Populate HW specific env vars if the machine exists in the machine database (i.e. master_machine_list.xml)
	if (hostID)
	{		
		console.log("util.js: populateMachineSpecificArguments() Machine exists in machine database");
		
		insertCPUAffinity(hwEnvClassName, idToFind);
		
		var chosenNumCores = $('#machine-cpu-affinity').val().split(' ')[0];
		var affinityCapabilityName = chosenNumCores+'way';
		console.log("util.js: populateMachineSpecificArguments() chosenNumCores: "+chosenNumCores); 

		insertCapabilityEnvVars(affinityCapabilityName, hwEnvClassName, idToFind);
		insertCapabilityEnvVars(name, hwEnvClassName, idToFind);
	}
	else
	{
		console.log("util.js: populateMachineSpecificArguments() Non PMA machines, hence not in machine database");
		benchmarkArgData[idToFind].HW_ENV = {};
	}
	
}

//Display Benchmark config table given the name and variant of the benchmark
//This function is called when user changes UI selection
//Both benchmarkArgData and selectedBenchmarks get updated when this function is called
function populateArguments(name, variant) {

	console.log('util.js: Entering populateArguments()');
	console.log('util.js: populateArguments() name: '+name+" variant: "+variant);
    //Hide the currently shown table
    //All benchmark config tables are marked with 'benchmark-arguments' class
    $('.benchmark-arguments').hide();

    var idToFind = 'benchmark-arguments-' + name + '-' + variant; //ID of the benchmark table

    //Check if a table for the specific name + variant benchmark exists
    // If so, display it, else create new table for it
    
    if ($("[id='" + idToFind + "']").length == 0) {

        var benchmarkNode = allBenchmarkInfo.querySelector('[name="' + name + '"][variant="' + variant + '"]'); //Find the data in the prev. retrieved data
        var scripts = benchmarkNode.getElementsByTagName('scripts')[0].children;
        var environmentVARs = benchmarkNode.getElementsByTagName('ENV')[0].children;
        var itr = benchmarkNode.getElementsByTagName('iterations')[0].innerHTML;
        console.log("util.js populateArguments itr: "+itr);
        
        $('#arguments-table').append('<tbody id="' + idToFind + '" class="benchmark-arguments"></tbody>');
        
        var bmArgsSelector = '#'+idToFind;
        
        benchmarkMeta = {}; //Data model to represent the UI info

        benchmarkMeta.scripts = {};
        benchmarkMeta.ENV = {};
        benchmarkMeta.HW_ENV = {};

        //Add iterations at top of the table
        $(bmArgsSelector).append('<tr><td style="padding-left: 30px"><b><i>Iterations</i></b></td><td><input class="iteration-input" id="iteration-input-' + idToFind + '" type="text" style="background-color: transparent; border:none" value="' + itr + '"></input></td></tr>');
        $(bmArgsSelector).append('<tr><td colspan="2" ><b>Scripts</b></td></tr>');

        //For each script att of the benchmark        
        for (var i = 0; i < scripts.length; i++) {
            var dir = scripts[i].getAttribute('dir');
            var fileName = scripts[i].getAttribute('file');
            var pkgName = scripts[i].getAttribute('pkgName');
            var interpretor = scripts[i].tagName;
            var id = 'script-' + interpretor + '-' + fileName;
            var pkgId = 'script-' + interpretor + '-' + pkgName;
            var args = scripts[i].getElementsByTagName('argument');

            var scriptData = {};
            scriptData.value = fileName;
            scriptData.interpretor = interpretor;
            scriptData.dir = dir;
            scriptData.pkgName = pkgName;
            scriptData.args = {};

            benchmarkMeta.scripts[id] = scriptData;

            var size = fileName.length + 1; //How wide the text input should be
            var pkgSize = pkgName.length + 1;

            //console.log(`[DEBUG] ${id} ${interpretor} ${fileName} ${dir}`);

            $(bmArgsSelector).append('<tr><td style="padding-left: 30px">' + interpretor + ' script</td><td><input id=' + id + ' type="text" class="script-input" style="background-color: transparent; border:none" size="' + size + '"value="' + fileName + '"></input></td></tr>');
            $(bmArgsSelector).append('<tr><td style="padding-left: 30px">Package</td><td><input id=' + pkgId + ' type="text" class="script-input" style="background-color: transparent; border:none" size="' + pkgSize + '"value="' + pkgName + '"></input></td></tr>');

            //For each argument of the script
            for (var j = 0; j < args.length; j++) {
                var arg = args[j].getAttribute('arg');
                argData = {};
                argData.value = args[j].innerHTML;
                
                var size = argData.value.length + 1;
                benchmarkMeta.scripts[id].args[arg] = argData;

                $(bmArgsSelector).append('<tr><td style="padding-left: 50px">' + arg + '</td><td><input script=' + id + ' id=' + arg + ' type="text" class="argument-input" style="background-color: transparent; border:none" size="' + size + '"value="' + argData.value + '"></input></td></tr>');
            }

            console.log(`Adding Script id [${id}] to meta: \n` + JSON.stringify(scriptData, undefined, 2));
        }

        benchmarkArgData[idToFind] = benchmarkMeta;
        //Check if any ENV vars, if so, add table header for it
        if (environmentVARs.length > 0)
        {
        	$(bmArgsSelector).append('<tr><td colspan="2"><b>Environment Variables</b></td></tr>');
        	populateArgumentsHelper(environmentVARs, "env-var", idToFind, false);
        }
        
         
        /* ************************************************************ */
        /* *********** Start: HW Specific Env Vars Parsing ************ */ 
        /* ************************************************************ */        
       
        var hwEnvClassName = 'hw-env-var'+ '-' + name + '-' + variant;
        $(bmArgsSelector).append('<tr class='+ 'header-'+hwEnvClassName +'><td colspan="2"><b>HW Specific Environment Vars</b></td></tr>');
        populateHWSpecificArguments(name, variant);
       
        /* ************************************************************ */
        /* ************* End: HW Specific Env Vars Parsing ************ */ 
        /* ************************************************************ */
    } 
    else //Table for variant was already created, so just show it
    {
    	$("[id='" + idToFind + "']").show(); //attribute selector is used, id may have special chars
    }

    return idToFind;
}

//Create XML benchmark definition file from UI data
function parseJob(benchmark, isBaseline) {

	console.log("util.js: Entering parseJob()");
	
    var idToFind = 'benchmark-arguments-' + benchmark.name + '-' + benchmark.variant;
    var benchmarkArguments = benchmark.data;

    console.log("The id to find is: " + idToFind)
    //console.log("Found the following benchmark arguments: \n" + JSON.stringify(benchmarkArguments, undefined, 2));

    var parser, xmlDoc;
    var text = '<?xml version="1.0"?><benchmarks><benchmark name="" variant=""><properties><scripts></scripts><ENV></ENV><HW_ENV></HW_ENV></properties></benchmark></benchmarks>'; //Empty "template"

    parser = new DOMParser();
    xmlDoc = parser.parseFromString(text, "text/xml");

    xmlDoc.getElementsByTagName('benchmark')[0].setAttribute('name', benchmark.name);
    xmlDoc.getElementsByTagName('benchmark')[0].setAttribute('variant', benchmark.variant);

    var scripts = benchmarkArguments.scripts;
    var ENV = benchmarkArguments.ENV;
    var HW_ENV = benchmarkArguments.HW_ENV;

    for (var script in scripts) {
        console.log("Processing Script : " + script)

        var scriptElement = xmlDoc.createElement(scripts[script].interpretor);
        scriptElement.setAttribute('dir', scripts[script].dir);
        scriptElement.setAttribute('file', scripts[script].value);
        scriptElement.setAttribute('pkgName', scripts[script].pkgName);

        console.log("Created the following Script element: \n" + scriptElement);

        var args = scripts[script].args;

        for (var arg in args) {
            var argumentElement = xmlDoc.createElement('argument');
            argumentElement.setAttribute('arg', arg);
            argumentElement.innerHTML = args[arg].value;
            scriptElement.appendChild(argumentElement);
        }

        xmlDoc.getElementsByTagName("scripts")[0].appendChild(scriptElement);
    }

    for (var envVar in ENV) {
        var envElement = xmlDoc.createElement('property');
        envElement.setAttribute('name', ENV[envVar].envVAR);
        envElement.innerHTML = ENV[envVar].value;
        xmlDoc.getElementsByTagName("ENV")[0].appendChild(envElement);
    }

    for (var envVar in HW_ENV) {
        var envElement = xmlDoc.createElement('property');
        envElement.setAttribute('name', HW_ENV[envVar].envVAR);
        envElement.innerHTML = HW_ENV[envVar].value;
        xmlDoc.getElementsByTagName("HW_ENV")[0].appendChild(envElement);
    }
    
    var build = xmlDoc.createElement('build');
    
    var buildName = xmlDoc.createElement('buildName');
    var platform = xmlDoc.createElement('platform');
    
    platform.innerHTML = getEspressoPlatform();
    
    var product = $('#ProductID').val();
    var buildDate = $('#BuildDate').val();
    var overrideBuildUrlID = 'OverrideBuildURL';
    var buildURL = $('#BuildURL').val();
    
	var releaseHost = getReleaseHost(isBaseline);
    
    if (isBaseline)
    	{
    	product = $('#BaselineProductID').val();
    	buildDate = $('#BaselineBuildDate').val();
    	overrideBuildUrlID = 'BaselineOverrideBuildURL';
    	buildURL = $('#BaselineBuildURL').val();
    	}
    
    var isCustomBuild = xmlDoc.createElement('isCustomBuild');
    isCustomBuild.innerHTML = document.getElementById(overrideBuildUrlID).checked;
    
    console.log('util.js: product: '+product+', buildDate: '+buildDate);
    
    if (document.getElementById(overrideBuildUrlID).checked)
    {
    	console.log('util.js: OverrideBuildURL is checked');
    	var buildURLSplits = buildURL.split('/');
    	buildName.innerHTML = buildURLSplits[buildURLSplits.length - 1].split('.')[0];  
    }
    else
    {
    	console.log('util.js: OverrideBuildURL is not checked');

    	if (releaseHost == 'AdoptOpenJDK')
    	{
    		var dataType = 'binary';
    		buildPath = getAOJBuildPath(isBaseline, dataType, true);
    		buildURL = 'https://api.adoptopenjdk.net'+buildPath;
    		buildName.innerHTML = product+"_"+buildDate;
    	}
    	else
    	{
    		console.log("parseJob() buildDate.length: "+buildDate.length);

    	    buildName.innerHTML = product+"-"+buildDate;   	    
    	    
    		//OpenJ9 SDK signature: pxa6490ea-20171013_367158-openj9.zip
    		//Regular SDK signature: pxa6490ea-20170928_01-sdk.jar
    		var buildType = 'sdk.jar';

    		// All build dates (i.e. 20170905_01) except for OpenJ9 are 11 characters
    		// OpenJ9 build dates are 15 characters
    		if (buildDate.length > 11)
    		{
    			console.log('utils.js: Build date indicates that OpenJ9 build is selected');
    			buildType = 'openj9.zip';
    		}
    		buildURL = appData.builds_server_url + product + '/'+buildDate+'/'+product+'-'+buildDate+'-'+buildType;

			var streamName = xmlDoc.createElement('streamName');
			streamName.innerHTML = getStreamName(isBaseline);
			xmlDoc.getElementsByTagName("benchmark")[0].appendChild(streamName);
    	}
    }
    console.log("parseJob() buildName.innerHTML: "+buildName.innerHTML);
    build.innerHTML = buildURL;
    xmlDoc.getElementsByTagName("benchmark")[0].appendChild(build);
    xmlDoc.getElementsByTagName("benchmark")[0].appendChild(buildName);
    xmlDoc.getElementsByTagName("benchmark")[0].appendChild(platform);
    xmlDoc.getElementsByTagName("benchmark")[0].appendChild(isCustomBuild);

    var iterations = xmlDoc.createElement('iterations');
    iterations.innerHTML = $('#' + benchmark.iterations).val();
    xmlDoc.getElementsByTagName("benchmark")[0].appendChild(iterations);

    //console.log('parseJob() xmlDoc: ' + xmlDoc)
    
    return (new XMLSerializer()).serializeToString(xmlDoc);
}


function submitJobHelper(key, isBaseline) {
	
	console.log("util.js Entering submitJobHelper()");
	
    console.log("submitJob() Key: "+key);
    
    var benchmarkName = selectedBenchmarks[key].name + '-' + selectedBenchmarks[key].variant;
    
    if (isBaseline)
    	{
    	benchmarkName += ' (Baseline Build)';
    	}
    else
    	{
    	benchmarkName += ' (Test Build)';
    	}
    
    console.log("submitJob() selectedBenchmarks[key].name: "+selectedBenchmarks[key].name);
    console.log("submitJob() selectedBenchmarks[key].variant: "+selectedBenchmarks[key].variant);

	var requestAPI = "/api/benchengine/submit?machine=" + $('#machine-selection').val();
	var jobData = parseJob(selectedBenchmarks[key], isBaseline);

	/* TODO: Need to add '#notification' to the html page since it's not there currently, hence 
	 * we don't get the result whether we were able to submit the job successfully or not. */
	$.ajax({
		type: "POST",
		url: requestAPI,
		data: jobData,
		contentType: "text/xml",
		dataType: "xml",
		cache: false,
	}).done(function(data, status) {
		storeJenkinsBuildURL(benchmarkName, data.responseText, status, true);
	})
	.fail(function(data, status) {
		storeJenkinsBuildURL(benchmarkName, data.responseText, status, false);
	});
}

function storeJenkinsBuildURL(benchmarkName, data, status, pass) {
	
	console.log("util.js Entering storeJenkinsBuildURL()");	
	console.log("util.js storeJenkinsBuildURL() benchmarkName: "+benchmarkName);
	jenkinsBuilds[benchmarkName] = data;

	console.log("storeJenkinsBuildURL() Jenkis Job Submission: SUCCESSFUL data: "+data+" status: "+status+" pass:"+pass);
}

function displayJenkinsBuildURL() {
	console.log("util.js Entering displayJenkinsBuildURL()");
	
	var buildKeys = []; var key;
	
	$('#submit-console-output').html('');
	
	/* We want to output the baseline and test build URLs for the same benchmark adjacent to each 
	 * other, if multiple benchmarks are being launched. Since JSON Objects are unordered, we may
	 * not get output as desired. Hence, we need to put the JSON keys in an array, sort the
	 * array and then iterate through the array to output the build URLs in the JSON object */
	for (var buildKey in jenkinsBuilds)
	{
		if (jenkinsBuilds.hasOwnProperty(buildKey)) {
			buildKeys.push(buildKey);
		}
	}
	buildKeys.sort();
	var numKeys = buildKeys.length;
	
	for (i = 0; i < numKeys; i++) 
	{
		key = buildKeys[i];
		$('#submitJobModalBody').append('<h4 class="jenkins-build-url"><span>'+key+': '+'</span><br /><a href="'+jenkinsBuilds[key]+'" target="_blank">'+jenkinsBuilds[key]+'</a></h4>');
	}
	
}

function submitJob() {

	console.log("util.js Entering submitJob()");
	
	//Remove Jenkins Build URLs of previously launched benchmarks  
	jenkinsBuilds = {};
	
	//Remove all previously generated elements that contain Jenkins Build URLs
	$('.jenkins-build-url').remove();
	
	/* When all previous AJAX jobs are done, then we start tracking all the new AJAX jobs for submitJob event */
	$(document).ajaxStart(function () {
		console.log('submitJob(): Inside ajaxStart');			
	});
	
	$('#submit-console-output').html('Submitting Jobs to Jenkins. Please wait for Jenkin Build URLs to be generated...');
	
	for (var key in selectedBenchmarks)
	{
		if (selectedBenchmarks.hasOwnProperty(key)) {

			if (document.getElementById('RunBaseline').checked)
				{
				console.log('util.js: RunBaseline is checked');
				submitJobHelper(key, false);
				submitJobHelper(key, true);
				}
			else
				{
				console.log('util.js: RunBaseline is NOT checked');
				submitJobHelper(key, false);
				}
		}
	}
	/* Bug Fix: Same Jenkins build URLs get displayed twice
	 * Steps to reproduce: 
	 * 1) Submit one job. Modal shows the Jenkins build URL
	 * 2) Close the modal.
	 * 3) Click Submit Job again without refreshing the page or making any other changes
	 * 4) We enter ajaxStop twice instead of once for some reason. Entering it the second 
	 * time prints the same Jenkins build URLs again 
	 * Fix:
	 * Use "$(document).one("ajaxStop", function() {" instead "$(document).ajaxStop(function () {" 
	 * This ensures that displayJenkinsBuildURL() is executed at most once per element per event type.*/
	
	/* Display the Jenkins Build URLs when all the AJAX jobs 
	 * (i.e. requests for submitting jobs to Jenkins) for the submitJob event are done */
	
	$(document).one("ajaxStop", function() {
		console.log('submitJob(): Inside ajaxStop');
		displayJenkinsBuildURL();			
	});
	
}

function generateScript() {
    console.log("Generating Script")
    var requestAPI = "/api/benchengine/generatescript";
    var jobData = parseJob(selectedBenchmark, false);
    //console.log("util.js: The job data to generate the script is: \n " + jobData)

    $('#console-output').html('Loading...');

    $.ajax({
            type: "POST",
            url: requestAPI,
            data: jobData,
            contentType: "text/xml",
            dataType: "xml",
            cache: false,
        }).done(function(data, status) {
            $('#console-output').html('');
            $('#console-output').html(data.responseText);
        })
        .fail(function(data, status) {
            $('#console-output').html('');
            $('#console-output').html(data.responseText);
        });
}

function downloadJob() {
    var dataStr = "data:text/xml;charset=utf-8," + encodeURIComponent(parseJob(selectedBenchmark, false));
    var dlAnchorElem = document.getElementById('downloadAnchorElem');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "job.xml");
    dlAnchorElem.click();

    $('#notification').html('<div class="alert alert-success alert-dismissable"><button type="button" class="close" data-dismiss="alert" aria-hidden="true">×</button>Job Successfully Downloaded (working on getting it formatted).</div>');
}

// Event listeners to update data model when user edits benchmark table
$('#arguments-table').on('input', '.argument-input', function() {
    var id = this.getAttribute('id');
    var script = this.getAttribute('script');
    selectedBenchmark.data.scripts[script].args[id].value = this.value;
});

$('#arguments-table').on('input', '.env-input', function() {
    var id = this.getAttribute('id');
    selectedBenchmark.data.ENV[id].value = this.value;
});

$('#arguments-table').on('input', '.hw-env-input', function() {
    var id = this.getAttribute('id');
    selectedBenchmark.data.HW_ENV[id].value = this.value;
});

$('#arguments-table').on('input', '.script-input', function() {
    var id = this.getAttribute('id');
    selectedBenchmark.data.scripts[id].value = this.value;
});

//Change style of the benchmark input field when user clicks it
$('#arguments-table').on('focus', '.iteration-input, .argument-input, .env-input, .hw-env-input, .script-input', function() {
    var style = this.getAttribute('style');
    this.setAttribute('style', style.replace('border:none', ''));
});

$('#arguments-table').on('focusout', '.iteration-input, .argument-input, .env-input, .hw-env-input, .script-input', function() {
    var style = this.getAttribute('style');
    this.setAttribute('style', style + ' border:none');
});