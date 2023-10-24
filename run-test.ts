import { run } from "node:test";
import { spec } from "node:test/reporters";
import process from "node:process";
import * as fs from "node:fs";
import * as path from "node:path";

let root = path.join(process.cwd(), "src");

let testName = process.argv
	.filter(arg => arg.startsWith("--test-name="))
	.map(arg => arg.slice("--test-name=".length));

const tsTests = fs.readdirSync(root, { recursive: true, encoding: 'utf8' })
	.filter(path => {
		if (typeof path === 'string') {
			return path.endsWith(".test.ts")
		}

		return false;
	})
	.filter(path => {
		if (testName.length === 0) {
			return true;
		}

		return testName.some(name => path.endsWith(`${name}.test.ts`));
	})
	.map(testPath => {
		return path.resolve(path.join(root, testPath))
	})

let stream = run({ files: tsTests }).compose(new spec()).pipe(process.stdout);

stream.once("end", () => {
	console.log("Test Done");
})