import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { Button, Divider, Row, Col, Tooltip } from 'antd';
import { params } from '../../utils/query';
import moment from 'moment';
import BuildLink from '../BuildLink';
import renderDuration from '../Duration';
import './Overview.css';

const DAY_FORMAT = 'MMM DD YYYY, hh:mm a';

export default class Overview extends Component {
    render() {
        const { id, parentBuildInfo, summary, failedSdkBuilds, javaVersion } =
            this.props;
        if (id && parentBuildInfo) {
            const {
                passed = 0,
                failed = 0,
                disabled = 0,
                skipped = 0,
                executed = 0,
                total = 0,
            } = summary;
            const passPercentage =
                (parseInt(passed) / parseInt(executed)) * 100;
            const buildResult = parentBuildInfo.buildResult;
            const buildName = parentBuildInfo.buildName;

            return (
                <div>
                    <div className="overview-header">
                        <a
                            href={parentBuildInfo.buildUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {buildName} #{parentBuildInfo.buildNum}
                        </a>{' '}
                        Test Summary
                    </div>
                    <Link
                        to={{
                            pathname: '/releaseSummary',
                            search: params({ parentId: id, buildName }),
                        }}
                    >
                        <div className="overview-report-link">
                            <Button type="primary">
                                Release Summary Report
                            </Button>
                        </div>
                    </Link>
                    <Divider style={{ fontSize: '20px' }}>
                        SDK Build Results
                    </Divider>
                    <div style={{ fontSize: '18px' }}>
                        {failedSdkBuilds && failedSdkBuilds.length ? (
                            <BuildLink
                                id={id}
                                label="SDK Builds and Smoke Tests "
                                link="Failed"
                                buildNameRegex="^(jdk[0-9]{1,2}|Build_)"
                                buildResult="!SUCCESS"
                            />
                        ) : (
                            <div>SDK builds and Smoke Tests Passed</div>
                        )}
                    </div>

                    <Divider style={{ fontSize: '20px' }}>
                        AQA Test Results
                    </Divider>
                    <div style={{ fontSize: '18px' }}>
                        <Row>
                            <Col span={6}>
                                <Divider>Test Summary</Divider>
                            </Col>
                            <Col span={6}>
                                <Divider>Pass Percentage</Divider>
                            </Col>
                            <Col span={6}>
                                <Divider>Build Result</Divider>
                            </Col>
                            <Col span={6}>
                                <Divider>Build Metadata</Divider>
                            </Col>
                        </Row>
                        <Row>
                            <Col span={6}>
                                <BuildLink
                                    id={id}
                                    label="Executed: "
                                    link={executed}
                                    testSummaryResult="executed"
                                    buildNameRegex="^Test.*"
                                />
                                <br />
                                <BuildLink
                                    id={id}
                                    label="Failed: "
                                    link={failed}
                                    testSummaryResult="failed"
                                    buildNameRegex="^Test.*"
                                />
                                <br />
                                <BuildLink
                                    id={id}
                                    label="Passed: "
                                    link={passed}
                                    testSummaryResult="passed"
                                    buildNameRegex="^Test.*"
                                />
                                <br />
                                <BuildLink
                                    id={id}
                                    label="Disabled: "
                                    link={disabled}
                                    testSummaryResult="disabled"
                                    buildNameRegex="^Test.*"
                                />
                                <br />
                                <BuildLink
                                    id={id}
                                    label="Skipped: "
                                    link={skipped}
                                    testSummaryResult="skipped"
                                    buildNameRegex="^Test.*"
                                />
                                <br />
                                <BuildLink
                                    id={id}
                                    label="Total: "
                                    link={total}
                                    testSummaryResult="total"
                                    buildNameRegex="^Test.*"
                                />
                                <br />
                            </Col>
                            <Col span={6}>
                                <div>
                                    <Tooltip title="Pass % = (Passed/Executed) * 100">
                                        <span style={{ fontSize: '38px' }}>
                                            {passPercentage
                                                ? passPercentage.toFixed(2) +
                                                  '%'
                                                : 'N/A'}
                                        </span>
                                    </Tooltip>
                                </div>
                            </Col>

                            <Col span={6}>
                                <div>
                                    <strong>Build Started at:</strong>{' '}
                                    {moment(parentBuildInfo.timestamp).format(
                                        DAY_FORMAT
                                    )}
                                </div>
                                <div>
                                    <strong>Build Started by:</strong>{' '}
                                    {parentBuildInfo.startBy}
                                </div>
                                <div>
                                    <strong>Build Duration:</strong>{' '}
                                    {renderDuration(
                                        parentBuildInfo.buildDuration
                                    )}
                                </div>
                                <div>
                                    <strong>Machine:</strong>{' '}
                                    {parentBuildInfo.machine}
                                </div>
                            </Col>

                            <Col span={6}>
                                <div>
                                    <strong>java -version:</strong>{' '}
                                    {javaVersion}
                                </div>
                            </Col>
                        </Row>
                    </div>
                </div>
            );
        }
        return null;
    }
}
