import fs from "node:fs";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
    ignoreAttributes: false,
    preserveOrder: false,
    trimValues: true,
});

function verifyPom(pomPath) {
    if (!fs.existsSync(pomPath)) {
        console.error(`ERROR: ${pomPath} not found.`);
        process.exit(1);
    }
    return parser.parse(fs.readFileSync(pomPath, "utf8"));
}

const ROOT_POM_PATH = process.argv[2] ?? "pom.xml";
const targetPom = verifyPom(ROOT_POM_PATH);

if (!targetPom.project?.version) {
    console.error(`ERROR: Not Version found in ${ROOT_POM_PATH}`);
    process.exit(1);
}

const pomVersion = pom.project.version;
const version = pomVersion.replace("-SNAPSHOT", "");
console.log(`Current Version in ${ROOT_POM_PATH}: ${version}`);

fs.appendFileSync(process.env.GITHUB_OUTPUT, `actual-version=${version}\n`);
