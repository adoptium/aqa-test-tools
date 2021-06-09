import React, { Component } from 'react';
import { QuestionCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Tooltip, Collapse, Checkbox, TreeSelect } from 'antd';
import ReactTable from 'react-table'
import './TabularView.css';
import 'react-table/react-table.css'
import PropTypes from 'prop-types';
import DayPickerInput from 'react-day-picker/DayPickerInput';
import { getParams } from '../utils/query';
import 'react-day-picker/lib/style.css';
import tabularViewConfig from './TabularViewConfig';
import { getInfoFromBuildName, fetchData } from '../utils/Utils';
// Pull property panel from Collapse, so you do not have to write Collapse.Panel each time
const { Panel } = Collapse;
// Pull property SHOW_PARENT from TreeSelect, so you do not have to write TreeSelect.SHOW_PARENT each time
const { SHOW_PARENT } = TreeSelect;

// Setting color filter ranges, higher value is inclusive, lower value is exclusive
const greenFilter = [98, Number.MAX_SAFE_INTEGER];
const yellowFilter = [90, 98];
const redFilter = [0, 90];

const colStyle={fontSize:18, fontFamily: 'arial'};

const legendColumns = [{
    Header: 'Color',
    accessor: 'colorName'
    },
    {Header: 'Score Range',
    accessor: 'score'
    },
    {Header: 'Performance Analysis',
    accessor: 'analysis'
    },
];

const legendRows = [{
    colorName: 'Green',
    color: '#2dc937',
    score: ">98%",
    analysis: "No Regression"
    }, {
    colorName: 'Yellow',
    color: '#F0F755',
    score: "91-98%",
    analysis: "Possible Regression"
    }, {
    colorName: 'Red',
    color: '#cc3232',
    score: "<90%",
    analysis: "Regression"
    },
   {colorName: 'Grey',
    color: 'grey',
    score: "N/A",
    analysis: "No Data"
   	},
   {colorName: 'Off-White',
    color: '#ffdbac',
    score: "0 %",
    analysis: "Only test/baseline data available"
   	}];

// Overlay for the date picker component
function CustomOverlay({ classNames, selectedDay, children, ...props }) {
    return (
        <div
        className={classNames.overlayWrapper}
        style={{ marginLeft: -100 }}
        {...props}
    >
        <div className={classNames.overlay}>
        <p>
            {selectedDay
            ? `Currently Chosen JDK Date: ${selectedDay.toLocaleDateString()}`
            : 'Choose JDK Date'}
        </p>
        {children}
        </div>
    </div>
);}

CustomOverlay.propTypes = {
    classNames: PropTypes.object.isRequired,
    selectedDay: PropTypes.instanceOf(Date),
    children: PropTypes.node.isRequired,
};

export default class TabularView extends Component {
    constructor(props) {
    super(props);
    this.handleDayChange = this.handleDayChange.bind(this);
    this.state = {testData: [], columns : [], originalColumns: [], platforms: [], baselineData: [], consolidatedData: [], platformFilter: [], colorFilter: "all", benchmarkFilter: [], tabularDropdown: [],
    defaultValues: tabularViewConfig};
    this.metricsProps = {};
    }
 
