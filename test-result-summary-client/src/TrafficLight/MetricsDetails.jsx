import React, { useState } from 'react';
import { Divider, Button, message } from 'antd';
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
                .filter(item => !item.enabled)
                .map(item => item.iteration);
            
            // Calculate which iterations are disabled for BASELINE
            const baselineDisabledIterations = baselineData
                .filter(item => !item.enabled)
                .map(item => item.iteration);

            console.log('Saving BOTH test and baseline:', {
                testDisabledIterations,
                baselineDisabledIterations,
                testStats,
                baselineStats
            });

            // One API call saves both TEST and BASELINE stats together
            const response = await fetch('/api/updateStats', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({
                    testId,
                    baselineId,
                    benchmarkName,
                    testStats,
                    baselineStats,
                    testDisabledIterations,
                    baselineDisabledIterations,
                })
            });

            const result = await response.json();
            
            if (result.success) {
                message.success('✓ Both TEST and BASELINE statistics saved successfully!');
            } else {
                message.error('Failed to save: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            message.error('Error saving: ' + error.message);
            console.error('Save error:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            {/* One Save Button for bothH tables */}
            <div style={{ 
                marginBottom: 16, 
                padding: 16,
                background: '#f5f5f5',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h3 style={{ margin: 0 }}>Metrics Details - {benchmarkName}</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#666' }}>
                        Annotate bad runs for both test and baseline, then save
                    </p>
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