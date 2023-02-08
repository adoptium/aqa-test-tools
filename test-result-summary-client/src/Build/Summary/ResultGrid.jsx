import React, { Component, Fragment } from 'react';
import { params } from '../../utils/query';

import {
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    MinusCircleOutlined,
    StopOutlined,
    WarningOutlined,
    InfoCircleOutlined,
} from '@ant-design/icons';

import { Tooltip } from 'antd';
import { Link } from 'react-router-dom';

import './ResultGrid.css';

class Cell extends Component {
    render() {
        const { data = {}, hcvalues } = this.props;
        const { hclevels, hcgroups } = hcvalues;

        const buildGroupMap = {
            'sanity.build': 'JDK Build',
            'extended.build': 'Smoke Test',
            'special.build': 'TBD',
        };
        return (
            <div className="nested-wrapper padding">
                {hclevels.map((level, y) => {
                    const groups = data[level];
                    return (
                        <Fragment key={y}>
                            {hcgroups.sort().map((group, x) => {
                                let target = level + '.' + group;
                                let targetValue = target;
                                targetValue = buildGroupMap[target] ?? target;
                                if (!(groups && groups[group])) {
                                    return (
                                        <div
                                            className="cell"
                                            style={{
                                                gridColumn: x + 1,
                                                gridRow: y + 1,
                                            }}
                                            key={x}
                                        >
                                            <Tooltip title={targetValue}>
                                                <StopOutlined />
                                            </Tooltip>
                                        </div>
                                    );
                                }
                                const result = groups[group].buildResult;
                                const rerunBuildUrl =
                                    groups[group].rerunBuildUrl;
                                let element = '';
                                if (!groups[group].testSummary) {
                                    element = (
                                        <div>
                                            {targetValue} <br />
                                            Build Result: {result} <br />
                                            Result Summary: N/A <br />
                                            <a
                                                href={groups[group].buildUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Jenkins Link
                                            </a>
                                        </div>
                                    );
                                } else {
                                    element = (
                                        <div>
                                            Test Target: {targetValue} <br />
                                            Build Result: {result} <br />
                                            Result Summary:{' '}
                                            {Object.keys(
                                                groups[group].testSummary
                                            ).map((key) => {
                                                return (
                                                    <div key={key}>
                                                        {key}:{' '}
                                                        {
                                                            groups[group]
                                                                .testSummary[
                                                                key
                                                            ]
                                                        }
                                                    </div>
                                                );
                                            })}
                                            {group === 'perf'
                                                ? 'Build Result is from TestBenchmarkParser (not CI build)'
                                                : ''}{' '}
                                            <br />
                                            Jenkins link:
                                            <br />
                                            {rerunBuildUrl ? (
                                                <a
                                                    href={rerunBuildUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    Rerun build
                                                </a>
                                            ) : (
                                                ''
                                            )}
                                            <br />
                                            <a
                                                href={groups[group].buildUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Test build
                                            </a>
                                        </div>
                                    );
                                }
                                let icon = '';
                                if (result === 'SUCCESS') {
                                    icon = (
                                        <CheckCircleOutlined
                                            style={{ color: 'white' }}
                                        />
                                    );
                                } else if (result === 'UNSTABLE') {
                                    icon = (
                                        <WarningOutlined
                                            style={{ color: 'white' }}
                                        />
                                    );
                                } else if (result === 'ABORTED') {
                                    icon = (
                                        <MinusCircleOutlined
                                            style={{ color: 'white' }}
                                        />
                                    );
                                } else {
                                    icon = (
                                        <ExclamationCircleOutlined
                                            style={{ color: 'white' }}
                                        />
                                    );
                                }

                                let linkInfo = (
                                    <Link
                                        to={{
                                            pathname: '/allTestsInfo',
                                            search: params({
                                                buildId: groups[group].buildId,
                                                limit: 5,
                                                hasChildren:
                                                    groups[group].hasChildren,
                                            }),
                                        }}
                                        target="_blank"
                                    >
                                        {icon}
                                    </Link>
                                );
                                if (target === 'sanity.build') {
                                    linkInfo = (
                                        <Link
                                            to={{
                                                pathname: '/output/build',
                                                search: params({
                                                    id: groups[group].buildId,
                                                }),
                                            }}
                                            target="_blank"
                                        >
                                            {icon}
                                        </Link>
                                    );
                                }
                                return (
                                    <div
                                        className={`cell ${result}`}
                                        style={{
                                            gridColumn: x + 1,
                                            gridRow: y + 1,
                                        }}
                                        key={x}
                                    >
                                        <Tooltip title={<div>{element}</div>}>
                                            {linkInfo}
                                        </Tooltip>
                                        {rerunBuildUrl && (
                                            <InfoCircleOutlined
                                                style={{
                                                    position: 'absolute',
                                                    color: 'orange',
                                                    fontSize: '12px',
                                                    top: -5,
                                                    right: -5,
                                                    background: 'white',
                                                    borderRadius: '100%',
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </Fragment>
                    );
                })}
            </div>
        );
    }
}
class Block extends Component {
    render() {
        const { data = {}, selectedJdkImpls, hcvalues } = this.props;

        return (
            <div className="nested-wrapper">
                {selectedJdkImpls.map((jdkImpl, x) => {
                    return (
                        <Fragment key={x}>
                            <div
                                className="box jdk-impl"
                                style={{ gridColumn: x + 1, gridRow: 1 }}
                            >
                                {jdkImpl}
                            </div>
                            <div style={{ gridColumn: x + 1, gridRow: 2 }}>
                                <Cell
                                    data={data[jdkImpl]}
                                    hcvalues={hcvalues}
                                />
                            </div>
                        </Fragment>
                    );
                })}
            </div>
        );
    }
}

export default class ResultGrid extends Component {
    render() {
        const {
            buildMap,
            selectedPlatforms,
            selectedJdkVersions,
            selectedJdkImpls,
            hcvalues,
        } = this.props;

        if (buildMap) {
            return (
                <div className="wrapper">
                    {selectedPlatforms.map((platform, y) => {
                        const jdkVersions = buildMap[platform];
                        return (
                            <Fragment key={y}>
                                {selectedJdkVersions.map((version, x) => {
                                    return (
                                        <Fragment key={x}>
                                            <div
                                                className="box jdk-version-header"
                                                style={{
                                                    gridColumn: x + 2,
                                                    gridRow: 1,
                                                }}
                                            >
                                                JDK {version}
                                            </div>
                                            <div
                                                style={{
                                                    gridColumn: x + 2,
                                                    gridRow: y + 2,
                                                }}
                                            >
                                                <Block
                                                    data={jdkVersions[version]}
                                                    selectedJdkImpls={
                                                        selectedJdkImpls
                                                    }
                                                    hcvalues={hcvalues}
                                                />
                                            </div>
                                        </Fragment>
                                    );
                                })}
                                <div
                                    className="box platform-header"
                                    style={{ gridColumn: 1, gridRow: y + 2 }}
                                >
                                    {platform}
                                </div>
                            </Fragment>
                        );
                    })}
                </div>
            );
        } else {
            return null;
        }
    }
}