    async componentDidMount() {
        const URLdata = getParams(window.location.search);
        for (let key in URLdata) {
            this.setState({[key]: URLdata[key]});
        }
        await this.updateDropdown();
        await this.initializeJdk();

        await this.showData('test');
        await this.showData('baseline');
        await this.populateCompTable();
     }
    // Get all dropdown values from database
    async updateDropdown () {
        await fetchData("/api/getTabularDropdown").then((data) => {
                this.setState({
                    tabularDropdown: data
            });
        });
    }
    // Populate dropdown menus with values from state, set value if supplied in url or set to default value
    generateDropdown (dropdownName, dropdownValues, defaultValue) {
        let select = document.getElementById(dropdownName);
        let revertToDefault = false;

        for (const item in dropdownValues){
            var opt = document.createElement('option');
            opt.value = dropdownValues[item];
            opt.innerHTML = dropdownValues[item];
            select.appendChild(opt);
        }
       // Check if url value exists in state, if not go to default
        if (!(dropdownName in this.state)) {
            revertToDefault = true;
        } else {
            // Check if url value exists in the dropdown options, if not go to default
            if (dropdownValues.indexOf(this.state[dropdownName]) > -1) {
                return;
            }
            else { revertToDefault = true;
            }
       }
        // Check if default exists in these dropdown options, if not use 1st index in dropdown options
        if (revertToDefault) {
            if (dropdownValues.indexOf(defaultValue) > -1) {
                this.setState({[dropdownName]: defaultValue});
            }
            else {
                this.setState({[dropdownName]: dropdownValues[0]});
            }
        }
    }
    // Set default values for choosing the JDK including date, version, type and sdk resource if URL has missing information
    async initializeJdk () {
        const date = (new Date().getDate()).toString();
        const month = (new Date().getMonth() + 1).toString(); //Current Month
        const year = (new Date().getFullYear()).toString(); //Current Year
        // Assumption: JDK date is in the format of YYYYMMDD in database, example: 20190814
        const jdkDate = year + '-' + ((month.length < 2) ? "0" + month : month) + '-' + ((date.length < 2) ? "0" + date : date)
        
        /*
        Each database entry should contain a pipeline name (buildName) which contains the JDK Version and JVM Type.
        sdkResource in the form of null, releases, nightly, customized or upstream
        date is in the jdkDate field and in the form of YYYYMMDD
        Default values are defined in TabularViewConfig.json. Add the optional Jenkins server otherwise will default to first option
        */
        this.generateDropdown('testJdkVersion', this.state.tabularDropdown['jdkVersion'], this.state.defaultValues.jdkVersion);
        this.generateDropdown('testJvmType', this.state.tabularDropdown['jvmType'], this.state.defaultValues.jvmType);
        this.generateDropdown('testSdkResource', this.state.tabularDropdown['sdkResource'], this.state.defaultValues.testSdkResource);
        this.generateDropdown('testBuildServer', this.state.tabularDropdown['buildServer'], this.state.defaultValues.jenkinsServer);
        this.generateDropdown('baselineJdkVersion', this.state.tabularDropdown['jdkVersion'], this.state.defaultValues.jdkVersion);
        this.generateDropdown('baselineJvmType', this.state.tabularDropdown['jvmType'], this.state.defaultValues.jvmType);
        this.generateDropdown('baselineSdkResource', this.state.tabularDropdown['sdkResource'], this.state.defaultValues.baselineSdkResource);
        this.generateDropdown('baselineBuildServer', this.state.tabularDropdown['buildServer'], this.state.defaultValues.jenkinsServer);

        !('testJdkDate' in this.state) && (this.setState({testJdkDate: jdkDate}));
        !('baselineJdkDate' in this.state) && (this.setState({baselineJdkDate: jdkDate}));
    }
    // Handle simple event changes for JDK version, type and sdk resource
    handleChange(event) {
        this.setState({
            [event.target.name]: event.target.value
        });
    }
    // Set the color state and call the filter
    handleColorFilter (event) {
        this.setState({
            colorFilter: event.target.value
        }, () => {
        	// Color changed, signal to call benchmark filter first
            this.colorFilter(true);
        });
    }
 
    handleDayChange(selectedDay, modifiers, dayPickerInput) {

        const input = dayPickerInput.getInput();
        this.setState({
            selectedDay,
            isEmpty: !input.value.trim(),
            isDisabled: modifiers.disabled === true,
        }, function () {
            if (this.state.selectedDay !== undefined) {
                // Transform date to correct format
                this.dateTransform(this.state.selectedDay.toLocaleDateString(), dayPickerInput.props.dayPickerProps.type);}
        });
    }

