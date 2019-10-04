import React, { Component } from 'react';
import { params, getParams } from '../utils/query';
import { Icon, Tooltip } from 'antd';
import { Link } from 'react-router-dom';
import Checkboxes from './Checkboxes';
import './ResultGrid.css';

const hcjdkImpls = ["j9", "hs", "Upstream"];
const hclevels = ["sanity", "extended", "special"];
const hcgroups = ["functional", "openjdk", "system", "external", "perf"];

class Cell extends Component {
    render() {
        const { data = {} } = this.props;
        return <div className="nested-wrapper padding">
            {hclevels.map((level, y) => {
                const groups = data[level];
                return <>
                    {hcgroups.map((group, x) => {
                        let target = level + "." + group;
                        if (!(groups && groups[group])) {
                            return <div className="cell" style={{ gridColumn: x + 1, gridRow: y + 1 }}>
                                <Tooltip title={target}><Icon type="stop" /></Tooltip>
                            </div>
                        }
                        const result = groups[group].buildResult;
                        let element = "";
                        if (!groups[group].testSummary) {
                            element = (
                                <div>
                                    {target} <br />
                                    Build Result: {result} <br />
                                    Result Summary: N/A <br />
                                    <a href={groups[group].buildUrl} target="_blank" rel="noopener noreferrer">Jenkins Link</a>
                                </div>
                            );
                        } else {
                            element = (
                                <div>
                                    Test Target: {target} <br />
                                    Build Result: {result} <br />
                                    Result Summary: {Object.keys(groups[group].testSummary).map((key) => {
                                        return <div>{key}: {groups[group].testSummary[key]}</div>;
                                    })}
                                    <a href={groups[group].buildUrl} target="_blank" rel="noopener noreferrer">Jenkins Link</a>
                                </div>
                            );
                        }
                        let icon = "";
                        if (result === "SUCCESS") {
                            icon = <Icon type="check-circle" style={{ color: "white" }} />;
                        } else if (result === "UNSTABLE") {
                            icon = <Icon type="warning" style={{ color: "white" }} />;
                        } else if (result === "ABORT") {
                            icon = <Icon type="minus-circle" style={{ color: "white" }} />;
                        } else {
                            icon = <Icon type="exclamation-circle" style={{ color: "white" }} />;
                        }
                        let linkInfo = "";
                        if (groups[group].hasChildren) {
                            linkInfo = <Link to={{ pathname: '/buildDetail', search: params({ parentId: groups[group].buildId }) }}>{icon}</Link>
                        } else {
                            linkInfo = <Link to={{ pathname: '/allTestsInfo', search: params({ buildId: groups[group].buildId, limit: 5 }) }}>{icon}</Link>;
                        }
                        return <div className={`cell ${result}`} style={{ gridColumn: x + 1, gridRow: y + 1 }}>
                            <Tooltip title={<div>{element}</div>}>
                                {linkInfo}
                            </Tooltip>
                        </div>
                    })}
                </>;
            })}
        </div>;
    }
}
class Block extends Component {
    render() {
        const { data = {}, selectedJdkImpls } = this.props;

        return <div className="nested-wrapper">
            {selectedJdkImpls.map((jdkImpl, x) => {
                return <>
                    <div className="box jdk-impl" style={{ gridColumn: x + 1, gridRow: 1 }}>{jdkImpl}</div>
                    <div style={{ gridColumn: x + 1, gridRow: 2 }}><Cell data={data[jdkImpl]} /></div>
                </>
            })}
        </div>;

    }
}

export default class ResultGrid extends Component {
    state = {
        selectedPlatforms: [],
        allPlatforms: [],
        selectedJdkVersions: [],
        allJdkVersions: [],
        selectedJdkImpls: [],
        allJdkImpls: [],
    };
    async componentDidMount() {
        await this.updateData();
    }

