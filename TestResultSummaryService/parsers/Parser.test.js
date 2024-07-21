const Parser = require('./Parser'); // Adjust the path if necessary

describe('Parser', () => {
    let parser;

    beforeEach(() => {
        parser = new Parser('TestBuild');
    });

    test('should extract Java version and build date for HotSpot implementation', () => {
        const hotspotOutput = `
16:38:54  =JAVA VERSION OUTPUT BEGIN=
16:38:54  openjdk version "21.0.4-beta" 2024-07-16
16:38:54  OpenJDK Runtime Environment Temurin-21.0.4+6-202406261902 (build 21.0.4-beta+6-ea)
16:38:54  OpenJDK 64-Bit Server VM Temurin-21.0.4+6-202406261902 (build 21.0.4-beta+6-ea, mixed mode, sharing)
16:38:54  =JAVA VERSION OUTPUT END=
        `;

        const result = parser.exactJavaVersion(hotspotOutput);
        expect(result.jdkDate).toBe('2024-06-26');
    });

    test('should extract Java version and build date for OpenJ9 implementation', () => {
        const openj9Output = `
11:53:15  =JAVA VERSION OUTPUT BEGIN=
11:53:19  openjdk version "11.0.24-internal" 2024-07-16
11:53:19  OpenJDK Runtime Environment (build 11.0.24-internal+0-adhoc.jenkins.BuildJDK11aarch64macPersonal)
11:53:19  Eclipse OpenJ9 VM (build master-2a2df9f1117, JRE 11 Mac OS X aarch64-64-Bit 20240627_514 (JIT enabled, AOT enabled)
11:53:19  OpenJ9   - 2a2df9f1117
11:53:19  OMR      - 47a9d248db0
11:53:19  JCL      - c535515f053 based on jdk-11.0.24+6)
11:53:19  =JAVA VERSION OUTPUT END=
        `;

        const result = parser.exactJavaVersion(openj9Output);
        expect(result.jdkDate).toBe('2024-06-27');
    });

    test('should extract Java version and build date for Java 8 implementation', () => {
        const java8Output = `
16:38:54  =JAVA VERSION OUTPUT BEGIN=
16:38:54  openjdk version "1.8.0_412"
16:38:54  OpenJDK Runtime Environment (Temurin)(build 1.8.0_412-b08)
16:38:54  OpenJDK 64-Bit Server VM (Temurin)(build 25.412-b08, mixed mode)
16:38:54  =JAVA VERSION OUTPUT END=
        `;

        const result = parser.exactJavaVersion(java8Output);
        expect(result.jdkDate).toBe('2024-06-27'); // Adjust the expected date based on your requirements
    });
});
