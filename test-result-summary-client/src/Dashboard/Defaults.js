export default {
    FVT: {
        widgets: [
            {
                type: 'BuildStatus',
                x: 0,
                y: 0,
                settings: {
                    serverSelected: 'InternalJenkins'
                }
            },
            {
                type: 'BuildStatus',
                x: 0,
                y: 1,
                settings: {
                    serverSelected: 'OpenJ9'
                }
            },
            {
                type: 'BuildStatus',
                x: 0,
                y: 2,
                settings: {
                    serverSelected: 'AdoptOpenJDK'
                }
            }
        ]
    },
    Perf: {
        widgets: [
            {
                type: 'DayTrader3',
                x: 0,
                y: 2
            },
            {
                type: 'ODM',
                x: 2,
                y: 1
            },
            {
                type: 'SPECjbb2015',
                x: 0,
                y: 6
            },
        ]
    }
}