    async updateData() {
        const { parentId } = getParams(this.props.location.search);
        let fetchBuild = {};
        const buildNameRegex = "^Test_openjdk.*";
        const testSummaryResult = undefined;
        const buildResult = undefined;

        fetchBuild = await fetch(`/api/getAllChildBuilds${params({ buildResult, testSummaryResult, buildNameRegex, parentId })}`, {
            method: 'get'
        });

        const builds = await fetchBuild.json();
        const regex = /^Test_openjdk(\d+)_(\w+)_(\w+).(.+?)_(.+?)(_(Nightly|Personal))?$/;
        const buildMap = {};
        let jdkVersionOpts = [];
        builds.map((build, i) => {
            const tokens = build.buildName.match(regex);
            if (tokens.length > 5) {
                let [_, jdkVersion, jdkImpl, level, group, platform] = tokens;

                buildMap[platform] = buildMap[platform] || {};
                buildMap[platform][jdkVersion] = buildMap[platform][jdkVersion] || {};
                buildMap[platform][jdkVersion][jdkImpl] = buildMap[platform][jdkVersion][jdkImpl] || {};
                buildMap[platform][jdkVersion][jdkImpl][level] = buildMap[platform][jdkVersion][jdkImpl][level] || {};
                buildMap[platform][jdkVersion][jdkImpl][level][group] = buildMap[platform][jdkVersion][jdkImpl][level][group] || {};

                jdkVersionOpts.push(jdkVersion);

                // If there are multiple builds for one key, then this is a parallel build
                // For parallel build, we only store the parent build info
                if (Object.keys(buildMap[platform][jdkVersion][jdkImpl][level][group]).length !== 0) {
                    if (build.hasChildren) {
                        buildMap[platform][jdkVersion][jdkImpl][level][group] = {
                            buildResult: build.buildResult,
                            testSummary: build.testSummary,
                            buildUrl: build.buildUrl,
                            buildId: build._id,
                            hasChildren: build.hasChildren
                        };
                    }
                } else {
                    buildMap[platform][jdkVersion][jdkImpl][level][group] = {
                        buildResult: build.buildResult,
                        testSummary: build.testSummary,
                        buildUrl: build.buildUrl,
                        buildId: build._id,
                        hasChildren: build.hasChildren
                    };
                }
            }
        });
        const platformOpts = Object.keys(buildMap).sort();
        jdkVersionOpts = [...new Set(jdkVersionOpts)].sort((a, b) => { return a - b });
        const jdkImplOpts = hcjdkImpls;
        this.setState({
            buildMap,
            selectedPlatforms: platformOpts,
            allPlatforms: platformOpts,
            selectedJdkVersions: jdkVersionOpts,
            allJdkVersions: jdkVersionOpts,
            selectedJdkImpls: jdkImplOpts,
            allJdkImpls: jdkImplOpts
        });
    }

    render() {
        const { buildMap, selectedPlatforms, allPlatforms, selectedJdkVersions, allJdkVersions, selectedJdkImpls, allJdkImpls } = this.state;

        if (buildMap) {
            return <div>
                <Checkboxes name="Platforms" onChange={selectedPlatforms => this.setState({ selectedPlatforms })} value={selectedPlatforms} options={allPlatforms} />
                <Checkboxes name="JDK Versions" onChange={selectedJdkVersions => this.setState({ selectedJdkVersions })} value={selectedJdkVersions} options={allJdkVersions} />
                <Checkboxes name="JDK Impls" onChange={selectedJdkImpls => this.setState({ selectedJdkImpls })} value={selectedJdkImpls} options={allJdkImpls} />

                <div className="wrapper">
                    {selectedPlatforms.map((platform, y) => {
                        const jdkVersions = buildMap[platform];
                        return <>
                            {selectedJdkVersions.map((version, x) => {
                                return <>
                                    <div className="box jdk-version-header" style={{ gridColumn: x + 2, gridRow: 1 }}>JDK {version}</div>
                                    <div style={{ gridColumn: x + 2, gridRow: y + 2 }}><Block data={jdkVersions[version]} selectedJdkImpls={selectedJdkImpls} /></div>
                                </>
                            })}
                            <div className="box platform-header" style={{ gridColumn: 1, gridRow: y + 2 }}>{platform}</div>
                        </>
                    })}
                </div>
            </div>;
        } else {
            return null;
        }
    }
}
