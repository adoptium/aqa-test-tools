const { TestResultsDB } = require('../Database');
const ObjectID = require('mongodb').ObjectID;

module.exports = async (req, res) => {
    const db = new TestResultsDB();
    
    const { 
        testId, 
        baselineId, 
        benchmarkName, 
        testStats, 
        baselineStats,
        testDisabledIterations,
        baselineDisabledIterations
    } = req.body;
    
    console.log('Received update request:', {
        testId,
        baselineId,
        benchmarkName,
        testDisabledIterations,
        baselineDisabledIterations
    });
    
    try {
        // Helper function to update a document
        const updateDocument = async (docId, stats, disabledIterations, buildType) => {
            // Find the document
            const doc = await db.findOne({ _id: new ObjectID(docId) });
            
            if (!doc) {
                console.error(`Document not found: ${docId}`);
                return { success: false, error: `Document ${docId} not found` };
            }
            
            if (!doc.aggregateInfo) {
                console.error(`No aggregateInfo in document: ${docId}`);
                return { success: false, error: `No aggregateInfo in document` };
            }
            
            // Find and update the matching aggregateInfo entry
            let updated = false;
            for (const key in doc.aggregateInfo) {
                const item = doc.aggregateInfo[key];
                if (item.benchmarkName === benchmarkName && 
                    item.buildName && 
                    item.buildName.includes(buildType)) {
                    
                    if (item.metrics) {
                        // Update each metric in this aggregateInfo
                        item.metrics = item.metrics.map(metric => {
                            return {
                                ...metric,
                                
                                // original rawValues
                                rawValues: metric.rawValues,
                                
                                //original statValues
                                statValues: metric.statValues,
                                
                                // new field - filteredStatValues
                                filteredStatValues: {
                                    mean: stats.mean,
                                    max: stats.max,
                                    min: stats.min,
                                    median: stats.median,
                                    std: stats.std,
                                    CI: stats.CI
                                },
                                
                                // disablediterations
                                disabledIterations: disabledIterations || []
                            };
                        });
                        
                        updated = true;
                    }
                }
            }
            
            if (!updated) {
                console.error(`Benchmark ${benchmarkName} with type ${buildType} not found`);
                return { success: false, error: `Benchmark not found` };
            }
            
            // Update the document in database
            await db.update(
                { _id: new ObjectID(docId) },
                { $set: { aggregateInfo: doc.aggregateInfo } }
            );
            
            console.log(`Successfully updated document: ${docId}`);
            return { success: true };
        };
        
        // Update test document
        const testResult = await updateDocument(
            testId, 
            testStats, 
            testDisabledIterations, 
            'test'
        );
        
        if (!testResult.success) {
            return res.status(400).json(testResult);
        }
        
        // Update baseline document
        const baselineResult = await updateDocument(
            baselineId, 
            baselineStats, 
            baselineDisabledIterations, 
            'baseline'
        );
        
        if (!baselineResult.success) {
            return res.status(400).json(baselineResult);
        }
        
        res.json({ 
            success: true,
            message: 'Statistics updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating stats:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};