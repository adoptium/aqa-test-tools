export default {
    FVT: {
        widgets: [
            {
                type: 'BuildStatus',
                x: 0,
                y: 0,
                settings: {
                    serverSelected: 'AdoptOpenJDK',
                    title: "https://ci.adoptopenjdk.net",
                }
            },
            {
                type: 'BuildStatus',
                x: 0,
                y: 1,
                settings: {
                    serverSelected: 'CustomJenkins',
                }
            }
        ]
    },
    Perf: {
        widgets: [
            {
                type: 'DayTrader7',
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
            }
        ]
    }
}