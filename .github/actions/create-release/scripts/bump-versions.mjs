import fs from "node:fs";
import { XMLParser } from "fast-xml-parser";

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

const ROOT_POM_PATH = process.argv[2] ?? "pom.xml";
const NEXT_VERSION = process.argv[3];

if (!NEXT_VERSION) {
    console.error("ERROR: No new version was provided.");
    process.exit(1);
}

const rootPom = verifyPom(ROOT_POM_PATH);
rootPom.project.version = NEXT_VERSION;
writePom(ROOT_POM_PATH, rootPom);
console.log(`Updated ${ROOT_POM_PATH} -> version: ${NEXT_VERSION}`);
