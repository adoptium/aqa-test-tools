import React, { Component } from 'react';
import {
    CheckOutlined,
    CloseOutlined,
    InfoOutlined,
    LoadingOutlined,
    ApartmentOutlined,
} from '@ant-design/icons';
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
        const {
            id,
            parentBuildInfo,
            summary,
            childBuildsResult,
            sdkBuilds,
            javaVersion,
        } = this.props;

        const renderFvTestBuild = (value) => {
            if (value) {
                let icon = '';
                if (value == 'PROGRESSING') {
                    icon = (
                        <LoadingOutlined
                            style={{ fontSize: 16, color: '#DAA520' }}
                        />
                    );
                } else if (value === 'SUCCESS') {
                    icon = (
                        <CheckOutlined
                            style={{ fontSize: 16, color: '#2cbe4e' }}
                        />
                    );
                } else if (value === 'FAILURE') {
                    icon = (
                        <CloseOutlined
                            style={{ fontSize: 16, color: '#f50' }}
                        />
                    );
                } else {
                    icon = (
                        <InfoOutlined style={{ fontSize: 16, color: '#f50' }} />
                    );
                }
                return (
                    <div>
                        <Tooltip title="Build tree">
                            <Link
                                to={{
                                    pathname: '/buildTreeView',
                                    search: params({ parentId: id }),
                                }}
                            >
                                <ApartmentOutlined />
                            </Link>
                        </Tooltip>
                        <Link
                            to={{
                                pathname: '/buildDetail',
                                search: params({ parentId: id }),
                            }}
                            style={{
                                color:
                                    value === 'SUCCESS'
                                        ? '#2cbe4e'
                                        : value === 'FAILURE'
                                        ? '#f50'
                                        : '#DAA520',
                            }}
                        >
                            {' '}
                            Build #{parentBuildInfo.buildNum}{' '}
                            <Tooltip title={value}>{icon}</Tooltip>
                        </Link>
                        <br />
                    </div>
                );
            }
            return null;
        };

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

            const buildName = parentBuildInfo.buildName;

            let warningMsg = '';
            if (sdkBuilds && sdkBuilds.length === 0) {
                warningMsg = 'No JDK Builds got triggered in this pipeline. ';
            }
            if (summary && Object.keys(summary).length === 0) {
                warningMsg +=
                    'No AQA Test Builds got triggered in this pipeline. ';
            }
            return (
                <div>
                    <div className="overview-header">
                        <div>{renderFvTestBuild(childBuildsResult)}</div>{' '}
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
                        Build and AQA Test Results
                    </Divider>
                    <div style={{ fontSize: '18px' }}>
                        {warningMsg ? (
                            <div>
                                <b>Warning</b>: {warningMsg} Please check TRSS{' '}
                                <Link
                                    to={{
                                        pathname: '/buildDetail',
                                        search: params({ parentId: id }),
                                    }}
                                    target="_blank"
                                >
                                    build details
                                </Link>{' '}
                                or Jenkins{' '}
                                <a
                                    href={parentBuildInfo.buildUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {buildName} #{parentBuildInfo.buildNum}
                                </a>
                            </div>
                        ) : (
                            <div />
                        )}
                    </div>
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
