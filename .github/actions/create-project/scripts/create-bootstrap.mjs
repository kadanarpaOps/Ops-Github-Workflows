import fs from "node:fs";
import path from "node:path";
import { XMLBuilder } from "fast-xml-parser";

const ROOT_POM = process.argv[2] ?? "pom.xml";
const GROUP_ID = process.argv[3] ?? "com.example";
const ARTIFACT_ID = process.argv[4] ?? "demo";
const JAVA_VERSION = process.argv[5] ?? "17";

const builder = new XMLBuilder({
    ignoreAttributes: false,

    format: true,
    indentBy: "    ",

    suppressEmptyNode: true,

    suppressBooleanAttributes: false,

    declaration: {
        encoding: "UTF-8",
    },
});

/*
 * ============================================================
 * Init Bootstrap Main Module
 * ============================================================
 * Starts building the bootstrap module
 */
const bootstrapPom = {
    project: {
        "@_xmlns": "http://maven.apache.org/POM/4.0.0",
        "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "@_xsi:schemaLocation": "http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd",
        modelVersion: "4.0.0",
        project: {
            groupId: GROUP_ID,
            artifactId: ARTIFACT_ID,
            version: "0.1.0-SNAPSHOT"
        },
        properties: {
            "maven.compiler.source": JAVA_VERSION,
            "maven.compiler.target": JAVA_VERSION,
            "project.build.sourceEncoding": "UTF-8"
        },
        dependencies: {},
        build: {
            plugins: {
                plugin: {
                    groupId: "org.springframework.boot",
                    artifactId: "spring-boot-maven-plugin",
                    configuration: {
                        excludes: {
                            exclude: {
                                groupId: "org.projectlombok",
                                artifactId: "lombok"
                            }
                        }
                    }
                }
            }
        }
    }
}

const bootstrapDir = path.join(path.dirname(ROOT_POM), "bootstrap");
if (!fs.existsSync(bootstrapDir)) {
    fs.mkdirSync(bootstrapDir, { recursive: true });
}

fs.writeFileSync(
    path.join(bootstrapDir, "pom.xml"),
    builder.build(bootstrapPom),
    "utf8"
);

console.log("========================================");
console.log("Bootstrap pom.xml successfully generated.");
console.log("========================================");
