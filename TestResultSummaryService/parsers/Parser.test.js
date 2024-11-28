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
        expect(result).toBeNull();
    });

    test('should extract Java version and build date for Java 8u152-b01 implementation', () => {
        const java8u152Output = `
16:38:54  =JAVA VERSION OUTPUT BEGIN=
16:38:54  openjdk version "1.8.0_152"
16:38:54  OpenJDK Runtime Environment (AdoptOpenJDK)(build 1.8.0_152-b01)
16:38:54  OpenJDK 64-Bit Server VM (AdoptOpenJDK)(build 25.152-b01, mixed mode)
16:38:54  =JAVA VERSION OUTPUT END=
        `;

        const result = parser.exactJavaVersion(java8u152Output);
        expect(result).toBeNull();
    });

    test('should extract Java version and build date for Java 9.0.4+11 implementation', () => {
        const java904Output = `
16:38:54  =JAVA VERSION OUTPUT BEGIN=
16:38:54  openjdk version "9.0.4"
16:38:54  OpenJDK Runtime Environment (build 9.0.4+11)
16:38:54  OpenJDK 64-Bit Server VM (build 9.0.4+11, mixed mode)
16:38:54  =JAVA VERSION OUTPUT END=
        `;

        const result = parser.exactJavaVersion(java904Output);
        expect(result).toBeNull();
    });

    test('should extract Java version and build date for Java 10.0.2+13.1 implementation', () => {
        const java1002Output = `
16:38:54  =JAVA VERSION OUTPUT BEGIN=
16:38:54  openjdk version "10.0.2"
16:38:54  OpenJDK Runtime Environment (build 10.0.2+13.1)
16:38:54  OpenJDK 64-Bit Server VM (build 10.0.2+13.1, mixed mode)
16:38:54  =JAVA VERSION OUTPUT END=
        `;

        const result = parser.exactJavaVersion(java1002Output);
        expect(result).toBeNull();
    });

    test('should extract Java version and build date for Java 11.0.4+11.4 implementation', () => {
        const java1104Output = `
16:38:54  =JAVA VERSION OUTPUT BEGIN=
16:38:54  openjdk version "11.0.4"
16:38:54  OpenJDK Runtime Environment (build 11.0.4+11.4)
16:38:54  OpenJDK 64-Bit Server VM (build 11.0.4+11.4, mixed mode)
16:38:54  =JAVA VERSION OUTPUT END=
        `;

        const result = parser.exactJavaVersion(java1104Output);
        expect(result).toBeNull();
    });

    test('should extract Java version and build date for Java 13+33_openj9-0.16.0 implementation', () => {
        const java1333Output = `
16:38:54  =JAVA VERSION OUTPUT BEGIN=
16:38:54  openjdk version "13"
16:38:54  OpenJDK Runtime Environment (build 13+33)
16:38:54  Eclipse OpenJ9 VM (build 13+33_openj9-0.16.0, JRE 13 Mac OS X aarch64-64-Bit)
16:38:54  =JAVA VERSION OUTPUT END=
        `;

        const result = parser.exactJavaVersion(java1333Output);
        expect(result).toBeNull();
    });

    test('should return null if no Java version regex match', () => {
        const invalidOutput = `
16:38:54  Some invalid output that does not contain Java version information
        `;

        const result = parser.exactJavaVersion(invalidOutput);
        expect(result).toBeNull();
    });
});