    setTreeData() {
        // Set the tree select values for benchmark filter, more information found in https://ant.design/components/tree-select/
        let newArray = [];
        this.state.consolidatedData.forEach(function (consolidatedDataObject) {
            let benchmark = consolidatedDataObject.benchmarkNVM.split(",")[0];
            let variant = consolidatedDataObject.benchmarkNVM.split(",")[1];
            let metric = consolidatedDataObject.benchmarkNVM.split(",")[2];

            let benchmarkLevel = {};
            let variantLevel = {};
            /*
            Giving unique values in order to avoid showing metrics for all benchmark variants and metrics. Titles can be same such as Startup time in ms, but their values will be different.
            By setting specific values for each title, we limit the display to one variant, requiring user to manually select different variants in case one wants to 
            look up the metric for multiple variants. For example, footprint metric exists in multiple Liberty variants such as DT7, DT3 and AcmeAir.
            */
            let metricLevel = {title: metric, value: consolidatedDataObject.benchmarkNVM};

            let benchmarkIndex = newArray.map(function(x) {return x.title; }).indexOf(benchmark);

            // Benchmark Exists
            if (benchmarkIndex !== -1) {
                let benchmarkParent = newArray[benchmarkIndex];
                let variantIndex = benchmarkParent.children.map(function(x) {return x.title; }).indexOf(variant);

                // Variant Exists
                if (variantIndex !== -1) {
                    let variantParent = benchmarkParent.children[variantIndex];
                    variantParent.children.push(metricLevel);
                    benchmarkParent.children[variantIndex] = variantParent;
                    newArray[benchmarkIndex] = benchmarkParent;
                }

                // Variant does not exist
                else {
                    variantLevel.title = variant;
                    variantLevel.value = benchmark + ',' + variant;
                    variantLevel.children = [metricLevel];
                    benchmarkParent.children.push(variantLevel);
                    newArray[benchmarkIndex] = benchmarkParent;
                }
            }

            else {
                benchmarkLevel.title = benchmark;
                benchmarkLevel.value = benchmark;
                variantLevel.title = variant;
                variantLevel.value = benchmark + ',' +variant;

                variantLevel.children = [metricLevel];
                benchmarkLevel.children = [variantLevel];
                newArray.push(benchmarkLevel);		
            }
        });

        this.setState({treeData: newArray});
    }
    // When Submit button clicked, update table and URL
    async handleSubmit(event) {
        await this.showData('test');
        await this.showData('baseline');
        await this.populateCompTable();
        event.preventDefault();
        
        // Update URL with current state
        const newPath = '/tabularView?testJdkDate=' + this.state.testJdkDate + '&testJvmType=' + this.state.testJvmType + '&testJdkVersion=' + this.state.testJdkVersion
        + '&testSdkResource=' + this.state.testSdkResource + '&testBuildServer=' + this.state.testBuildServer
        + '&baselineJdkDate=' + this.state.baselineJdkDate + '&baselineJvmType=' + this.state.baselineJvmType + '&baselineJdkVersion=' + this.state.baselineJdkVersion
        + '&baselineSdkResource=' + this.state.baselineSdkResource + '&baselineBuildServer=' + this.state.baselineBuildServer;

        window.history.replaceState(null, '', newPath);
    }
    // Helper function to get value from benchmark entry
    handleProp (val, field) {
        if (val == null) {
            return "N/A";
        }
        else if (field === 'buildUrl') {
            let urls = {};
            if ((val['testBuildUrl']) && (val['baselineBuildUrl'])) {
                urls.testBuildUrl = val['testBuildUrl'];
                urls.baselineBuildUrl = val['baselineBuildUrl'];
            }
            else if (val['testBuildUrl']) {
                urls.testBuildUrl = val['testBuildUrl'];
            } else if (val['baselineBuildUrl']) {
                urls.baselineBuildUrl = val['baselineBuildUrl'];
            }
            return urls;	
        }
        else {return val[field];}
    }

