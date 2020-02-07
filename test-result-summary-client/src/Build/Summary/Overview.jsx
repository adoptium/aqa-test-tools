import React, { Component } from 'react';
import { Divider, Row, Col, Tooltip } from 'antd';
import moment from 'moment';
import BuildLink from '../BuildLink';
import renderDuration from '../Duration';

const DAY_FORMAT = 'MMM DD YYYY, hh:mm a';

export default class Overview extends Component {
    render() {
        const { id, parentBuildInfo, summary } = this.props;
        if (id && parentBuildInfo) {
            const { passed = 0, failed = 0, disabled = 0, skipped = 0, executed = 0, total = 0 } = summary;
            const passPercentage = (parseInt(passed) / parseInt(executed)) * 100;
            const buildResult = parentBuildInfo.buildResult;
            return <div>
                <div style={{ textAlign: "center", fontSize: "28px" }}><a href={parentBuildInfo.buildUrl} target="_blank" rel="noopener noreferrer">{parentBuildInfo.buildName} #{parentBuildInfo.buildNum}</a> Test Summary</div>
                <Divider />
                <div style={{ fontSize: "18px" }}>
                    <Row>
                        <Col span={6}>
                            <BuildLink id={id} label="Executed: " link={executed} testSummaryResult="executed" buildNameRegex="^Test.*" /><br />
                            <BuildLink id={id} label="Failed: " link={failed} testSummaryResult="failed" buildNameRegex="^Test.*" /><br />
                            <BuildLink id={id} label="Passed: " link={passed} testSummaryResult="passed" buildNameRegex="^Test.*" /><br />
                            <BuildLink id={id} label="Disabled: " link={disabled} testSummaryResult="disabled" buildNameRegex="^Test.*" /><br />
                            <BuildLink id={id} label="Skipped: " link={skipped} testSummaryResult="skipped" buildNameRegex="^Test.*" /><br />
                            <BuildLink id={id} label="Total: " link={total} testSummaryResult="total" buildNameRegex="^Test.*" /><br />
                        </Col>
                        <Col span={6}>
                            <div>
                                <Tooltip title="Pass % = (Passed/Executed) * 100"><span style={{ fontSize: "38px" }}>{passPercentage ? passPercentage.toFixed(2) + "%" : "N/A"}</span></Tooltip>
                            </div>
                        </Col>
                        <Col span={6}>
                            <div style={{ fontSize: "38px", color: buildResult === "SUCCESS" ? "#2cbe4e" : (buildResult === "FAILURE" ? "#f50" : "#DAA520") }}>{buildResult}</div>
                        </Col>
                        <Col span={6}>
                            <div>Build Started at: {moment(parentBuildInfo.timestamp).format(DAY_FORMAT)}</div>
                            <div>Build Started by: {parentBuildInfo.startBy}</div>
                            <div>Build Duration: {renderDuration(parentBuildInfo.buildDuration)}</div>
                            <div>Machine: {parentBuildInfo.machine}</div>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={6} />
                        <Col span={6}>
                            <div>Pass Percentage</div>
                        </Col>
                        <Col span={6}>
                            <div>Build Result</div>
                        </Col>
                    </Row>
                </div>
            </div>;
        }
        return null;
    }
}