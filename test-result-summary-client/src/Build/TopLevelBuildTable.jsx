// Import React, useState and useEffect from the 'react' module, and several other components from various other modules.
import React, { useState, useEffect } from 'react';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { Table, Checkbox, Popconfirm } from 'antd';
import { Link } from 'react-router-dom';
import { params } from '../utils/query';
import { fetchData, setBuildsStatus } from '../utils/Utils';
import BuildLink from './BuildLink';
import BuildStatus from './Summary/BuildStatus';

// Set the page size for the table.
const pageSize = 5;

// Define the TopLevelBuildTable component.
function TopLevelBuildTable(props) {
    // Destructure buildName, url, and type from the props object.
    const { buildName, url, type } = props;
    // Declare two state variables, currentPage and buildInfo, using the useState hook.
    const [currentPage, setCurrentPage] = useState(1);
    const [buildInfo, setBuildInfo] = useState([]);

    // Use the useEffect hook to fetch data and update the component state when certain props or state variables change.
    useEffect(() => {
        fetchDataAndUpdate();
    }, [buildName, url, currentPage]);

    // Declare a function that updates the totals for each build.
    async function updateTotals(buildInfo) {
        if (buildInfo) {
            // Determine the range of builds to update based on the current page.
            const i = pageSize * (currentPage - 1);

            // Create a copy of the buildInfo array.
            const buildInfoCopy = [...buildInfo];

            // Use Promise.all to fetch the totals for each build in the range that hasn't been fetched yet.
            await Promise.all(
                buildInfoCopy
                    .slice(i, pageSize * currentPage)
                    .map(async (build) => {
                        if (build.totals) return;
                        const totals = await fetchData(
                            `/api/getTotals?buildName=${buildName}&url=${url}&buildNum=${build.build.buildNum}`
                        );
                        build.totals = totals;
                    })
            );

            // Update the buildInfo state variable with the updated copy.
            await setBuildInfo(buildInfoCopy);
        }
    }

    // Declare a function that fetches data and calls updateTotals.
    async function fetchDataAndUpdate() {
        await updateData();
    }

    // Declare a function that fetches build data and maps it into the format expected by the table.
    async function updateData() {
        const builds = await fetchData(
            `/api/getBuildHistory?buildName=${buildName}&url=${url}&limit=120`
        );

        const newBuildInfo = builds.map((build) => ({
            key: build._id,
            build: build,
            date: build.timestamp
                ? new Date(build.timestamp).toLocaleString()
                : null,
            startBy: build.startBy ? build.startBy : 'N/A',
            jenkins: build,
            keepForever: build.keepForever ? build.keepForever : false,
        }));

        // Call updateTotals with the new build info.
        await updateTotals(newBuildInfo);
    }

    // Declare a function that handles the Keep Forever checkbox.
    async function handleKeepForverClick(record) {
        // If the 'record' object has a 'key' property:
        if (record.key) {
            // Loop through each 'build' object in the 'buildInfo' array:
            for (let build of buildInfo) {
                // If the 'key' property of the current 'build' object matches the 'key' property of the 'record' object:
                if (build.key === record.key) {
                    // Toggle the 'keepForever' property of the 'build' object.
                    build.keepForever = !build.keepForever;
                    // Send a 'get' request to the '/api/updateKeepForever' endpoint with query parameters for the 'id' and 'keepForever' properties of the 'build' object.
                    await fetch(
                        `/api/updateKeepForever?_id=${build.key}&keepForever=${build.keepForever}`,
                        {
                            method: 'get',
                        }
                    );
                    // Exit the loop after the first match.
                    break;
                }
            }
            setBuildInfo(structuredClone(buildInfo));
        }
    }

    function onChange(page) {
        // Set the 'currentPage' state variable to the provided 'page' argument.
        setCurrentPage(page);
    }

    if (buildInfo) {
        // Define a function that renders a table cell for a 'FvTestBuild' object.
        const renderFvTestBuild = (value) => {
            // If the provided 'value' argument is truthy and has a 'buildNum' property:
            if (value && value.buildNum) {
                // Call the 'setBuildsStatus' function to update the 'buildResult' property of the 'value' object.
                value.buildResult = setBuildsStatus(value, value.buildResult);
                // Return a JSX element with a 'BuildStatus' and 'renderPublishName' component, passing in relevant props.
                return (
                    <>
                        <BuildStatus
                            status={value.buildResult}
                            id={value._id}
                            buildNum={value.buildNum}
                        />
                        {renderPublishName(value)}
                    </>
                );
            }
            // If the provided 'value' argument is falsy or does not have a 'buildNum' property, return 'null'.
            return null;
        };

        // Define function to render build link
        const renderBuild = (value) => {
            // If value exists and has a buildNum property
            if (value && value.buildNum) {
                // Set the result variable to the build result
                let result = value.buildResult;
                // If the value has tests and the length of the tests array is greater than 0
                if (value.tests && value.tests.length > 0) {
                    // Set the result variable to the test result of the first test in the tests array
                    result = value.tests[0].testResult;
                    // If the first test has an _id property
                    if (value.tests[0]._id) {
                        // Return a link to the output test page for the first test
                        return (
                            <div>
                                <Link
                                    to={{
                                        pathname: '/output/test',
                                        search: params({
                                            id: value.tests[0]._id,
                                        }),
                                    }}
                                    style={{
                                        color:
                                            result === 'PASSED'
                                                ? '#2cbe4e'
                                                : result === 'FAILED'
                                                ? '#f50'
                                                : '#DAA520',
                                    }}
                                >
                                    Build #{value.buildNum}
                                </Link>
                            </div>
                        );
                    }
                } else {
                    // Return a link to the build detail page
                    return (
                        <div>
                            <Link
                                to={{
                                    pathname: '/buildDetail',
                                    search: params({ parentId: value._id }),
                                }}
                                style={{
                                    color:
                                        result === 'SUCCESS'
                                            ? '#2cbe4e'
                                            : result === 'FAILURE'
                                            ? '#f50'
                                            : '#DAA520',
                                }}
                            >
                                {' '}
                                Build #{value.buildNum}
                            </Link>
                        </div>
                    );
                }
            }
            // If value does not exist or does not have a buildNum property, return null
            return null;
        };

        // Define function to render Jenkins links
        const renderJenkinsLinks = ({ buildName, buildNum, buildUrl, url }) => {
            // Temporarily support BlueOcean link under folders
            let blueOcean;
            // If the url includes "/jobs" or "/build-scripts"
            if (
                `${url}`.includes('/jobs') ||
                `${url}`.includes('/build-scripts')
            ) {
                // Split the url by "/job/"
                let urls = url.split('/job/');
                // Get the basic url by shifting the first element off the urls array
                let basicUrl = urls.shift();
                // Push the buildName onto the urls array
                urls.push(buildName);
                // Join the urls array with "%2F" and assign to newUrl
                let newUrl = urls.join('%2F');
                // Construct the BlueOcean link using the basicUrl and newUrl variables
                blueOcean = `${basicUrl}/blue/organizations/jenkins/${newUrl}/detail/${buildName}/${buildNum}`;
            } else {
                // Construct the BlueOcean link using the url, buildName, and buildNum variables
                blueOcean = `${url}/blue/organizations/jenkins/${buildName}/detail/${buildName}/${buildNum}`;
            }
            // Return links to the buildUrl and BlueOcean pages
            return (
                <div>
                    <a
                        href={buildUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {buildName} #{buildNum}
                    </a>
                    <br />
                    <a
                        href={blueOcean}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Blue Ocean
                    </a>
                </div>
            );
        };

        const renderTotals = (value, row, index) => {
            // Return 'N/A' if no value
            if (!value) return <div>N/A</div>;
            // Destructure the value object
            const {
                failed = 0,
                passed = 0,
                disabled = 0,
                skipped = 0,
                total = 0,
            } = value;
            // Get the build result and ID
            const buildResult = row.build.buildResult;
            const id = row.build._id;
            // Return JSX
            return (
                <>
                    <Link
                        to={{
                            pathname: '/resultSummary',
                            search: params({ parentId: id }),
                        }}
                        style={{
                            color:
                                buildResult === 'SUCCESS'
                                    ? '#2cbe4e'
                                    : buildResult === 'FAILURE'
                                    ? '#f50'
                                    : '#DAA520',
                        }}
                    >
                        Grid
                    </Link>
                    <div>
                        <BuildLink
                            id={id}
                            label="Failed: "
                            link={failed}
                            testSummaryResult="failed"
                            buildNameRegex="^Test.*"
                        />
                        <BuildLink
                            id={id}
                            label="Passed: "
                            link={passed}
                            testSummaryResult="passed"
                            buildNameRegex="^Test.*"
                        />
                        <BuildLink
                            id={id}
                            label="Disabled: "
                            link={disabled}
                            testSummaryResult="disabled"
                            buildNameRegex="^Test.*"
                        />
                        <BuildLink
                            id={id}
                            label="Skipped: "
                            link={skipped}
                            testSummaryResult="skipped"
                            buildNameRegex="^Test.*"
                        />
                        <BuildLink
                            id={id}
                            label="Total: "
                            link={total}
                            testSummaryResult="total"
                            buildNameRegex="^Test.*"
                        />
                    </div>
                </>
            );
        };

        const renderBuildResults = (value) => {
            return (
                <div>
                    <BuildLink
                        id={value._id}
                        link="Failed Builds "
                        buildResult="!SUCCESS"
                    />
                </div>
            );
        };

        const renderPublishName = ({ buildParams = [] }) => {
            if (buildParams) {
                const param = buildParams.find(
                    (param) => param.name === 'overridePublishName'
                );
                if (param) return param.value;
            }
            return;
        };

        const columns = [
            {
                title: 'Build',
                dataIndex: 'build',
                key: 'build',
                render: type === 'Perf' ? renderBuild : renderFvTestBuild,
                sorter: (a, b) => {
                    return a.key.localeCompare(b.key);
                },
            },
            {
                title: 'Build Results',
                dataIndex: 'build',
                key: 'buildResults',
                render: renderBuildResults,
            },
            {
                title: 'Test Results',
                dataIndex: 'totals',
                key: 'testResults',
                render: renderTotals,
            },
            {
                title: 'StartBy',
                dataIndex: 'startBy',
                key: 'startBy',
                sorter: (a, b) => {
                    return a.startBy.localeCompare(b.startBy);
                },
            },
            {
                title: 'Jenkins Link',
                dataIndex: 'jenkins',
                key: 'jenkins',
                render: renderJenkinsLinks,
            },
            {
                title: 'Date',
                dataIndex: 'date',
                key: 'date',
                sorter: (a, b) => {
                    return a.date.localeCompare(b.date);
                },
            },
            {
                title: 'Keep Forever',
                dataIndex: 'keepForever',
                key: 'keepForever',
                render: (value, record) => {
                    return (
                        <Popconfirm
                            title={
                                value
                                    ? "Unchecking 'keep forever' means the build results will be deleted once max # of builds to keep is reached. Uncheck?"
                                    : 'Keep this build forever?'
                            }
                            onConfirm={() => handleKeepForverClick(record)}
                            icon={
                                <QuestionCircleOutlined
                                    style={{ color: 'red' }}
                                />
                            }
                            okText="Yes"
                            cancelText="No"
                            okType="default"
                            cancelButtonProps={{ type: 'primary' }}
                        >
                            <Checkbox checked={value}></Checkbox>
                        </Popconfirm>
                    );
                },
            },
        ];

        return (
            <Table
                columns={columns}
                dataSource={buildInfo}
                title={() => (
                    <div>
                        <Link
                            to={{
                                pathname: '/builds',
                                search: params({
                                    buildName,
                                    url,
                                    type,
                                }),
                            }}
                        >
                            <b>{buildName}</b> in server {url}
                        </Link>
                    </div>
                )}
                pagination={{ pageSize, onChange }}
            />
        );
    }
}

export default TopLevelBuildTable;
