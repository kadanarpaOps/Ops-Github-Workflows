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
 * trimValues: true ---------> Removes unnecessary whitespace around XML values.
 * ignoreAttributes: false --> Keeps Maven namespace attributes.
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
 * Modifies the project's version.
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
 * Modules
 * ============================================================
 */
project.modules = {
    module: ["bootstrap"]
};

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
 * Canonical Maven Project Order
 * ============================================================
 */

const preferredOrder = [
    "@_xmlns",
    "@_xmlns:xsi",
    "@_xsi:schemaLocation",
    "modelVersion",
    "parent",
    "groupId",
    "artifactId",
    "version",
    "packaging",
    "name",
    "modules",
    "description",
    "properties",
    "dependencies",
    "dependencyManagement",
    "build",
    "profiles",
];

/*
 * Create a new object following the preferred order.
 */
const orderedProject = {};

for (const key of preferredOrder) {
    if (Object.prototype.hasOwnProperty.call(project, key)) {
        orderedProject[key] = project[key];
    }
}

for (const [key, value] of Object.entries(project)) {
    if (!Object.prototype.hasOwnProperty.call(orderedProject, key)) {
        orderedProject[key] = value;
    }
}

pom.project = orderedProject;

/*
 * ============================================================
 * XML Builder
 * ============================================================
 *
 * format: true
 * -----------
 * Pretty prints the XML.
 *
 * indentBy: "\t"
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
    indentBy: "\t",
    suppressEmptyNode: true,
    suppressBooleanAttributes: false,
    declaration: {
        encoding: "UTF-8",
    },
});

let finalPom = builder.build(pom);

/*
 * ============================================================
 * Add Visual Separation Between Major Maven Sections
 * ============================================================
 */
const majorSections = [
    "parent",
    "groupId",
    "modules",
    "properties",
    "dependencies",
    "dependencyManagement",
    "build",
    "profiles",
];

for (const section of majorSections) {
    const regex = new RegExp(
        `\\n\\t<${section}(\\s|>)`,
        "g"
    );

    finalPom = finalPom.replace(
        regex,
        `\n\n\t<${section}$1`
    );
}

finalPom = finalPom.replace(
    /\n<\/project>$/,
    "\n\n</project>"
);

fs.writeFileSync(POM_FILE, finalPom, "utf8");

console.log("========================================");
console.log("pom.xml successfully patched.");
console.log("========================================");
