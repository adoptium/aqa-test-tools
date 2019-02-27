var allBenchmarkInfo = null;
var allmachinesInfo = null; //XML doc with all machine specific info (i.e. master_machine_list.xml)
var machineList = null; //JSON Object (i.e. machines.json)
var bucketsArray = [];

var appData = null;

/* Stores the Key-Value pair for all the selected benchmarks with their env var info
 * Key: 'benchmark-arguments-NAME-VARIANT' 
 * Value: {scripts: {…}, ENV: {…}, HW_ENV: {…}} */
var benchmarkArgData = {};	//Data of all selected benchmarks

/* Simple Object to store info about the currently selected benchmark 
 * {name: "ILOG_WODM", variant: "881-4way-Seg5FastpathRVEJB", data: {…}, 
 * iterations: "iteration-input-benchmark-arguments-ILOG_WODM-881-4way-Seg5FastpathRVEJB"} */
var selectedBenchmark = {}; //Data of the currently selected benchmark

/* Stores the Key-Value pair for all the selected benchmarks with their complete info
 * Key: 'benchmark-arguments-NAME-VARIANT' 
 * Value: {name: "ILOG_WODM", variant: "881-4way-Seg5FastpathRVEJB", data: {…}, 
 * iterations: "iteration-input-benchmark-arguments-ILOG_WODM-881-4way-Seg5FastpathRVEJB" 
 * Object with benchmarkArgData and some extra info (name, variant & iterations) */
var selectedBenchmarks = {}; 

var jenkinsBuilds = {};

var bucketsTableSelector = '#buckets-table';
var benchmarkTableSelector = '#benchmark-table';
var metricTableSelector = '#metric-table';
var OS, OS2;

var isMainLauncher = true;

$(function() {    
    $.get("/api/machinesInfo", function(data, status) {
    	console.log('benchmarks.js: Got all machine info from /api/machinesInfo');
    	allmachinesInfo = data;
    	populateMachines(isMainLauncher);
    	console.log('benchmarks.js: allmachinesInfo: '+allmachinesInfo);
    });
    
    $.get("/api/espressoBuilds?product=pxa6480sr6", function(data, status) {
    	console.log('benchmarks.js: Calling populateEspressoBuilds()');
    	populateEspressoBuilds(data, isMainLauncher, false);
        populateEspressoBuilds(data, isMainLauncher, true);
    });
    	
    $.get("/api/getBuckets", function(data, status) {

        populateSelections(data); //Populate the selection UI with retrieved data
        
        $.get("/api/getBenchmarks?isSimple=true", function(data, status) {
            allBenchmarkInfo = data;
            console.log('benchmarks.js: allBenchmarkInfo: '+allBenchmarkInfo);
            $("#selected-benchmarks").on('mouseover', '.selected-benchmarks-entry', showMetricArguments); //When the user hovers over selected benchmark (Build Options tab)
        });
    });
    
    $.get("/api/getAppData", function(data, status) {
    	console.log('benchmarks.js: Got getAppData from /api/getAppData');
    	appData = data;
    	console.log('benchmarks.js: appData.builds_server_url: '+appData.builds_server_url);
    });
    
});

function selectMetric() {
	
	console.log('benchmarks.js: Entering selectMetric()');
    var id = $(this).attr('id');
    var name = $(this).attr('name');
    var variant = $(this).attr('variant');

    var idToFind = 'selected-benchmarks-' + id;
    if (this.checked)
    {
    	$('#selected-benchmarks tbody').append('<tr class="selected-benchmarks-entry" name="' + name + '" variant="' + variant + '" id="selected-benchmarks-' + id + '"><td>' + id + '</td></tr>');
    	populateSelectedBmArguments(name, variant);
    }
    else
    {
    	$("[id='" + idToFind + "']").remove(); //attribute selector is used, id has special chars
    	
    	var key = 'benchmark-arguments-' + name + '-' + variant; //Key of the selected benchmarks object
    	console.log("benchmarks.js: selectMetric() Deleting benchmark:"+key+" from selected benchmarks");
    	delete selectedBenchmarks[key];
    }
}

function showMetricArguments(){
	
	console.log('benchmarks.js: Entering showMetricArguments()');
    var name = this.getAttribute('name');
    var variant = this.getAttribute('variant');
    console.log(`Selected: ${name} - ${variant}`)
    
    populateSelectedBmArguments(name, variant);

}