    handleLink (urls) {
    // Calling PerfCompare with Links
    let url = "perfCompare?";
    if(urls.hasOwnProperty('testBuildUrl') && urls.hasOwnProperty('baselineBuildUrl')) {
        url+= 'testID=' + urls.testBuildUrl + '&baselineID=' + urls.baselineBuildUrl;
    } else if (urls.hasOwnProperty('testBuildUrl')) {
        url+= 'testID=' + urls.testBuildUrl;
    } else if (urls.hasOwnProperty('baselineBuildUrl')) {
        url+= 'baselineID=' + urls.baselineBuildUrl;
    } else {return;}

    const win = window.open(url, '_blank');
    win.focus();
    }
    // Update table columns when platforms are ticked or unticked
    onPlatformChange (checkedValues, event) {
        let newArray = this.state.originalColumns;

        newArray = newArray.filter(column => column.Header === "Benchmark Name" || checkedValues.includes(column.id));
        this.setState({columns: newArray});
    }
    // Update table contents based on which benchmarks are ticked in the benchmark filter
    onBenchmarkChange = value => {
        this.setState({benchmarkFilter: value});
        this.benchmarkFilter(value);
    }
    // Date picker format needs to be converted to match the one available in the database entry
    dateTransform(date, type) {
        const dateSplit = date.split('/');
        // Database date format: YYYYMMDD
        const jdkDate = dateSplit[2] + '-' + ((dateSplit[0].length < 2) ? "0" + dateSplit[0] : dateSplit[0]) + '-' + ((dateSplit[1].length < 2) ? "0" + dateSplit[1] : dateSplit[1]);

        if (type === 'test') {
            this.setState({testJdkDate: jdkDate});
        } else {
            this.setState({baselineJdkDate: jdkDate});
        }
    }
    // Based on data returned from database, create relevant columns for platforms
    generateColumns(platforms) {
        const newArray = [];
        let column = {
        Header: 'Benchmark Name',
        accessor: 'benchmarkNVM',
        // The three line breaks ensure the benchmark name, variant and metric appear in separate lines
        Cell: props => <span>{props.value.split(",")[0]} <br/> {props.value.split(",")[1]} <br/> {props.value.split(",")[2]}</span>
        };

        newArray.push(column);

        for (let i = 0; i < platforms.length; i++) {
            let platform = platforms[i];
    	
            column = {};
            column.id = platform;
            column.Header = platform.toUpperCase();
            column.accessor = d => d.platformsSpecificData[platform];
            // Each cell needs to display the comparison by default, on hover displays further details
            column.Cell = props => <Tooltip title={<div >
                Test Raw Score: {this.handleProp(props.value, 'testScore')} <br/> 
                Test CI: {this.handleProp(props.value, 'testCI')}  <br/>
                Test JDK Date: {this.handleProp(props.value, 'testJdkDate')}	<br/> 
                Test Sdk Resource: {this.handleProp(props.value, 'testSdkResource')}	<br/> 
                Baseline Raw Score: {this.handleProp(props.value, 'baselineScore')} <br/> 
                Baseline CI: {this.handleProp(props.value, 'baselineCI')}  <br/>
                Baseline JDK Date: {this.handleProp(props.value, 'baselineJdkDate')} <br/>
                Baseline Sdk Resource: {this.handleProp(props.value, 'baselineSdkResource')}
                </div> }>
                <span onClick={() => this.handleLink(this.handleProp(props.value, 'buildUrl'))}> {this.handleProp(props.value, 'relativeComparison')} % <br/> {this.handleCI(this.handleProp(props.value, 'totalCI'), this.handleProp(props.value, 'relativeComparison'))} </span></Tooltip>;
            column.getProps = (state, rowInfo) => (this.handleRegression(this.handleProp(rowInfo.row[platform], 'relativeComparison')));
            newArray.push(column);
        }
        this.setState({columns:newArray, originalColumns: newArray});
    }
    // Set cell color based on comparison value
    handleRegression (val) {
        let color;
        if (val === 0) {
            color = '#ffdbac';}
        else if ((val <= redFilter[1]) && (val > redFilter[0])) {
            color = '#cc3232';}
        else if ((val <= yellowFilter[1]) && (val > yellowFilter[0])) {
            color =  '#F0F755';}
        else if (val === 'N/A') {
            color = 'grey';}
        else color =  '#2dc937';

        return {
            style: {
                fontSize: 25,
                backgroundColor: color
            }	
        }
    }
    // Show a warning if the confidence interval exceeds the regression. Closer look at data is necessary to confirm regression.
    handleCI(totalCI, relativeComparison) {
        if (relativeComparison === 100 || relativeComparison === 0 || relativeComparison === "N/A") {return;}
        else if (totalCI * 100 < (Math.abs(relativeComparison - 100) + 0.7)) {return;} 
        else {
            return <WarningOutlined />;
        }
    }
    // Two filters Benchmark and Color. Always call benchmark filter first. If color filter is the first filter, boolean ensures benchmark filter is called first instead
    colorFilter(firstFilter) {
    	// Always call benchmark filter first if true
        if (firstFilter) {
            this.benchmarkFilter(this.state.benchmarkFilter);}
        else {
        	// If set to this.state.consolidated data, ends up changing the original data due to how javascript stores objects inside arrays
            let newArray = JSON.parse(JSON.stringify(this.state.consolidatedData));
            let filterRange;
            // If color filter is set to ALL, do not not apply filter
            if (this.state.colorFilter === "green") {filterRange = greenFilter;}
            else if (this.state.colorFilter === "yellow") {filterRange = yellowFilter;}
            else if (this.state.colorFilter === "red") {filterRange = redFilter;}
            else {return;}

        for (let i=0; i < this.state.consolidatedData.length; i++) {
            for (let platform in this.state.consolidatedData[i].platformsSpecificData) {
            	// Set values to N/A if they are outside the filterRange
                if ((parseFloat(this.state.consolidatedData[i].platformsSpecificData[platform].relativeComparison) > filterRange[1]) || (parseFloat(this.state.consolidatedData[i].platformsSpecificData[platform].relativeComparison) <= filterRange[0])) {
                    newArray[i].platformsSpecificData[platform].relativeComparison = 'N/A';
                }
            }
        }

        this.setState({consolidatedData: newArray});
        }
    }

