import React, { useEffect, useState } from "react";
import { QuestionCircleOutlined, WarningOutlined } from "@ant-design/icons";
import { Button, Tooltip, Collapse, Checkbox, TreeSelect } from "antd";
import ReactTable from "react-table";
import "./TabularView.css";
import "react-table/react-table.css";
import PropTypes from "prop-types";
import DayPickerInput from "react-day-picker/DayPickerInput";
import { getParams } from "../utils/query";
import "react-day-picker/lib/style.css";
import tabularViewConfig from "./TabularViewConfig";
import { getInfoFromBuildName, fetchData } from "../utils/Utils";
// Pull property panel from Collapse, so you do not have to write Collapse.Panel each time
const { Panel } = Collapse;
// Pull property SHOW_PARENT from TreeSelect, so you do not have to write TreeSelect.SHOW_PARENT each time
const { SHOW_PARENT } = TreeSelect;
// Setting color filter ranges, higher value is inclusive, lower value is exclusive
const greenFilter = [98, Number.MAX_SAFE_INTEGER];
const yellowFilter = [90, 98];
const redFilter = [0, 90];
const colStyle = { fontSize: 18, fontFamily: "arial" };
const legendColumns = [
  {
    Header: "Color",
    accessor: "colorName",
  },
  { Header: "Score Range", accessor: "score" },
  { Header: "Performance Analysis", accessor: "analysis" },
];
const legendRows = [
  {
    colorName: "Green",
    color: "#2dc937",
    score: ">98%",
    analysis: "No Regression",
  },
  {
    colorName: "Yellow",
    color: "#F0F755",
    score: "91-98%",
    analysis: "Possible Regression",
  },
  {
    colorName: "Red",
    color: "#cc3232",
    score: "<90%",
    analysis: "Regression",
  },
  { colorName: "Grey", color: "grey", score: "N/A", analysis: "No Data" },
  {
    colorName: "Off-White",
    color: "#ffdbac",
    score: "0 %",
    analysis: "Only test/baseline data available",
  },
];
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
            : "Choose JDK Date"}
        </p>
        {children}
      </div>
    </div>
  );
}
CustomOverlay.propTypes = {
  classNames: PropTypes.object.isRequired,
  selectedDay: PropTypes.instanceOf(Date),
  children: PropTypes.node.isRequired,
};
const TabularView = () => {
  const constructor = {
    testData: [],
    columns: [],
    originalColumns: [],
    platforms: [],
    baselineData: [],
    consolidatedData: [],
    platformFilter: [],
    colorFilter: "all",
    benchmarkFilter: [],
    tabularDropdown: [],
    defaultValues: tabularViewConfig,
  };

  const [state, setState] = useState(constructor);
  const [metricsProps, setMetricsProps] = useState({});

  // Set platformFilter for Choose Platforms filter
  useEffect(() => {
    const newPlatformFilter = state.platforms.map((platform) => ({
      label: platform,
      value: platform,
      disabled: false,
    }));
    setState((prevState) => ({
      ...prevState,
      platformFilter: newPlatformFilter,
    }));
  }, [state.platforms]);

  useEffect(() => {
    const URLdata = getParams(window.location.search);
    for (let key in URLdata) {
      setState((prevState) => ({ ...prevState, [key]: URLdata[key] }));
    }

    // run updateDropdown and pass the returned data to initializeJdk
    updateDropdown()
      .then((data) => initializeJdk(data))
      .then(() => showData("test"))
      .then(() => showData("baseline"))
      .then(() => populateCompTable());
  }, []);

  const onBenchmarkChange = (value) => {
    setState((prevState) => ({ ...prevState, benchmarkFilter: value }));
    benchmarkFilter(value);
  };

  const populateCompTable = async () => {
    // Each entry is a combination of the data in testData and baselineData, same format two fields benchmarkName and platforms
    // Now platform entries contain information from both the testJdk and the baselineJdk
    const newArray = [];
    for (let testDataObject of state.testData) {
      let consolidatedDataObject = {};
      let benchmark = testDataObject.benchmarkNVM.split(",")[0];
      let metric = testDataObject.benchmarkNVM.split(",")[2];
      consolidatedDataObject.platformsSpecificData = {};
      consolidatedDataObject.benchmarkNVM = testDataObject.benchmarkNVM;
      //To get the values of highterbetter/units
      //first check if Metric does already exist in constructor , if not get its info from server
      let metricProps;
      if (!metricsProps[benchmark]) {
        const metricPropsJSON = await fetchData(
          `/api/getBenchmarkMetricProps?benchmarkName=${benchmark}`
        );
        if (metricPropsJSON) {
          metricsProps[benchmark] = metricPropsJSON;
          setMetricsProps(metricPropsJSON[metric]);
        }
      } else {
        setMetricsProps(metricsProps[benchmark][metric]);
      }
      const higherBetter = !metricProps || metricProps.higherbetter !== false;
      let matchingDataObject = state.baselineData.find(
        (s) => s.benchmarkNVM === testDataObject.benchmarkNVM
      );
      // Baseline data contains information for the benchmark, comparison possible
      if (matchingDataObject != null) {
        Object.keys(testDataObject.platformsSpecificData).forEach(function (
          platform
        ) {
          // Baseline data contains same benchmark and same platform, compare values and store in comparison table
          if (
            matchingDataObject.platformsSpecificData.hasOwnProperty(platform)
          ) {
            consolidatedDataObject.platformsSpecificData[platform] = {
              ...testDataObject.platformsSpecificData[platform],
              ...matchingDataObject.platformsSpecificData[platform],
            };
            if (higherBetter) {
              consolidatedDataObject.platformsSpecificData[
                platform
              ].relativeComparison = Number(
                (testDataObject.platformsSpecificData[platform].testScore *
                  100) /
                  matchingDataObject.platformsSpecificData[platform]
                    .baselineScore
              ).toFixed(2);
            } else {
              consolidatedDataObject.platformsSpecificData[
                platform
              ].relativeComparison = Number(
                (matchingDataObject.platformsSpecificData[platform]
                  .baselineScore *
                  100) /
                  testDataObject.platformsSpecificData[platform].testScore
              ).toFixed(2);
            }
            consolidatedDataObject.platformsSpecificData[platform].totalCI =
              testDataObject.platformsSpecificData[platform].testCI +
              matchingDataObject.platformsSpecificData[platform].baselineCI;
            // Only test data exists for this platform, set comparison table cell value to test data cell value
          } else {
            consolidatedDataObject.platformsSpecificData[platform] =
              testDataObject.platformsSpecificData[platform];
            consolidatedDataObject.platformsSpecificData[
              platform
            ].relativeComparison = 0;
          }
        });
        // Baseline does not have the benchmark data, set to test data
      } else {
        consolidatedDataObject.platformsSpecificData =
          testDataObject.platformsSpecificData;
        Object.keys(consolidatedDataObject.platformsSpecificData).forEach(
          function (key, index) {
            consolidatedDataObject.platformsSpecificData[
              key
            ].relativeComparison = 0;
          }
        );
      }
      newArray.push(consolidatedDataObject);
    }

    // Loop through baseline table and the newly created array to fill the gaps in comparison table
    state.baselineData.forEach(function (baselineDataObject) {
      let matchingDataObject = newArray.find(
        (s) => s.benchmarkNVM === baselineDataObject.benchmarkNVM
      );
      if (matchingDataObject != null) {
        Object.keys(baselineDataObject.platformsSpecificData).forEach(function (
          platform
        ) {
          if (
            !matchingDataObject.platformsSpecificData.hasOwnProperty(platform)
          ) {
            matchingDataObject.platformsSpecificData[platform] =
              baselineDataObject.platformsSpecificData[platform];
            matchingDataObject.platformsSpecificData[
              platform
            ].relativeComparison = 0;
          }
        });
      } else {
        let consolidatedDataObject = {};
        consolidatedDataObject.platformsSpecificData =
          baselineDataObject.platformsSpecificData;
        Object.keys(consolidatedDataObject.platformsSpecificData).forEach(
          function (key, index) {
            consolidatedDataObject.platformsSpecificData[
              key
            ].relativeComparison = 0;
          }
        );
        consolidatedDataObject.benchmarkNVM = baselineDataObject.benchmarkNVM;
        newArray.push(consolidatedDataObject);
      }
    });

    // Set the comparison table, and a copy of the original for use with filtering
    setState((prevState) => ({
      ...prevState,
      consolidatedData: [...newArray],
      originalData: [...newArray],
    }));
    setTreeData();
  };

  const showData = async (type) => {
    setState((prevState) => ({
      ...prevState,
      platforms: [],
      platformFilter: [],
      columns: [],
      originalColumns: [],
    }));

    let info;
    if (type === "test") {
      info =
        await fetchData(`/api/getTabularData?jdkVersion=${state.testJdkVersion}&jvmType=${state.testJvmType}&jdkDate=${state.testJdkDate}
      &sdkResource=${state.testSdkResource}&buildServer=${state.testBuildServer}`);
    } else {
      info =
        await fetchData(`/api/getTabularData?jdkVersion=${state.baselineJdkVersion}&jvmType=${state.baselineJvmType}&jdkDate=${state.baselineJdkDate}
      &sdkResource=${state.baselineSdkResource}&buildServer=${state.baselineBuildServer}`);
    }

    function getPlatform(platform) {
      const inforFromBuildName = getInfoFromBuildName(platform);
      return inforFromBuildName ? inforFromBuildName.platform : null;
    }

    const platformArray = [
      ...new Set([...state.platforms, ...info.pop().map(getPlatform)]),
    ];

    setState((prevState) => ({ ...prevState, platforms: platformArray }));
    populateTable(info, type);
    generateColumns(state.platforms);
  };

  const updateDropdown = async () => {
    return fetchData("/api/getTabularDropdown").then((data) => {
      // return data from api call
      return data;
    });
  };

  const generateDropdown = (dropdownName, dropdownValues, defaultValue) => {
    let select = document.getElementById(dropdownName);
    let revertToDefault = false;
    for (const item in dropdownValues) {
      var opt = document.createElement("option");
      opt.value = dropdownValues[item];
      opt.innerHTML = dropdownValues[item];
      select.appendChild(opt);
    }
    // Check if url value exists in state, if not go to default
    if (!(dropdownName in state)) {
      revertToDefault = true;
    } else {
      // Check if url value exists in the dropdown options, if not go to default
      if (dropdownValues.indexOf(state[dropdownName]) > -1) {
        return;
      } else {
        revertToDefault = true;
      }
    }
    // Check if default exists in these dropdown options, if not use 1st index in dropdown options
    if (revertToDefault) {
      if (dropdownValues.indexOf(defaultValue) > -1) {
        setState((prevState) => ({
          ...prevState,
          [dropdownName]: defaultValue,
        }));
      } else {
        setState((prevState) => ({
          ...prevState,
          [dropdownName]: dropdownValues[0],
        }));
      }
    }
  };
  const initializeJdk = (tabularDropdown) => {
    const date = new Date().getDate().toString();
    const month = (new Date().getMonth() + 1).toString(); //Current Month
    const year = new Date().getFullYear().toString(); //Current Year
    // Assumption: JDK date is in the format of YYYYMMDD in database, example: 20190814
    const jdkDate =
      year +
      (month.length < 2 ? "0" + month : month) +
      (date.length < 2 ? "0" + date : date);
    /*
        Each database entry should contain a pipeline name (buildName) which contains the JDK Version and JVM Type.
        sdkResource in the form of null, releases, nightly, customized or upstream
        date is in the jdkDate field and in the form of YYYYMMDD
        Default values are defined in TabularViewConfig.json. Add the optional Jenkins server otherwise will default to first option
        */
    generateDropdown(
      "testJdkVersion",
      tabularDropdown["jdkVersion"],
      state.defaultValues.jdkVersion
    );
    generateDropdown(
      "testJvmType",
      tabularDropdown["jvmType"],
      state.defaultValues.jvmType
    );
    generateDropdown(
      "testSdkResource",
      tabularDropdown["sdkResource"],
      state.defaultValues.testSdkResource
    );
    generateDropdown(
      "testBuildServer",
      tabularDropdown["buildServer"],
      state.defaultValues.jenkinsServer
    );
    generateDropdown(
      "baselineJdkVersion",
      tabularDropdown["jdkVersion"],
      state.defaultValues.jdkVersion
    );
    generateDropdown(
      "baselineJvmType",
      tabularDropdown["jvmType"],
      state.defaultValues.jvmType
    );
    generateDropdown(
      "baselineSdkResource",
      tabularDropdown["sdkResource"],
      state.defaultValues.baselineSdkResource
    );
    generateDropdown(
      "baselineBuildServer",
      tabularDropdown["buildServer"],
      state.defaultValues.jenkinsServer
    );
    !("testJdkDate" in state) &&
      setState((prevState) => ({ ...prevState, testJdkDate: jdkDate }));
    !("baselineJdkDate" in state) &&
      setState((prevState) => ({ ...prevState, baselineJdkDate: jdkDate }));
  };

  const handleChange = (event) => {
    setState((prevState) => ({
      ...prevState,
      [event.target.name]: event.target.value,
    }));
  };

  const handleColorFilter = (event) => {
    setState(
      (prevState) => ({ ...prevState, colorFilter: event.target.value }),
      () => {
        // Color changed, signal to call benchmark filter first
        colorFilter(true);
      }
    );
  };

  const handleDayChange = (selectedDay, modifiers, dayPickerInput) => {
    const input = dayPickerInput.getInput();
    setState(
      (prevState) => (
        {
          ...prevState,
          selectedDay: selectedDay,
          isEmpty: !input.value.trim(),
          isDisabled: modifiers.disabled === true,
        },
        function () {
          if (state.selectedDay !== undefined) {
            // Transform date to correct format
            dateTransform(
              state.selectedDay.toLocaleDateString(),
              dayPickerInput.props.dayPickerProps.type
            );
          }
        }
      )
    );
  };

  const setTreeData = () => {
    // Set the tree select values for benchmark filter, more information found in https://ant.design/components/tree-select/
    let newArray = [];
    state.consolidatedData.forEach(function (consolidatedDataObject) {
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
      let metricLevel = {
        title: metric,
        value: consolidatedDataObject.benchmarkNVM,
      };
      let benchmarkIndex = newArray
        .map(function (x) {
          return x.title;
        })
        .indexOf(benchmark);
      // Benchmark Exists
      if (benchmarkIndex !== -1) {
        let benchmarkParent = newArray[benchmarkIndex];
        let variantIndex = benchmarkParent.children
          .map(function (x) {
            return x.title;
          })
          .indexOf(variant);
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
          variantLevel.value = benchmark + "," + variant;
          variantLevel.children = [metricLevel];
          benchmarkParent.children.push(variantLevel);
          newArray[benchmarkIndex] = benchmarkParent;
        }
      } else {
        benchmarkLevel.title = benchmark;
        benchmarkLevel.value = benchmark;
        variantLevel.title = variant;
        variantLevel.value = benchmark + "," + variant;
        variantLevel.children = [metricLevel];
        benchmarkLevel.children = [variantLevel];
        newArray.push(benchmarkLevel);
      }
    });
    setState((prevState) => ({ ...prevState, treeData: newArray }));
  };

  const handleSubmit = async (event) => {
    await showData("test");
    await showData("baseline");
    await populateCompTable();
    event.preventDefault();
    // Update URL with current state
    const newPath =
      "/tabularView?testJdkDate=" +
      state.testJdkDate +
      "&testJvmType=" +
      state.testJvmType +
      "&testJdkVersion=" +
      state.testJdkVersion +
      "&testSdkResource=" +
      state.testSdkResource +
      "&testBuildServer=" +
      state.testBuildServer +
      "&baselineJdkDate=" +
      state.baselineJdkDate +
      "&baselineJvmType=" +
      state.baselineJvmType +
      "&baselineJdkVersion=" +
      state.baselineJdkVersion +
      "&baselineSdkResource=" +
      state.baselineSdkResource +
      "&baselineBuildServer=" +
      state.baselineBuildServer;
    window.history.replaceState(null, "", newPath);
  };

  const handleProp = (val, field) => {
    if (val == null) {
      return "N/A";
    } else if (field === "buildUrl") {
      let urls = {};
      if (val["testBuildUrl"] && val["baselineBuildUrl"]) {
        urls.testBuildUrl = val["testBuildUrl"];
        urls.baselineBuildUrl = val["baselineBuildUrl"];
      } else if (val["testBuildUrl"]) {
        urls.testBuildUrl = val["testBuildUrl"];
      } else if (val["baselineBuildUrl"]) {
        urls.baselineBuildUrl = val["baselineBuildUrl"];
      }
      return urls;
    } else {
      return val[field];
    }
  };
  const handleLink = (urls) => {
    // Calling PerfCompare with Links
    let url = "perfCompare?";
    if (
      urls.hasOwnProperty("testBuildUrl") &&
      urls.hasOwnProperty("baselineBuildUrl")
    ) {
      url +=
        "testID=" + urls.testBuildUrl + "&baselineID=" + urls.baselineBuildUrl;
    } else if (urls.hasOwnProperty("testBuildUrl")) {
      url += "testID=" + urls.testBuildUrl;
    } else if (urls.hasOwnProperty("baselineBuildUrl")) {
      url += "baselineID=" + urls.baselineBuildUrl;
    } else {
      return;
    }
    const win = window.open(url, "_blank");
    win.focus();
  };

  const onPlatformChange = (checkedValues, event) => {
    let newArray = state.originalColumns;
    newArray = newArray.filter(
      (column) =>
        column.Header === "Benchmark Name" || checkedValues.includes(column.id)
    );
    setState((prevState) => ({ ...prevState, columns: newArray }));
  };

  const dateTransform = (date, type) => {
    const dateSplit = date.split("/");
    // Database date format: YYYYMMDD
    const jdkDate =
      dateSplit[2] +
      (dateSplit[0].length < 2 ? "0" + dateSplit[0] : dateSplit[0]) +
      (dateSplit[1].length < 2 ? "0" + dateSplit[1] : dateSplit[1]);
    if (type === "test") {
      setState((prevState) => ({ ...prevState, testJdkDate: jdkDate }));
    } else {
      setState((prevState) => ({ ...prevState, baselineJdkDate: jdkDate }));
    }
  };

  const generateColumns = (platforms) => {
    const newArray = [];
    let column = {
      Header: "Benchmark Name",
      accessor: "benchmarkNVM",
      // The three line breaks ensure the benchmark name, variant and metric appear in separate lines
      Cell: (props) => (
        <span>
          {props.value.split(",")[0]} <br /> {props.value.split(",")[1]} <br />{" "}
          {props.value.split(",")[2]}
        </span>
      ),
    };
    newArray.push(column);
    for (let i = 0; i < platforms.length; i++) {
      let platform = platforms[i];
      column = {};
      column.id = platform;
      column.Header = platform.toUpperCase();
      column.accessor = (d) => d.platformsSpecificData[platform];
      // Each cell needs to display the comparison by default, on hover displays further details
      column.Cell = (props) => (
        <Tooltip
          title={
            <div>
              Test Raw Score: {handleProp(props.value, "testScore")} <br />
              Test CI: {handleProp(props.value, "testCI")} <br />
              Test JDK Date: {handleProp(props.value, "testJdkDate")} <br />
              Test Sdk Resource: {handleProp(
                props.value,
                "testSdkResource"
              )}{" "}
              <br />
              Baseline Raw Score: {handleProp(
                props.value,
                "baselineScore"
              )}{" "}
              <br />
              Baseline CI: {handleProp(props.value, "baselineCI")} <br />
              Baseline JDK Date: {handleProp(
                props.value,
                "baselineJdkDate"
              )}{" "}
              <br />
              Baseline Sdk Resource:{" "}
              {handleProp(props.value, "baselineSdkResource")}
            </div>
          }
        >
          <span onClick={() => handleLink(handleProp(props.value, "buildUrl"))}>
            {" "}
            {handleProp(props.value, "relativeComparison")} % <br />{" "}
            {handleCI(
              handleProp(props.value, "totalCI"),
              handleProp(props.value, "relativeComparison")
            )}{" "}
          </span>
        </Tooltip>
      );
      column.getProps = (state, rowInfo) =>
        handleRegression(
          handleProp(rowInfo.row[platform], "relativeComparison")
        );
      newArray.push(column);
    }

    setState((prevState) => ({
      ...prevState,
      columns: newArray,
      originalColumns: newArray,
    }));
  };

  const handleRegression = (val) => {
    let color;
    if (val === 0) {
      color = "#ffdbac";
    } else if (val <= redFilter[1] && val > redFilter[0]) {
      color = "#cc3232";
    } else if (val <= yellowFilter[1] && val > yellowFilter[0]) {
      color = "#F0F755";
    } else if (val === "N/A") {
      color = "grey";
    } else color = "#2dc937";
    return {
      style: {
        fontSize: 25,
        backgroundColor: color,
      },
    };
  };

  const handleCI = (totalCI, relativeComparison) => {
    if (
      relativeComparison === 100 ||
      relativeComparison === 0 ||
      relativeComparison === "N/A"
    ) {
      return;
    } else if (totalCI * 100 < Math.abs(relativeComparison - 100) + 0.7) {
      return;
    } else {
      return <WarningOutlined />;
    }
  };

  const colorFilter = (firstFilter) => {
    // Always call benchmark filter first if true
    if (firstFilter) {
    } else {
      // If set to state.consolidated data, ends up changing the original data due to how javascript stores objects inside arrays
      let newArray = JSON.parse(JSON.stringify(state.consolidatedData));
      let filterRange;
      // If color filter is set to ALL, do not not apply filter
      if (state.colorFilter === "green") {
        filterRange = greenFilter;
      } else if (state.colorFilter === "yellow") {
        filterRange = yellowFilter;
      } else if (state.colorFilter === "red") {
        filterRange = redFilter;
      } else {
        return;
      }

      for (let i = 0; i < state.consolidatedData.length; i++) {
        for (let platform in state.consolidatedData[i].platformsSpecificData) {
          // Set values to N/A if they are outside the filterRange
          if (
            parseFloat(
              state.consolidatedData[i].platformsSpecificData[platform]
                .relativeComparison
            ) > filterRange[1] ||
            parseFloat(
              state.consolidatedData[i].platformsSpecificData[platform]
                .relativeComparison
            ) <= filterRange[0]
          ) {
            newArray[i].platformsSpecificData[platform].relativeComparison =
              "N/A";
          }
        }
      }
      setState((prevState) => ({ ...prevState, consolidatedData: newArray }));
    }
  };
  const benchmarkFilter = (value) => {
    let newArray = [];
    //Always call color filter after applying benchmark filter, if no filter selected return original data
    if (value.length === 0) {
      setState((prevState) => ({ ...prevState, colorFilter: false }));
    } else {
      state.originalData.forEach(function (element) {
        let found = false;
        for (let i = 0; i < value.length; i++) {
          if (element.benchmarkNVM.indexOf(value[i]) !== -1) {
            found = true;
          }
        }
        if (found) {
          newArray.push(element);
        }
      });
      setState(
        (prevState) => (
          { ...prevState, consolidatedData: newArray },
          () => {
            colorFilter(false);
          }
        )
      );
    }
  };
  const handleEntry = (index, testResultObject, metric, type) => {
    if (type === "test") {
      return {
        testScore:
          testResultObject.aggregateInfo[index].metrics[metric].statValues.mean,
        testJdkDate: testResultObject.jdkDate,
        testCI:
          testResultObject.aggregateInfo[index].metrics[metric].statValues.CI,
        testSdkResource: testResultObject.sdkResource,
        testBuildUrl: testResultObject.buildUrl,
        relativeComparison:
          testResultObject.aggregateInfo[index].metrics[metric].statValues.mean,
      };
    } else {
      return {
        baselineScore:
          testResultObject.aggregateInfo[index].metrics[metric].statValues.mean,
        baselineJdkDate: testResultObject.jdkDate,
        baselineCI:
          testResultObject.aggregateInfo[index].metrics[metric].statValues.CI,
        baselineSdkResource: testResultObject.sdkResource,
        baselineBuildUrl: testResultObject.buildUrl,
        relativeComparison:
          testResultObject.aggregateInfo[index].metrics[metric].statValues.mean,
      };
    }
  };
  const populateTable = (data, type) => {
    /* Table object format, each entry in the array is an object with two fields benchmarkNVM (benchmark Name Variant Metric) and platformsSpecificData.
        platformsSpecificData is an object with each field being a separate platform containing the jdk data such as score, date, CI */
    const newArray = [];
    let dataObject = {};
    let platform;
    let benchmarkNVM = "";
    let found = false;

    data
      .forEach(function (testResultsObject) {
        const buildInfo = getInfoFromBuildName(testResultsObject.buildName);
        if (buildInfo) {
          platform = buildInfo.platform;
          for (
            let aggregateIndex = 0;
            aggregateIndex < testResultsObject.aggregateInfo.length;
            aggregateIndex++
          ) {
            for (const metric in testResultsObject.aggregateInfo[aggregateIndex]
              .metrics) {
              found = false;
              benchmarkNVM =
                testResultsObject.aggregateInfo[aggregateIndex].benchmarkName +
                "," +
                testResultsObject.aggregateInfo[aggregateIndex]
                  .benchmarkVariant +
                "," +
                testResultsObject.aggregateInfo[aggregateIndex].metrics[metric]
                  .name;
              for (const currentDataObject in newArray) {
                // If benchmark already exists append to it
                if (newArray[currentDataObject].benchmarkNVM === benchmarkNVM) {
                  found = true;
                  newArray[currentDataObject].platformsSpecificData[platform] =
                    handleEntry(
                      aggregateIndex,
                      testResultsObject,
                      metric,
                      type
                    );
                  break;
                }
              }
              // Create a new entry if benchmark name does not exist
              if (!found) {
                dataObject = {};
                dataObject.platformsSpecificData = {};
                dataObject.benchmarkNVM = benchmarkNVM;
                dataObject.platformsSpecificData[platform] = handleEntry(
                  aggregateIndex,
                  testResultsObject,
                  metric,
                  type
                );
                newArray.push(dataObject);
              }
            }
          }
        }
      }
      .bind(this)
    );
    
    if (type === "test") {
      setState((prevState) => ({ ...prevState, testData: newArray }));
    } else {
      setState((prevState) => ({ ...prevState, baselineData: newArray }));
    }
  };

  const tProps = {
    value: state.benchmarkFilter,
    onChange: onBenchmarkChange,
    treeCheckable: true,
    showCheckedStrategy: SHOW_PARENT,
    placeholder: "Please choose the benchmarks to view",
    style: {
      width: 1000,
    },
  };

  return (
    <div>
      <div className="row">
        <div className="column" style={{ fontSize: 20, fontWeight: "bold" }}>
          {" "}
          Parameters <br />{" "}
        </div>
        <div className="column" style={{ fontSize: 20, fontWeight: "bold" }}>
          {" "}
          Test <br />{" "}
        </div>
        <div className="column" style={{ fontSize: 20, fontWeight: "bold" }}>
          {" "}
          Baseline <br />{" "}
        </div>
      </div>
      <div className="row">
        <div className="column" style={colStyle}>
          {" "}
          JDK Date <br />{" "}
        </div>
        <div className="column">
          <DayPickerInput
            onDayChange={handleDayChange}
            value={state.testJdkDate}
            overlayComponent={CustomOverlay}
            dayPickerProps={{
              todayButton: "Today",
              type: "test",
            }}
            keepFocus={false}
          />
          <Tooltip
            placement="topRight"
            title="Table will contain latest results from all builds dated before the chosen date regardless of when the benchmark was run."
          >
            <QuestionCircleOutlined />
          </Tooltip>
        </div>
        <div className="column">
          <DayPickerInput
            onDayChange={handleDayChange}
            value={state.baselineJdkDate}
            overlayComponent={CustomOverlay}
            dayPickerProps={{
              todayButton: "Today",
              type: "baseline",
            }}
            keepFocus={false}
          />
          <Tooltip
            placement="topRight"
            title="Table will contain latest results from all builds dated before the chosen date regardless of when the benchmark was run."
          >
            <QuestionCircleOutlined />
          </Tooltip>
        </div>
      </div>
      <div className="row">
        <div className="column" style={colStyle}>
          {" "}
          JDK Version <br />{" "}
        </div>
        <div className="column">
          {" "}
          <select
            id="testJdkVersion"
            name="testJdkVersion"
            className="select-css"
            value={state.testJdkVersion}
            onChange={handleChange.bind(this)}
          ></select>
        </div>
        <div className="column">
          {" "}
          <select
            id="baselineJdkVersion"
            name="baselineJdkVersion"
            className="select-css"
            value={state.baselineJdkVersion}
            onChange={handleChange.bind(this)}
          ></select>
        </div>
      </div>
      <div className="row">
        <div className="column" style={colStyle}>
          {" "}
          JVM Type <br />{" "}
        </div>
        <div className="column">
          {" "}
          <select
            id="testJvmType"
            name="testJvmType"
            className="select-css"
            value={state.testJvmType}
            onChange={handleChange.bind(this)}
          ></select>
        </div>
        <div className="column">
          {" "}
          <select
            id="baselineJvmType"
            name="baselineJvmType"
            className="select-css"
            value={state.baselineJvmType}
            onChange={handleChange.bind(this)}
          ></select>
        </div>
      </div>
      <div className="row">
        <div className="column" style={colStyle}>
          {" "}
          SDK Resource <br />{" "}
        </div>
        <div className="column">
          {" "}
          <select
            id="testSdkResource"
            name="testSdkResource"
            className="select-css"
            value={state.testSdkResource}
            onChange={handleChange.bind(this)}
          ></select>
        </div>
        <div className="column">
          {" "}
          <select
            id="baselineSdkResource"
            name="baselineSdkResource"
            className="select-css"
            value={state.baselineSdkResource}
            onChange={handleChange.bind(this)}
          ></select>
        </div>
        <div className="row">
          <div className="column" style={colStyle}>
            {" "}
            Jenkins Server <br />{" "}
          </div>
          <div className="column">
            {" "}
            <select
              id="testBuildServer"
              name="testBuildServer"
              className="select-css"
              value={state.testBuildServer}
              onChange={handleChange.bind(this)}
            ></select>
          </div>
          <div className="column">
            {" "}
            <select
              id="baselineBuildServer"
              name="baselineBuildServer"
              className="select-css"
              value={state.baselineBuildServer}
              onChange={handleChange.bind(this)}
            ></select>
          </div>
        </div>
      </div>

      <Button type="primary" onClick={handleSubmit.bind(this)}>
        Submit
      </Button>

      <Collapse>
        <Panel header="Filters" key="1">
          {" "}
          <label> Choose Platforms: </label>{" "}
          <Checkbox.Group
            options={state.platformFilter}
            onChange={onPlatformChange.bind(this)}
          />
          <br />
          <TreeSelect treeData={state.treeData} {...tProps} /> <br />
          <span> Please choose the color filter: </span>
          <select
            name="colorFilter"
            value={state.colorFilter}
            onChange={handleColorFilter.bind(this)}
          >
            <option value="all">All</option>
            <option value="green">Green</option>
            <option value="red">Red</option>
            <option value="yellow">Yellow</option>
          </select>
        </Panel>
      </Collapse>
      <ReactTable
        data={state.consolidatedData}
        columns={state.columns}
        showPaginationBottom={false}
        showPageSizeOptions={false}
        minRows={0}
        pageSize={state.consolidatedData.length}
      />
      <br />
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
              fontSize: 20,
            },
          };
        }}
      />
    </div>
  );
};

export default TabularView;
