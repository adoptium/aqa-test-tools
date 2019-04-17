var allBenchmarkInfo = null; //XML that stores all benchmark data

var selectedBenchmark = {}; //Data of the currently selected benchmark
var selectedBenchmarks = {};

//Data models of all loaded benchmarks... Key: 'benchmark-arguments-NAME-VARIANT'
//To get the currently selected: benchmarkArgData['benchmark-arguments-' +   selectedBenchmark.name  + '-' + selectedBenchmark.variant]
var benchmarkArgData = {};
var isMainLauncher = false;

$(function() {
    $.get("/api/machines", function(data, status) {
    	console.log('benchmarks-simple.js: Calling populateMachines()');
        populateMachines(data, isMainLauncher);
    });

    $.get("/api/getBuckets?isSimple=true", function(data, status) { //get benchmark suite data on page load
        populateSelections(data); //Populate the selection UI with retrieved data
        $.get("/api/getBenchmarks", function(data, status) {
            allBenchmarkInfo = data;
        });
    });
});

//This function creates benchmark suite selection menu (Multi-level drop down)
function populateSelections(data) {

    var buckets = data.getElementsByTagName('bucket');
    var suiteMenue = '';

    for (var i = 0; i < buckets.length; i++) { //For each suite

        var suite = buckets[i].getAttribute('name');

        var benchmarks = buckets[i].getElementsByTagName('benchmark');
        var suiteBenchmarks = '';

        for (var j = 0; j < benchmarks.length; j++) { //For each benchmark in the suite

            var name = benchmarks[j].getAttribute('name');
            var variant = benchmarks[j].getAttribute('variant');
            var fullName = name + '-' + variant;


            suiteBenchmarks += `<li><a href="#" class="benchmark-suite-selection" name="${name}" variant="${variant}">${fullName}</a></li>`;
        }
        suiteMenue += `<li class="dropdown-submenu"><a tabindex="-1" href="#" class="benchmark-suite">${suite}</a><ul class="dropdown-menu">${suiteBenchmarks}</ul></li>`;
    }

    $('#benchmark-selection').html(suiteMenue);
}

//User selected benchmark from drop down
$('#benchmark-selection').on('click', '.benchmark-suite-selection', function() {
    var name = this.getAttribute('name');
    var variant = this.getAttribute('variant');

    //Set the drop down label to the newly selected benchmark
    $('#dtextlabel').html(this.innerHTML);

    console.log(`Selected: ${name} - ${variant}`)

    /* Clear all the previously selected benchmarks from the selected benchmarks list since
     * simple launcher should launch only one benchmark.
    */
    selectedBenchmarks = {};

    populateSelectedBmArguments(name, variant);
});