    benchmarkFilter(value) {
        let newArray = [];

        //Always call color filter after applying benchmark filter, if no filter selected return original data
        if (value.length === 0) {
            this.setState({
                consolidatedData: this.state.originalData
            }, () => {
            	// Indicate that colorFilter is being called second
                this.colorFilter(false);
            });
        } else {
            this.state.originalData.forEach(function (element) {
                let found = false;

                for (let i = 0; i < value.length; i++) {
                    if (element.benchmarkNVM.indexOf(value[i]) !== -1) {
                        found = true;
                    }
                }

                if (found) {newArray.push(element);}
            });

            this.setState({
                consolidatedData: newArray
            }, () => {
                this.colorFilter(false);
            });
        }
    }
    // Enter values in the proper fields before saving to the test/baseline array
    handleEntry(index, testResultObject, metric, type) {
        if (type === 'test') {
            return {testScore: testResultObject.aggregateInfo[index].metrics[metric].statValues.mean, 
                testJdkDate: testResultObject.jdkDate,
                testCI: testResultObject.aggregateInfo[index].metrics[metric].statValues.CI,
                testSdkResource: testResultObject.sdkResource,
                testBuildUrl: testResultObject.buildUrl,
                relativeComparison: testResultObject.aggregateInfo[index].metrics[metric].statValues.mean
            };
        } else {
            return {baselineScore: testResultObject.aggregateInfo[index].metrics[metric].statValues.mean, 
                baselineJdkDate: testResultObject.jdkDate,
                baselineCI: testResultObject.aggregateInfo[index].metrics[metric].statValues.CI,
                baselineSdkResource: testResultObject.sdkResource,
                baselineBuildUrl: testResultObject.buildUrl,
                relativeComparison: testResultObject.aggregateInfo[index].metrics[metric].statValues.mean
            };

        }
    }

