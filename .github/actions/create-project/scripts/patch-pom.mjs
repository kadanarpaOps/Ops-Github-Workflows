import fs from "node:fs";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

const POM_FILE = process.argv[2] ?? "pom.xml";

if (!fs.existsSync(POM_FILE)) {
    console.error(`ERROR: ${POM_FILE} not found.`);
    process.exit(1);
}

console.log(`Reading ${POM_FILE}...`);

const xml = fs.readFileSync(POM_FILE, "utf8");

const parser = new XMLParser({
    ignoreAttributes: false,
    preserveOrder: false,
    trimValues: false,
});

const pom = parser.parse(xml);

if (!pom.project) {
    console.error("ERROR: Invalid Maven POM. <project> element not found.");
    process.exit(1);
}

const project = pom.project;

/*
 * ============================================================
 * Project version
 * ============================================================
 *
 * IMPORTANT:
 * This modifies the project's version, NOT the Spring Boot
 * parent version.
 */

project.version = "0.1.0-SNAPSHOT";

/*
 * ============================================================
 * Packaging
 * ============================================================
 */

project.packaging = "pom";

/*
 * ============================================================
 * Remove Spring Initializr metadata
 * ============================================================
 */

delete project.url;
delete project.licenses;
delete project.developers;
delete project.scm;

/*
 * ============================================================
 * Properties
 * ============================================================
 */

project.properties ??= {};

project.properties["sonar.junit.reportPaths"] =
    "**/target/surefire-reports";

project.properties["sonar.coverage.jacoco.xmlReportPaths"] =
    "**/target/coverage-reports/jacoco-ut/jacoco.xml";

project.properties["sonar.coverage.exclusions"] =
    [
        "**/common/**",
        "**/domain/**",
        "**/repository/**",
        "**/dto/**",
        "**/handler/**",
        "**/config/**",
        "**/*Application.java",
    ].join(",");

/*
 * ============================================================
 * Build
 * ============================================================
 */

project.build ??= {};
project.build.plugins ??= [];

/*
 * Remove Spring Boot Maven Plugin.
 *
 * Initializr normally generates this plugin for an executable
 * Spring Boot application.
 *
 * This project is being converted into a parent POM, so we
 * remove it from the parent.
 */

if (Array.isArray(project.build.plugins)) {
    project.build.plugins = project.build.plugins.filter((plugin) => {
        return plugin.artifactId !== "spring-boot-maven-plugin";
    });
}

/*
 * ============================================================
 * Coverage Profile
 * ============================================================
 */

project.profiles ??= {};

const coverageProfile = {
    id: "coverage",

    activation: {
        activeByDefault: true,
    },

    build: {
        plugins: [
            {
                groupId: "org.apache.maven.plugins",
                artifactId: "maven-surefire-plugin",
                version: "3.0.0-M5",

                configuration: {
                    argLine: "${surefireArgLine}",
                },
            },

            {
                groupId: "org.sonarsource.scanner.maven",
                artifactId: "sonar-maven-plugin",
                version: "3.8.0.2131",
            },

            {
                groupId: "org.jacoco",
                artifactId: "jacoco-maven-plugin",
                version: "0.8.8",

                executions: {
                    execution: [
                        {
                            id: "prepare-agent",

                            goals: {
                                goal: "prepare-agent",
                            },

                            configuration: {
                                destFile:
                                    "${project.build.directory}/coverage-reports/jacoco-ut.exec",

                                propertyName: "surefireArgLine",
                            },
                        },

                        {
                            id: "post-unit-test",

                            phase: "test",

                            goals: {
                                goal: "report",
                            },

                            configuration: {
                                dataFile:
                                    "${project.build.directory}/coverage-reports/jacoco-ut.exec",

                                outputDirectory:
                                    "${project.build.directory}/coverage-reports/jacoco-ut",
                            },
                        },
                    ],
                },
            },
        ],
    },
};

/*
 * fast-xml-parser represents a single <profile> as an object
 * and multiple <profile> elements as an array.
 *
 * Normalize that here so we can safely replace the coverage
 * profile.
 */

if (!project.profiles.profile) {
    project.profiles.profile = [];
} else if (!Array.isArray(project.profiles.profile)) {
    project.profiles.profile = [project.profiles.profile];
}

project.profiles.profile = project.profiles.profile.filter(
    (profile) => profile.id !== "coverage"
);

project.profiles.profile.push(coverageProfile);

/*
 * ============================================================
 * Build final XML
 * ============================================================
 */

const builder = new XMLBuilder({
    ignoreAttributes: false,

    format: true,
    indentBy: "    ",

    suppressEmptyNode: false,

    suppressBooleanAttributes: false,

    declaration: {
        encoding: "UTF-8",
    },
});

const finalPom = builder.build(pom);

fs.writeFileSync(POM_FILE, finalPom, "utf8");

console.log("========================================");
console.log("pom.xml successfully patched.");
console.log("========================================");

const filesToDelete = ['.gitattributes', 'HELP.md', 'mvnw', 'mvnw.cmd'];

filesToDelete.forEach(file => {
    try {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`Successfully Deleted: ${file}`);
        } else {
            console.log(`File not found, skipping: ${file}`);
        }
    } catch (ex) {
        console.error(`Error Deleting file: ${file}`);
    }
});
