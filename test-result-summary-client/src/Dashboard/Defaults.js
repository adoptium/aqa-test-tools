export default {
    FVT: {
        widgets: [
            {
                type: 'BuildStatus',
                x: 0,
                y: 0,
                settings: {
                    serverSelected: 'AdoptOpenJDK',
                    title: "https://ci.adoptopenjdk.net/",
                }
            },
            {
                type: 'BuildStatus',
                x: 0,
                y: 1,
                settings: {
                    serverSelected: 'OpenJ9',
                    title: "https://ci.eclipse.org/openj9/",
                }
            },
            {
                type: 'BuildStatus',
                x: 0,
                y: 2,
                settings: {
                    serverSelected: 'CustomJenkins',
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