    populateTable(data, type) {
    	/* Table object format, each entry in the array is an object with two fields benchmarkNVM (benchmark Name Variant Metric) and platformsSpecificData.
    	platformsSpecificData is an object with each field being a separate platform containing the jdk data such as score, date, CI */
        const newArray = [];
        let dataObject = {};
        let platform;
        let benchmarkNVM = "";
        let found = false;

        data.forEach(function (testResultsObject) {
            const buildInfo = getInfoFromBuildName(testResultsObject.buildName);
            if (buildInfo){
                platform = buildInfo.platform;
                for(let aggregateIndex = 0; aggregateIndex < testResultsObject.aggregateInfo.length; aggregateIndex++) {
                    for (const metric in testResultsObject.aggregateInfo[aggregateIndex].metrics) {
                        found = false;
                        benchmarkNVM = testResultsObject.aggregateInfo[aggregateIndex].benchmarkName + ',' + testResultsObject.aggregateInfo[aggregateIndex].benchmarkVariant + "," + testResultsObject.aggregateInfo[aggregateIndex].metrics[metric].name;
    
                        for (const currentDataObject in newArray) {
                            // If benchmark already exists append to it
                            if (newArray[currentDataObject].benchmarkNVM === benchmarkNVM) {
                                found = true;
                                newArray[currentDataObject].platformsSpecificData[platform] = this.handleEntry(aggregateIndex, testResultsObject, metric, type);
                                break;
                            }
                        }
                    // Create a new entry if benchmark name does not exist
                        if (!found) {
                            dataObject = {};
                            dataObject.platformsSpecificData = {};
                            dataObject.benchmarkNVM = benchmarkNVM;
                            dataObject.platformsSpecificData[platform] = this.handleEntry(aggregateIndex, testResultsObject, metric, type);
                            newArray.push(dataObject);	
                        }
                    }
                }
            }
        }.bind(this));
        if (type === 'test') {
            this.setState({testData:newArray});
        } else {
            this.setState({baselineData:newArray});	
        }
    }

