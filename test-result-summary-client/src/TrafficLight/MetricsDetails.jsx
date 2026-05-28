import React, { useState, useEffect } from 'react';
import { Divider, Button, message, Card, Statistic } from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import MetricsTable from './MetricsTable';
import { getParams } from '../utils/query';

function MetricsDetails() {
    const { testId, baselineId, benchmarkName } = getParams(location.search);

    // State to track data from both tables
    const [testData, setTestData] = useState(null);
    const [baselineData, setBaselineData] = useState(null);
    const [testStats, setTestStats] = useState(null);
    const [baselineStats, setBaselineStats] = useState(null);
    const [saving, setSaving] = useState(false);
    const [percentage, setPercentage] = useState(null);
    const [higherbetter, setHigherbetter] = useState(true);

    // Save handler for both tables
    const handleSave = async () => {
        if (!testData || !baselineData || !testStats || !baselineStats) {
            message.warning('Please wait for data to load');
            return;
        }

        setSaving(true);

        try {
            // Calculate which iterations are disabled for TEST
            const testDisabledIterations = testData
                .filter((item) => !item.enabled)
                .map((item) => item.iteration);

            // Calculate which iterations are disabled for BASELINE
            const baselineDisabledIterations = baselineData
                .filter((item) => !item.enabled)
                .map((item) => item.iteration);

            // One API call saves both TEST and BASELINE stats together
            const response = await fetch('/api/updateStats', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    testId,
                    baselineId,
                    benchmarkName,
                    testStats,
                    baselineStats,
                    testDisabledIterations,
                    baselineDisabledIterations,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                message.success(
                    '✓ Both TEST and BASELINE statistics saved successfully!'
                );
            } else {
                message.error(
                    'Failed to save: ' + (result.error || 'Unknown error')
                );
            }
        } catch (error) {
            message.error('Error saving: ' + error.message);
            console.error('Save error:', error);
        } finally {
            setSaving(false);
        }
    };

    // Calculate percentage score whenever stats change (real-time recalculation)
    useEffect(() => {
        if (testStats && baselineStats) {
            const testScore = Number(testStats.mean);
            const baselineScore = Number(baselineStats.mean);

            let calculatedPercentage = null;
            if (higherbetter) {
                calculatedPercentage = Number(
                    (testScore * 100) / baselineScore
                ).toFixed(2);
            } else {
                calculatedPercentage = Number(
                    (baselineScore * 100) / testScore
                ).toFixed(2);
            }

            setPercentage(calculatedPercentage);
        } else {
            setPercentage(null);
        }
    }, [testStats, baselineStats, higherbetter]);

    // Determine icon and color based on percentage
    const getScoreDisplay = () => {
        if (percentage === null)
            return { icon: null, color: '#999', status: 'N/A' };

        const score = Number(percentage);
        if (score > 98) {
            return {
                icon: <CheckCircleOutlined />,
                color: 'rgb(44, 190, 78)',
                status: 'No Regression',
            };
        } else if (score > 90) {
            return {
                icon: <WarningOutlined />,
                color: 'rgb(218, 165, 32)',
                status: 'Possible Regression',
            };
        } else {
            return {
                icon: <CloseCircleOutlined />,
                color: 'rgb(255, 85, 0)',
                status: 'Regression',
            };
        }
    };

    const scoreDisplay = getScoreDisplay();

    return (
        <div>
            {/* Header with Save Button and Percentage Score */}
            <div
                style={{
                    marginBottom: 16,
                    padding: 16,
                    background: '#f5f5f5',
                    borderRadius: 8,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 16,
                    }}
                >
                    <div>
                        <div
                            style={{
                                margin: 0,
                                fontSize: 20,
                                fontWeight: 'bold',
                            }}
                        >
                            Metrics Details - {benchmarkName}
                        </div>
                        <div
                            style={{
                                margin: 0,
                                fontSize: 12,
                                color: 'rgba(0, 0, 0, 1)',
                            }}
                        >
                            Annotate bad runs for both test and baseline, then
                            SAVE
                        </div>
                    </div>
                    <Button
                        type="primary"
                        size="large"
                        onClick={handleSave}
                        loading={saving}
                        disabled={!testStats || !baselineStats}
                    >
                        Save Both Statistics
                    </Button>
                </div>

                {/* Percentage Score Display - Updates in Real-Time */}
                {percentage !== null && (
                    <Card
                        style={{
                            background: 'white',
                            borderLeft: `4px solid ${scoreDisplay.color}`,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 20,
                            }}
                        >
                            <Statistic
                                title="Benchmark Performance Score"
                                value={percentage}
                                suffix="%"
                                valueStyle={{
                                    color: scoreDisplay.color,
                                    fontSize: 32,
                                    fontWeight: 'bold',
                                }}
                                prefix={scoreDisplay.icon}
                            />
                            <div style={{ textAlign: 'right' }}>
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 'bold',
                                        color: scoreDisplay.color,
                                    }}
                                >
                                    {scoreDisplay.status}
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: '#666',
                                        marginTop: 4,
                                    }}
                                >
                                    Test Mean: {testStats?.mean || 'N/A'} | Test
                                    CI: {testStats?.CI || 'N/A'}%
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: '#666',
                                        marginTop: 2,
                                    }}
                                >
                                    Baseline Mean:{' '}
                                    {baselineStats?.mean || 'N/A'} | Baseline
                                    CI: {baselineStats?.CI || 'N/A'}%
                                </div>
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            <MetricsTable
                type="test"
                id={testId}
                benchmarkName={benchmarkName}
                onDataChange={setTestData}
                onStatsChange={setTestStats}
            />
            <Divider />
            <MetricsTable
                type="baseline"
                id={baselineId}
                benchmarkName={benchmarkName}
                onDataChange={setBaselineData}
                onStatsChange={setBaselineStats}
            />
        </div>
    );
}

export default MetricsDetails;