//---------------------------------------------------
$('.OS-Type-Bit').click(function() {
    var bit = this.innerHTML;
    var arch = $($($(this).parent()[0]).parent()[0]).siblings()[0];
    var OS = $($($(arch).parent()[0]).parent()[0]).siblings()[0];
    
    $('#dtextlabel')[0].innerHTML = `${OS.innerHTML} ${arch.innerHTML} ${bit}`;
    
    console.log('benchmarks.js: OS updated');
    populateMachines(isMainLauncher);
    updateProduct(false);
    updateProduct(true);
    changeHWSpecificArguments();
});

function changeVMReleaseForm(isBaseline)
{
	console.log('util.js: Entering changeVMReleaseForm()');
	
    var releaseHost = getReleaseHost(isBaseline);
    
    var espressoForm, aojForm;
	
    if (isBaseline)
    {
    	espressoForm = $('#Baseline-EspressoForm');
    	aojForm = $('#Baseline-AdoptOpenJDKForm');
    }
    else
    {
    	espressoForm = $('#EspressoForm');
    	aojForm = $('#AdoptOpenJDKForm');
    }	
    
    if (releaseHost == 'AdoptOpenJDK')
    	{
    	espressoForm.addClass('hidden');
    	aojForm.removeClass('hidden');
    	}
    else
    	{
    	espressoForm.removeClass('hidden');
    	aojForm.addClass('hidden');
    	}
    
    updateProduct(isBaseline);
}

$('#ReleaseHost').change(function() {
    
	console.log('Release Host updated');
	changeVMReleaseForm(false);
});

$('#Baseline-ReleaseHost').change(function() {
	
	console.log('Baseline Release Host updated');
	changeVMReleaseForm(true);
});

$('#AOJ-Variant').change(function() {

    console.log('AOJ Variant updated');
    updateProduct(false);
});

$('#Baseline-AOJ-Variant').change(function() {

    console.log('Baseline AOJ Variant updated');
    updateProduct(true);
});

$('#AOJ-BuildType').change(function() {

    console.log('AOJ Build Type updated');
    updateProduct(false);
});

$('#Baseline-AOJ-BuildType').change(function() {

    console.log('Baseline AOJ Build Type updated');
    updateProduct(true);
});

$('#AOJ-Build').change(function() {

    console.log('AOJ Build updated');
    updateProduct(false);
});

$('#Baseline-AOJ-Build').change(function() {

    console.log('Baseline AOJ Build updated');
    updateProduct(true);
});

$('#Runtime-version').change(function() {

    console.log('benchmarks.js: Java stream updated');
    updateProduct(false);
});

$('#Runtime-sub-version-1').change(function() {

    console.log('benchmarks.js: SR updated');
    updateProduct(false);
});

$('#Runtime-sub-version-2').change(function() {

    console.log('benchmarks.js: FP updated');
    updateProduct(false);
});

$('#Runtime-sub-version-3').change(function() {

    console.log('benchmarks.js: IFX updated');
    updateProduct(false);
});

$('#Baseline-Runtime-version').change(function() {

    console.log('benchmarks.js: Baseline Java stream updated');
    updateProduct(true);
});

$('#Baseline-Runtime-sub-version-1').change(function() {

    console.log('benchmarks.js: Baseline SR updated');
    updateProduct(true);
});

$('#Baseline-Runtime-sub-version-2').change(function() {

    console.log('benchmarks.js: Baseline FP updated');
    updateProduct(true);
});

$('#Baseline-Runtime-sub-version-3').change(function() {

    console.log('benchmarks.js: Baseline IFX updated');
    updateProduct(true);
});

function changeHWSpecificArguments() {

	console.log('benchmarks.js: Entering changeHWSpecificArguments()');
	for (var key in selectedBenchmarks)
	{
		if (selectedBenchmarks.hasOwnProperty(key)) {

			populateHWSpecificArguments(selectedBenchmarks[key].name, selectedBenchmarks[key].variant);
		}
	}
	
	populateHWSpecificArguments(selectedBenchmark.name, selectedBenchmark.variant);
    
}
$('#machine-cpu-affinity').change(function() {

    console.log('benchmarks.js: Machine CPU Affinity updated');
    changeHWSpecificArguments();
    
});

$('#runSMT').change(function() {

    console.log('benchmarks.js: Run SMT checkbox updated');
    changeHWSpecificArguments();
    
});

$('#machine-selection').change(function() {

    console.log('benchmarks.js: Machine updated');
    changeHWSpecificArguments();
    
});

// TEMP - tooltip demo
$('.tooltip-demo').tooltip({
    selector: "[data-toggle=tooltip]",
    container: "body"
})

$('[data-toggle=popover]').popover({
    container: 'body'
})

function styleBucketRowSelection(selected) {
    $(bucketsTableSelector + ' tbody tr').css("background-color", "white");
    $(selected).css("background-color", "rgb(245, 245, 245)");
}