    populateCompTable = async() => {
    	// Each entry is a combination of the data in testData and baselineData, same format two fields benchmarkName and platforms
    	// Now platform entries contain information from both the testJdk and the baselineJdk
        const newArray = [];
        for(let testDataObject of this.state.testData) {
            let consolidatedDataObject = {};
            let benchmark = testDataObject.benchmarkNVM.split(",")[0];
            let metric = testDataObject.benchmarkNVM.split(",")[2];
            consolidatedDataObject.platformsSpecificData = {};
            consolidatedDataObject.benchmarkNVM = testDataObject.benchmarkNVM;
            //To get the values of highterbetter/units  
            //first check if Metric does already exist in constructor , if not get its info from server
            let metricProps;
            if ( !this.metricsProps[benchmark] ) {
                const metricPropsJSON = await fetchData(`/api/getBenchmarkMetricProps?benchmarkName=${benchmark}`);
                if(metricPropsJSON){
                    this.metricsProps[benchmark] = metricPropsJSON;
                    metricProps = metricPropsJSON[metric];
                }
            } else {
                metricProps = this.metricsProps[benchmark][metric];
            }
            const higherBetter = !metricProps || metricProps.higherbetter !== false;
            let matchingDataObject = this.state.baselineData.find( s => s.benchmarkNVM === testDataObject.benchmarkNVM );
            // Baseline data contains information for the benchmark, comparison possible
            if (matchingDataObject != null) {
                Object.keys(testDataObject.platformsSpecificData).forEach(function(platform) {
            	    // Baseline data contains same benchmark and same platform, compare values and store in comparison table
                    if (matchingDataObject.platformsSpecificData.hasOwnProperty(platform)) {
                        consolidatedDataObject.platformsSpecificData[platform] = {...testDataObject.platformsSpecificData[platform], ...matchingDataObject.platformsSpecificData[platform]};	
                        if (higherBetter) {
                            consolidatedDataObject.platformsSpecificData[platform].relativeComparison = Number(testDataObject.platformsSpecificData[platform].testScore * 100 / matchingDataObject.platformsSpecificData[platform].baselineScore).toFixed(2);
                        } else {
                            consolidatedDataObject.platformsSpecificData[platform].relativeComparison = Number(matchingDataObject.platformsSpecificData[platform].baselineScore * 100 / testDataObject.platformsSpecificData[platform].testScore).toFixed(2);
                        }
                    consolidatedDataObject.platformsSpecificData[platform].totalCI = testDataObject.platformsSpecificData[platform].testCI + matchingDataObject.platformsSpecificData[platform].baselineCI;
                    // Only test data exists for this platform, set comparison table cell value to test data cell value
                    } else {
                        consolidatedDataObject.platformsSpecificData[platform] = testDataObject.platformsSpecificData[platform];
                        consolidatedDataObject.platformsSpecificData[platform].relativeComparison = 0;
                    }
                });
            // Baseline does not have the benchmark data, set to test data
            } else {
                consolidatedDataObject.platformsSpecificData = testDataObject.platformsSpecificData;
                Object.keys(consolidatedDataObject.platformsSpecificData).map(function(key, index) {
                    consolidatedDataObject.platformsSpecificData[key].relativeComparison = 0;
                });
            }
            newArray.push(consolidatedDataObject);
        };
        // Loop through baseline table and the newly created array to fill the gaps in comparison table
        this.state.baselineData.forEach(function (baselineDataObject) {

            let matchingDataObject = newArray.find( s => s.benchmarkNVM === baselineDataObject.benchmarkNVM );
            if (matchingDataObject != null) {
                Object.keys(baselineDataObject.platformsSpecificData).forEach(function(platform) {
                    if (!(matchingDataObject.platformsSpecificData.hasOwnProperty(platform))) {
                        matchingDataObject.platformsSpecificData[platform] = baselineDataObject.platformsSpecificData[platform];
                        matchingDataObject.platformsSpecificData[platform].relativeComparison = 0;
                    }
                });
            } else {
                let consolidatedDataObject = {};
                consolidatedDataObject.platformsSpecificData = baselineDataObject.platformsSpecificData;
                Object.keys(consolidatedDataObject.platformsSpecificData).map(function(key, index) {
                    consolidatedDataObject.platformsSpecificData[key].relativeComparison = 0;
                });
                consolidatedDataObject.benchmarkNVM = baselineDataObject.benchmarkNVM;
                newArray.push(consolidatedDataObject);
        }
    });
        // Set the comparison table, and a copy of the original for use with filtering
        this.setState({consolidatedData:[...newArray], originalData: [...newArray]});
        this.setTreeData();
        this.benchmarkFilter(this.state.benchmarkFilter);

    }
    // Main function to fetch data from backend and call the function to populate the displayed table
    showData = async (type) => {
        this.setState({platforms:[]});
        this.setState({columns:[], originalColumns: []});
        let info;
        if (type === 'test') {
            info = await fetchData( `/api/getTabularData?jdkVersion=${this.state.testJdkVersion}&jvmType=${this.state.testJvmType}&jdkDate=${this.state.testJdkDate}
            &sdkResource=${this.state.testSdkResource}&buildServer=${this.state.testBuildServer}`);
        } else {
            info = await fetchData( `/api/getTabularData?jdkVersion=${this.state.baselineJdkVersion}&jvmType=${this.state.baselineJvmType}&jdkDate=${this.state.baselineJdkDate}
            &sdkResource=${this.state.baselineSdkResource}&buildServer=${this.state.baselineBuildServer}`);
        }
        function getPlatform(platform) {
            const inforFromBuildName = getInfoFromBuildName(platform);
            return inforFromBuildName ? inforFromBuildName.platform : null;
        }
        const platformArray = [...new Set([...this.state.platforms,...(info.pop().map(getPlatform))])];
        this.setState({platforms:platformArray});
    
        const platformFilter = [];
        for (let platform in this.state.platforms) {
            platformFilter.push({label: this.state.platforms[platform], value: this.state.platforms[platform], disabled: false});
        }
        this.setState({platformFilter: platformFilter});
        this.populateTable(info, type);
        this.generateColumns(this.state.platforms);
    }

