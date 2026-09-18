import fs from "node:fs";
import path from "node:path";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

const parser = new XMLParser({
    ignoreAttributes: false,
    preserveOrder: false,
    trimValues: true,
});

const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: "\t",
    suppressEmptyNode: true,
    suppressBooleanAttributes: false,
    declaration: { encoding: "UTF-8" },
});

function verifyPom(pomPath) {
    if (!fs.existsSync(pomPath)) {
        console.error(`ERROR: ${pomPath} not found.`);
        process.exit(1);
    }
    return parser.parse(fs.readFileSync(pomPath, "utf8"));
}

function writePom(pomPath, pom) {
    fs.writeFileSync(pomPath, builder.build(pom), "utf8");
}

function toArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
}

function getDirectoriesWithPom(rootDir) {
    return fs.readdirSync(rootDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => fs.existsSync(path.join(rootDir, name, "pom.xml")));
}

function verifyDeclaredModules(rootPom, rootDir) {
    const declaredModules = toArray(rootPom.project?.modules?.module);
    const directoriesWithPom = getDirectoriesWithPom(rootDir);

    console.log(`Modules declared in <modules>: [${declaredModules.join(", ")}] (${declaredModules.length})`);
    console.log(`Directories containing a pom.xml: [${directoriesWithPom.join(", ")}] (${directoriesWithPom.length})`);

    if (declaredModules.length === 0) {
        console.log(`WARNING: No modules declared in root pom.xml: `);
        process.exit(1);
    }

    if (declaredModules.length !== directoriesWithPom.length) {
        const declaredSet = new Set(declaredModules);
        const dirSet = new Set(directoriesWithPom);

        const declaredButMissingDir = declaredModules.filter((m) => !dirSet.has(m));
        const dirButNotDeclared = directoriesWithPom.filter((d) => !declaredSet.has(d));

        console.error(`ERROR: Mismatch between declared modules (${declaredModules.length}) and directories containing a pom.xml (${directoriesWithPom.length}).`);
        if (declaredButMissingDir.length > 0) {
            console.error(`  Declared in <modules> but missing an actual pom.xml directory: [${declaredButMissingDir.join(", ")}]`);
        }
        if (dirButNotDeclared.length > 0) {
            console.error(`  Directory has a pom.xml but is NOT declared in <modules>: [${dirButNotDeclared.join(", ")}]`);
        }
        process.exit(1);
    }

    console.log("SUCCESS: Declared modules and pom.xml directories match.");
    return declaredModules;
}

const ROOT_POM_PATH = process.argv[2] ?? "pom.xml";
const NEXT_VERSION = process.argv[3];

if (!NEXT_VERSION) {
    console.error("ERROR: No new version was provided.");
    process.exit(1);
}

const rootPom = verifyPom(ROOT_POM_PATH);
const rootDir = path.dirname(path.resolve(ROOT_POM_PATH));
const rootArtifactId = rootPom.project?.artifactId;

const modules = verifyDeclaredModules(rootPom, rootDir);

console.log('Writing root pom.xml >>>');
rootPom.project.version = NEXT_VERSION;
writePom(ROOT_POM_PATH, rootPom);
console.log(`Updated ${ROOT_POM_PATH} -> version: ${NEXT_VERSION}`);

console.log('Writing modules pom.xml >>>');
for (const module of modules) {
    const modulePath = path.join(rootDir, module, "pom.xml");
    const modulePom = verifyPom(modulePath);
    const parent = modulePom.project?.parent;

    if (!parent) {
        console.error(`WARNING: ${modulePath} has no <parent> block. Skipping.`);
        continue;
    }
    console.log(`VALIDATION: ${modulePath} <parent> tag exists`);

    if (rootArtifactId && parent.artifactId !== rootArtifactId) {
        console.error(`WARNING: ${modulePath} <parent><artifactId> is '${parent.artifactId}', expected '${rootArtifactId}'. Skipping to avoid touching an unrelated parent.`);
        continue;
    }
    console.log(`VALIDATION: ${modulePath} <parent><artifactId> tag coincides with the Root Parent Artifact ID`);

    parent.version = NEXT_VERSION;
    writePom(modulePath, modulePom);
    console.log(`Updated ${modulePath} -> parent version: ${NEXT_VERSION}`);

}

console.log("SUCCESS: All pom.xml has been updated >>>")