function styleBenchmarkRowSelection(selected) {
    $('.benchmark-selection').css("background-color", "white");
    $(selected).css("background-color", "rgb(245, 245, 245)");
}

function populateSelections(data){
    var buckets = data.getElementsByTagName('bucket');
    var bucket = {};

    for (var i = 0; i < buckets.length; i++) {
        bucket = {};
        bucket.name = buckets[i].getAttribute('name');
        bucket.description = buckets[i].getAttribute('description');

        var benchmarks = buckets[i].getElementsByTagName('benchmark');
        bucket.benchmarks = [];
        var benchmark = {};
        
        for (var j = 0; j < benchmarks.length; j++) {
            benchmark = {};
            benchmark.id = benchmarks[j].getAttribute('name');
            benchmark.name = benchmarks[j].getAttribute('name');
        
            var metrics = benchmarks[j].getElementsByTagName('metric');

            benchmark.metrics = [];
            var metric = {};
            
            for (var k = 0; k < metrics.length; k++) {
                metric = {};
                metric.metric = metrics[k].getAttribute('metric');
                metric.name = metrics[k].getAttribute('name');
                metric.variant = metrics[k].getAttribute('variant');
                metric.id = metrics[k].getAttribute('name') + '-' + metrics[k].getAttribute('variant');
                
                benchmark.metrics[metric.metric] = metric; 
            }
            benchmark.suite = bucket.name;
            bucket.benchmarks[benchmark.name] = benchmark;
        }
        bucketsArray[bucket.name] = bucket;
    }

    createBucketTableBody();

    $(bucketsTableSelector + ' tbody tr').mouseover(showBenchmarks); //When the user hovers over Benchmark suite (Benchmarks tab)
    $(metricTableSelector).on('click', '.metric-selection', selectMetric);
}

function createBucketTableBody() {
    var bucketTableBody = '';

    for (var bucket in bucketsArray)
        bucketTableBody += '<tr id="' + bucket + '"><td><input type="checkbox" value="">&nbsp;&nbsp;&nbsp;' + bucket + '</td></tr>';

    $(bucketsTableSelector + ' tbody').append(bucketTableBody);
}

//When the user hovers over Benchmark suite row, populate the 2nd col with benchmarks
function showBenchmarks() {

    var id = $(this).attr('id');
    var bucket = bucketsArray[id];

    styleBucketRowSelection(this);

    var idToFind = 'benchmark-table-' + id;
  
    $('.benchmark-table').hide();
    $('.metric-table').hide();
  
    if ($("[id='" + idToFind + "']").length == 0) { //attribute selector is used, id has special chars        
        var benchmarkTableBody = '<tbody id="benchmark-table-' + id + '" class="benchmark-table">';
        
        for (var benchmark in bucket.benchmarks) {
            benchmarkTableBody += '<tr class="benchmark-selection" name="' + bucket.benchmarks[benchmark].name + '" suite="' + bucket.benchmarks[benchmark].suite + '" id="' + benchmark + '"><td><input type="checkbox" value="">&nbsp;&nbsp;&nbsp;' + bucket.benchmarks[benchmark].name + '</td></tr>';
        }

        benchmarkTableBody += '</tbody>';

        $('#benchmark-table').append(benchmarkTableBody);
        
    } else {      
        $("[id='" + idToFind + "']").show(); //attribute selector is used, id has special chars
    }
    
    $('.benchmark-selection').mouseover(showMetrics); //When user hovers over benchmark (Benchmarks Tab)
}


//When user hovers over benchmark, populate the 3rd col with metrics
function showMetrics() {

    var id = $(this).attr('name');  
    var suite = $(this).attr('suite');
    var benchmark = bucketsArray[suite].benchmarks[id];

    styleBenchmarkRowSelection(this);

    var idToFind = 'metric-table-' + id;
  
    $('.metric-table').hide();
  
    if ($("[id='" + idToFind + "']").length == 0) { //attribute selector is used, id has special chars        
        var metricTableBody = '<tbody id="metric-table-' + id + '" class="metric-table">';

        for (var metric in benchmark.metrics) {
            metricTableBody += '<tr><td><input class="metric-selection" name="' + benchmark.metrics[metric].name + '" variant="' + benchmark.metrics[metric].variant + '" id="' + benchmark.metrics[metric].id + '" type="checkbox" value="">&nbsp;&nbsp;&nbsp;' + benchmark.metrics[metric].metric + '</td></tr>';
        }

        metricTableBody += '</tbody>';

        $('#metric-table').append(metricTableBody);
        
    } else {            
        $("[id='" + idToFind + "']").show(); //attribute selector is used, id has special chars
    }   
}
