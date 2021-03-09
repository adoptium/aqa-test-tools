export default {
    Custom: {
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
        ]
    },
    Perf: {
        widgets: [
            {
                type: 'Dacapo',
                x: 0,
                y: 0,
                settings: {
                    serverSelected: 'AdoptOpenJDK',
                    buildSelected: 'dacapo-jdk8'
                }
            },
        ]
    }
}