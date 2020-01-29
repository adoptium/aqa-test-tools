import React, { Component ,Fragment} from 'react';
import { params } from '../../utils/query';
import { Icon, Tooltip } from 'antd';
import { Link } from 'react-router-dom';

import './ResultGrid.css';

class Cell extends Component {
    render() {
        const { data = {}, hcvalues } = this.props;
        const { hclevels, hcgroups } = hcvalues;
        return <div className="nested-wrapper padding">
            {hclevels.map((level, y) => {
                const groups = data[level];
                return <Fragment key={y}>
                    {hcgroups.map((group, x) => {
                        let target = level + "." + group;
                        if (!(groups && groups[group])) {
                            return <div className="cell" style={{ gridColumn: x + 1, gridRow: y + 1 }} key={x}>
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
                                        return <div key={key}>{key}: {groups[group].testSummary[key]}</div>;
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
                        return <div className={`cell ${result}`} style={{ gridColumn: x + 1, gridRow: y + 1 }} key={x}>
                            <Tooltip title={<div>{element}</div>}>
                                {linkInfo}
                            </Tooltip>
                        </div>
                    })}
                </Fragment>;
            })}
        </div>;
    }
}
class Block extends Component {
    render() {
        const { data = {}, selectedJdkImpls, hcvalues } = this.props;

        return <div className="nested-wrapper" >
            {selectedJdkImpls.map((jdkImpl, x) => {
                return <Fragment key={x}>
                    <div className="box jdk-impl" style={{ gridColumn: x + 1, gridRow: 1 }} >{jdkImpl}</div>
                    <div style={{ gridColumn: x + 1, gridRow: 2 }}><Cell data={data[jdkImpl]} hcvalues={hcvalues} /></div>
                </Fragment>
            })}
        </div>;
    }
}

export default class ResultGrid extends Component {
    render() {
        const { buildMap, selectedPlatforms, selectedJdkVersions, selectedJdkImpls, hcvalues } = this.props;

        if (buildMap) {
            return <div className="wrapper">
                {selectedPlatforms.map((platform, y) => {
                    const jdkVersions = buildMap[platform];
                    return <Fragment key={y}>
                        {selectedJdkVersions.map((version, x) => {
                            return <Fragment key={x}>
                                <div className="box jdk-version-header" style={{ gridColumn: x + 2, gridRow: 1 }} >JDK {version}</div>
                                <div style={{ gridColumn: x + 2, gridRow: y + 2 }} ><Block data={jdkVersions[version]} selectedJdkImpls={selectedJdkImpls} hcvalues={hcvalues} /></div>
                            </Fragment>
                        })}
                        <div className="box platform-header" style={{ gridColumn: 1, gridRow: y + 2 }}>{platform}</div>
                    </Fragment>
                })}
            </div>;
        } else {
            return null;
        }
    }
}