    render() {
        const tProps = {
            value: this.state.benchmarkFilter,
            onChange: this.onBenchmarkChange,
            treeCheckable: true,
            showCheckedStrategy: SHOW_PARENT,
            searchPlaceholder: "Please choose the benchmarks to view",
            style: {
                 width: 1000
            }
        };
        return (
            <div>
                <div className="row">
                    <div className="column" style={{fontSize:20, fontWeight:'bold'}}> Parameters <br/> </div>
                    <div className="column" style={{fontSize:20, fontWeight:'bold'}}> Test <br/> </div>
                    <div className="column" style={{fontSize:20, fontWeight:'bold'}}> Baseline <br/> </div>
            </div>
            <div className="row">
                    <div className="column" style={colStyle}> JDK Date <br/> </div>
                    <div className="column"> 
                        <DayPickerInput
                            onDayChange={this.handleDayChange}
                            value={this.state.testJdkDate}
                            overlayComponent={CustomOverlay}
                            dayPickerProps={{
                                todayButton: 'Today',
                                type: 'test'
                            }}
                            keepFocus={false}
                        /> 
            <Tooltip placement="topRight" title="Table will contain latest results from all builds dated before the chosen date regardless of when the benchmark was run.">
                <QuestionCircleOutlined />
            </Tooltip></div>
            <div className="column"> 
                <DayPickerInput
                    onDayChange={this.handleDayChange}
                    value={this.state.baselineJdkDate}
                    overlayComponent={CustomOverlay}
                    dayPickerProps={{
                        todayButton: 'Today',
                        type: 'baseline'
                    }}
                    keepFocus={false}
                /> 
            <Tooltip placement="topRight" title="Table will contain latest results from all builds dated before the chosen date regardless of when the benchmark was run.">
                <QuestionCircleOutlined />
            </Tooltip></div>
        </div>
        <div className="row">
            <div className="column" style={colStyle}> JDK Version <br/> </div>
            <div className="column"> <select id="testJdkVersion" name="testJdkVersion" className="select-css" value={this.state.testJdkVersion} onChange={this.handleChange.bind(this)}>
            </select></div>
            <div className="column"> <select id="baselineJdkVersion" name="baselineJdkVersion" className="select-css" value={this.state.baselineJdkVersion} onChange={this.handleChange.bind(this)}>
            </select></div>
        </div>
        <div className="row">
            <div className="column" style={colStyle}> JVM Type <br/> </div>
            <div className="column"> <select id="testJvmType" name="testJvmType" className="select-css" value={this.state.testJvmType} onChange={this.handleChange.bind(this)}>
            </select></div>
            <div className="column"> <select id="baselineJvmType" name="baselineJvmType" className="select-css" value={this.state.baselineJvmType} onChange={this.handleChange.bind(this)}>
            </select></div>
        </div>
        <div className="row">
            <div className="column" style={colStyle}> SDK Resource <br/> </div>
            <div className="column"> <select id="testSdkResource" name="testSdkResource" className="select-css" value={this.state.testSdkResource} onChange={this.handleChange.bind(this)}>
            </select></div>
            <div className="column"> <select id="baselineSdkResource" name="baselineSdkResource" className="select-css" value={this.state.baselineSdkResource} onChange={this.handleChange.bind(this)}>
            </select></div>
        <div className="row">
            <div className="column" style={colStyle}> Jenkins Server <br/> </div>
            <div className="column"> <select id="testBuildServer" name="testBuildServer" className="select-css" value={this.state.testBuildServer} onChange={this.handleChange.bind(this)}>
            </select></div>
            <div className="column"> <select id="baselineBuildServer" name="baselineBuildServer" className="select-css" value={this.state.baselineBuildServer} onChange={this.handleChange.bind(this)}>
            </select></div>
        </div>
        </div>

        <Button type="primary" onClick={this.handleSubmit.bind(this)}>
            Submit
        </Button>

        <Collapse>
            <Panel header='Filters' key="1"> <label> Choose Platforms: </label> <Checkbox.Group options={this.state.platformFilter} onChange={this.onPlatformChange.bind(this)} />
                <br/><TreeSelect treeData={this.state.treeData} {...tProps} /> <br/>
                <span> Please choose the color filter: </span><select name="colorFilter" value={this.state.colorFilter} onChange={this.handleColorFilter.bind(this)}>
                    <option value="all">All</option>
                    <option value="green">Green</option>
                    <option value="red">Red</option>
                    <option value="yellow">Yellow</option>
                  </select>
            </Panel>
    </Collapse> 
        <ReactTable
            data={this.state.consolidatedData}
            columns={this.state.columns}
            showPaginationBottom={false}
            showPageSizeOptions={false}
            minRows={0}
            pageSize={this.state.consolidatedData.length}
        />
        <br/>
        <ReactTable
            data={legendRows}
            columns={legendColumns}        
            showPagination={false}
            showPaginationTop={false}
            showPaginationBottom={false}
            showPageSizeOptions={false}
            minRows={0}
            getTrProps={(state, rowInfo, column) => {
                return {
                    style: {
                        background: rowInfo.row._original.color,
                    fontSize: 20
                    }
                };
            }}
        />
        </div>
        );
    }

}