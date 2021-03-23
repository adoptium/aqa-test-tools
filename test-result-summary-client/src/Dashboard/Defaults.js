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
                    buildSelected: 'Test_openjdk8_j9_sanity.perf_x86-64_linux'
                }
            },
        ]
    }
}