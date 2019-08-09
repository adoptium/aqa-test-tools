import React, { Component } from 'react';
import { Icon, Table, Tooltip } from 'antd';
import { Link } from 'react-router-dom';
import { params } from '../utils/query';

export default class TopLevelBuilds extends Component {
    state = {};

    async componentDidMount() {
        await this.updateData(this.props.match.params.type);
        this.intervalId = setInterval(() => {
            this.updateData(this.props.match.params.type);
        }, 5 * 60 * 1000);

    }
    async componentWillReceiveProps(nextProps) {
        if (nextProps.match.params.type !== this.props.match.params.type) {
            await this.updateData(nextProps.match.params.type);
        }
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    async updateData(type) {
        const builds = {};

        const response = await fetch(`/api/getTopLevelBuildNames?type=${type}`, {
            method: 'get'
        });
        const results = await response.json();
        for (let i = 0; i < results.length; i++) {
            const url = results[i]._id.url;
            const buildName = results[i]._id.buildName;
            const fetchBuild = await fetch(`/api/getBuildHistory?buildName=${buildName}&url=${url}`, {
                method: 'get'
            });
            const res = await fetchBuild.json();
            if (!builds[url]) {
                builds[url] = {};
            }

            const allBuilds = await Promise.all(res.map(async build => {
                build.totals = {};
                const fetchBuild = await fetch(`/api/getTotals?buildName=${buildName}&url=${url}&buildNum=${build.buildNum}`, {
                    method: 'get'
                });
                build.totals = await fetchBuild.json();
                return build;
            }));

            builds[url][buildName] = allBuilds;
        }
        this.setState({ builds, type });
    }

    render() {
        const { builds, type } = this.state;

        if (builds && type) {
            const renderFvTestBuild = (value, row, index) => {
                if (value && value.buildNum) {
                    let icon = "";
                    if (value.status != "Done") {
                        icon = <Icon type="loading" style={{ fontSize: 16, color: '#DAA520' }} />;
                        value.buildResult = "PROGRESSING"
                    } else if (value.buildResult === "SUCCESS") {
                        icon = <Icon type="check" style={{ fontSize: 16, color: '#2cbe4e' }} />;
                    } else if (value.buildResult === "FAILURE") {
                        icon = <Icon type="close" style={{ fontSize: 16, color: '#f50' }} />;
                    } else {
                        icon = <Icon type="info" style={{ fontSize: 16, color: '#f50' }} />;
                    }
                    return <div>
                        <Link to={{ pathname: '/buildDetail', search: params({ parentId: value._id }) }}
                            style={{ color: value.buildResult === "SUCCESS" ? "#2cbe4e" : (value.buildResult === "FAILURE" ? "#f50" : "#DAA520") }}>Build #{value.buildNum}  <Tooltip title={value.buildResult}>{icon}</Tooltip>
                        </Link>

                        <br />{renderPublishName(value)}
                    </div>
                }
                return null;
            };

            const renderBuild = (value) => {
                if (value && value.buildNum) {
                    let result = value.buildResult;
                    if (value.tests && value.tests.length > 0) {
                        result = value.tests[0].testResult;
                        if (value.tests[0]._id) {
                            return <div>
                                <Link to={{ pathname: '/output/test', search: params({ id: value.tests[0]._id }) }}
                                    style={{ color: result === "PASSED" ? "#2cbe4e" : (result === "FAILED" ? "#f50" : "#DAA520") }}>
                                    Build #{value.buildNum}
                                </Link>
                            </div>;
                        }
                    } else {
                        return <div>
                            <Link to={{ pathname: '/buildDetail', search: params({ parentId: value._id }) }}
                                style={{ color: result === "SUCCESS" ? "#2cbe4e" : (result === "FAILURE" ? "#f50" : "#DAA520") }}> Build #{value.buildNum}
                            </Link>
                        </div>;
                    }
                }
                return null;
            };

            const renderJenkinsLinks = ({ buildName, buildNum, buildUrl, url }) => {
                // Temporarily support BlueOcean link under folders
                let blueOcean;
                if (`${url}`.includes("/jobs") || `${url}`.includes("/build-scripts")) {
                    let urls = url.split("/job/");
                    let basicUrl = urls.shift();
                    urls.push(buildName);
                    let newUrl = urls.join("%2F");
                    blueOcean = `${basicUrl}/blue/organizations/jenkins/${newUrl}/detail/${buildName}/${buildNum}`;
                } else {
                    blueOcean = `${url}/blue/organizations/jenkins/${buildName}/detail/${buildName}/${buildNum}`;
                }
                return <div><a href={buildUrl} target="_blank" rel="noopener noreferrer">{buildName} #{buildNum}</a><br /><a href={blueOcean} target="_blank" rel="noopener noreferrer">Blue Ocean</a></div>;
            };

            const renderTotals = (value) => {
                const totals = value.totals;
                if (!totals) return <div>N/A</div>;

                return <>
                    <Link to={{ pathname: '/resultGrid', search: params({ parentId: value._id }) }}
                        style={{ color: value.buildResult === "SUCCESS" ? "#2cbe4e" : (value.buildResult === "FAILURE" ? "#f50" : "#DAA520") }}>Grid
                    </Link>
                    <div>
                        {renderResults(value, "Failed: ", totals.failed ? totals.failed : 0, undefined, "failed", "^Test.*")}
                        {renderResults(value, "Passed: ", totals.passed ? totals.passed : 0, undefined, "passed", "^Test.*")}
                        {renderResults(value, "Disabled: ", totals.disabled ? totals.disabled : 0, undefined, "disabled", "^Test.*")}
                        {renderResults(value, "Skipped: ", totals.skipped ? totals.skipped : 0, undefined, "skipped", "^Test.*")}
                        {renderResults(value, "Total: ", totals.total ? totals.total : 0)}
                    </div>
                </>;
            };

            const renderBuildResults = (value) => {
                return <div>
                    {renderResults(value, "", "Failed Builds ", "!SUCCESS")}
                </div>;
            };

            const renderResults = (build, label, link, buildResult, testSummaryResult, buildNameRegex) => {
                if (build && build.buildNum) {
                    return <span>
                        {label}<Link to={{ pathname: '/buildDetail', search: params({ parentId: build._id, buildResult, testSummaryResult, buildNameRegex }) }}>{link} </Link>
                    </span>;
                }
                return null;
            };

            const renderPublishName = ({ buildParams = [] }) => {
                const param = buildParams.find(param => param.name === "overridePublishName");
                if (param)
                    return param.value;
            };

            const columns = [{
                title: 'Build',
                dataIndex: 'build',
                key: 'build',
                render: type === "Perf" ? renderBuild : renderFvTestBuild,
                sorter: (a, b) => {
                    return a.key.localeCompare(b.key);
                }
            }, {
                title: 'Build Results',
                dataIndex: 'totals',
                key: 'buildResults',
                render: renderBuildResults,
            }, {
                title: 'Test Results',
                dataIndex: 'totals',
                key: 'testResults',
                render: renderTotals,
            }, {
                title: 'StartBy',
                dataIndex: 'startBy',
                key: 'startBy',
                sorter: (a, b) => {
                    return a.startBy.localeCompare(b.startBy);
                }
            }, {
                title: 'Jenkins Link',
                dataIndex: 'jenkins',
                key: 'jenkins',
                render: renderJenkinsLinks,
            }, {
                title: 'Date',
                dataIndex: 'date',
                key: 'date',
                sorter: (a, b) => {
                    return a.date.localeCompare(b.date);
                }
            }];

            return (
                <div>
                    {Object.values(builds).map((urls, i) => {
                        return Object.values(urls).map((infos, i) => {
                            const buildInfo = infos.map(info => ({
                                key: info.buildUrl,
                                build: info,
                                date: info.timestamp ? new Date(info.timestamp).toLocaleString() : null,
                                startBy: info.startBy ? info.startBy : null,
                                jenkins: info,
                                totals: info
                            }));
                            return <Table
                                key={i}
                                columns={columns}
                                dataSource={buildInfo}
                                title={() => <div><b>{buildInfo[0].build.buildName}</b> in server {buildInfo[0].build.url}</div>}
                                pagination={{ pageSize: 5 }}
                            />
                        })
                    })}
                </div>);
        } else {
            return null;
        }
    }
}
