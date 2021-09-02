import React, { Component } from 'react';
import { CheckOutlined, CloseOutlined, InfoOutlined, LoadingOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Table, Tooltip, Checkbox, Popconfirm } from 'antd';
import { Link } from 'react-router-dom';
import { params } from '../utils/query';
import { fetchData, timeConversion } from '../utils/Utils';
import BuildLink from './BuildLink';

const pageSize = 5;
export default class BuildCompare extends Component {

    state = {
        currentPage: 1,
        buildInfo: [],
    };

    async componentDidMount() {
        await this.updateData();
    }

    async componentDidUpdate(prevProps, prevState) {
        if (prevProps.url !== this.props.url) {
            await this.updateData();
        }

        if (prevState.currentPage !== this.state.currentPage) {
            await this.updateTotals();
        }
    }

    retrieveParams(buildParams) {
	var params = {}
    	buildParams.forEach((dict)=> params[dict.name] = dict.value)	
	return params
    }

    async updateData() {
        const { buildName, url } = this.props;
console.log(this.props)
        const builds = await fetchData(`/api/getBuildHistory?buildName=${buildName}&url=${url}&limit=120`);
    
        const buildInfo = builds.map(build => {
	const params = this.retrieveParams(build.buildParams)
	return {
            key: build._id,
            build: build,
            date: build.timestamp ? new Date(build.timestamp).toLocaleString() : null,
            vendor: "N/A",
            impl: params.JDK_IMPL,
	    version: params.JDK_VERSION,
	    platform: params.PLATFORM,
	    time: timeConversion(build.buildDuration)
        }});
        this.setState({ buildInfo });

        await this.updateTotals();
    }

    async updateTotals() {
        let { buildInfo, currentPage } = this.state;
        if (buildInfo) {
            const { buildName, url } = this.props;
            // only query getTotals if buildInfo does not have the data
            const i = pageSize * (currentPage - 1);

            await Promise.all(buildInfo.slice(i, pageSize * currentPage).map(async build => {
                if (build.totals) return;
                const totals = await fetchData(`/api/getTotals?buildName=${buildName}&url=${url}&buildNum=${build.build.buildNum}`);
                build.totals = totals;
            }));
            this.forceUpdate();
        }
    }

    onChange = page => {
        this.setState({
            currentPage: page,
        });
    };

    handleKeepForverClick = async (record) => {
        const { buildInfo } = this.state;
        if (record.key) {
            for (let build of buildInfo) {
                if (build.key === record.key) {
                    build.keepForever = !build.keepForever;
                    await fetch(`/api/updateKeepForever?_id=${build.key}&keepForever=${build.keepForever}`, {
                        method: 'get'
                    });
                    break;
                }
            }
            await new Promise(r => setTimeout(r, 100));
            this.setState({ buildInfo });
        }
    }

    render() {
        const { buildInfo } = this.state;
        const { buildName, url, type } = this.props;
        if (buildInfo) {
            const renderFvTestBuild = (value) => {
                if (value && value.buildNum) {
                    let icon = "";
                    if (value.status !== "Done") {
                        icon = <LoadingOutlined style={{ fontSize: 16, color: '#DAA520' }} />;
                        value.buildResult = "PROGRESSING"
                    } else if (value.buildResult === "SUCCESS") {
                        icon = <CheckOutlined style={{ fontSize: 16, color: '#2cbe4e' }} />;
                    } else if (value.buildResult === "FAILURE") {
                        icon = <CloseOutlined style={{ fontSize: 16, color: '#f50' }} />;
                    } else {
                        icon = <InfoOutlined style={{ fontSize: 16, color: '#f50' }} />;
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

            const renderTotals = (value, row, index) => {
                if (!value) return <div>N/A</div>;
                const { failed = 0, passed = 0, disabled = 0, skipped = 0, total = 0 } = value;
                const buildResult = row.build.buildResult;
                const id = row.build._id;
                return <>
                    <Link to={{ pathname: '/resultSummary', search: params({ parentId: id }) }}
                        style={{ color: buildResult === "SUCCESS" ? "#2cbe4e" : (buildResult === "FAILURE" ? "#f50" : "#DAA520") }}>Grid
                    </Link>
                    <div>
                        <BuildLink id={id} label="Failed: " link={failed} testSummaryResult="failed" buildNameRegex="^Test.*" />
                        <BuildLink id={id} label="Passed: " link={passed} testSummaryResult="passed" buildNameRegex="^Test.*" />
                        <BuildLink id={id} label="Disabled: " link={disabled} testSummaryResult="disabled" buildNameRegex="^Test.*" />
                        <BuildLink id={id} label="Skipped: " link={skipped} testSummaryResult="skipped" buildNameRegex="^Test.*" />
                        <BuildLink id={id} label="Total: " link={total} testSummaryResult="total" buildNameRegex="^Test.*" />
                    </div>
                </>;
            };

            const renderBuildResults = (value) => {
                return <div>
                    <BuildLink id={value._id} link={value.buildName} buildResult={value.buildResult} />
                </div>;
            };

            const renderPublishName = ({ buildParams = [] }) => {
                if (buildParams) {
                    const param = buildParams.find(param => param.name === "overridePublishName");
                    if (param)
                        return param.value;
                }
                return;
            };

            const columns = [
	    {
                title: 'Select',
                dataIndex: 'select',
                key: 'select',
                render: (value, record) => {
                    return <Popconfirm>
                        <Checkbox checked={value}></Checkbox>
                    </Popconfirm>
                }
            }, {
                title: 'Build',
                dataIndex: 'build',
                key: 'buildName',
                render: renderBuildResults,
            }, {
                title: 'Vendor',
                dataIndex: 'vendor',
                key: 'vendorName',
            }, {
                title: 'JDK Implementation',
                dataIndex: 'impl',
                key: 'impl',
            }, {
                title: 'Platforms',
                dataIndex: 'platform',
                key: 'platform',
            }, {
                title: 'JDK Version',
                dataIndex: 'version',
                key: 'version',
                sorter: (a, b) => {
                    return a.version.localeCompare(b.version);
                }
            }, {
                title: 'Start Date',
                dataIndex: 'date',
                key: 'date',
                sorter: (a, b) => {
                    return a.date.localeCompare(b.date);
                }
            },  {
                title: 'Duration',
                dataIndex: 'time',
                key: 'time',
                sorter: (a, b) => {
                    return a.time.localeCompare(b.time);
                }
            }
            ];

            return <Table
                columns={columns}
                dataSource={buildInfo}
                title={() => <div><b>{buildName}</b> in server {url}</div>}
                pagination={{ pageSize, onChange: this.onChange }}
            />;
        } else {
            return null;
        }
    }
}
