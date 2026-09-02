import fs from "node:fs";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

const POM_FILE = process.argv[2] ?? "pom.xml";

if (!fs.existsSync(POM_FILE)) {
    console.error(`ERROR: ${POM_FILE} not found.`);
    process.exit(1);
}

console.log(`Reading ${POM_FILE}...`);

const xml = fs.readFileSync(POM_FILE, "utf8");

/*
 * ============================================================
 * XML Parser
 * ============================================================
 *
 * trimValues: true
 * ----------------
 * Removes unnecessary whitespace around XML values.
 *
 * ignoreAttributes: false
 * -----------------------
 * Keeps Maven namespace attributes.
 */

const parser = new XMLParser({
    ignoreAttributes: false,
    preserveOrder: false,
    trimValues: true,
});

const pom = parser.parse(xml);

if (!pom.project) {
    console.error("ERROR: Invalid Maven POM. <project> element not found.");
    process.exit(1);
}

const project = pom.project;

/*
 * ============================================================
 * Project Version
 * ============================================================
 *
 * IMPORTANT:
 * This modifies the project's version.
 *
 * It does NOT modify:
 *
 * <parent>
 *     <version>...</version>
 * </parent>
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
 * Remove Spring Initializr Metadata
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

project.properties["sonar.coverage.exclusions"] = [
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
project.build.plugins ??= {};

/*
 * fast-xml-parser can represent:

 * <plugin>...</plugin>
 * <plugin>...</plugin>

 * as either an object or an array depending on how many
 * elements exist.

 * Normalize it to an array so we can safely manipulate it.
 */

if (!project.build.plugins.plugin) {
    project.build.plugins.plugin = [];
} else if (!Array.isArray(project.build.plugins.plugin)) {
    project.build.plugins.plugin = [
        project.build.plugins.plugin,
    ];
}

/*
 * ============================================================
 * Remove Spring Boot Maven Plugin
 * ============================================================
 *
 * Spring Initializr creates this plugin automatically.
 *
 * Since this POM is being converted into a parent POM,
 * we don't want the Spring Boot executable plugin here.
 */

project.build.plugins.plugin =
    project.build.plugins.plugin.filter(
        (plugin) =>
            plugin.artifactId !==
            "spring-boot-maven-plugin"
    );

/*
 * ============================================================
 * Coverage Profile
 * ============================================================
 */

project.profiles ??= {};

if (!project.profiles.profile) {
    project.profiles.profile = [];
} else if (!Array.isArray(project.profiles.profile)) {
    project.profiles.profile = [
        project.profiles.profile,
    ];
}

/*
 * Remove an existing coverage profile.
 *
 * This prevents duplicated profiles if the script is executed
 * more than once.
 */

project.profiles.profile =
    project.profiles.profile.filter(
        (profile) => profile.id !== "coverage"
    );

/*
 * ============================================================
 * Coverage Profile Definition
 * ============================================================
 *
 * IMPORTANT:
 *
 * XML structure:
 *
 * <build>
 *     <plugins>
 *         <plugin>
 *         </plugin>
 *     </plugins>
 * </build>
 *
 * Therefore the JavaScript structure must be:
 *
 * build: {
 *     plugins: {
 *         plugin: [...]
 *     }
 * }
 */

const coverageProfile = {
    id: "coverage",

    activation: {
        activeByDefault: true,
    },

    build: {
        plugins: {
            plugin: [
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

                                    propertyName:
                                        "surefireArgLine",
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
    },
};

project.profiles.profile.push(coverageProfile);

/*
 * ============================================================
 * XML Builder
 * ============================================================
 *
 * format: true
 * -----------
 * Pretty prints the XML.
 *
 * indentBy: "    "
 * ----------------
 * Four spaces per XML level.
 *
 * suppressEmptyNode: true
 * -----------------------
 * Converts:
 *
 * <relativePath></relativePath>
 *
 * into:
 *
 * <relativePath/>
 */

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

const finalPom = builder.build(pom);

fs.writeFileSync(POM_FILE, finalPom, "utf8");

console.log("========================================");
console.log("pom.xml successfully patched.");
console.log("========================================");

/*
 * ============================================================
 * Remove Unnecessary Spring Initializr Files
 * ============================================================
 */

const filesToDelete = [
    ".gitattributes",
    "HELP.md",
    "mvnw",
    "mvnw.cmd",
];

filesToDelete.forEach((file) => {
    try {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`Successfully Deleted: ${file}`);
        } else {
            console.log(`File not found, skipping: ${file}`);
        }
    } catch (error) {
        console.error(`Error deleting file: ${file}`);
    }
});