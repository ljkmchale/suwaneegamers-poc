import { loadDotEnv } from "./env.mjs";
loadDotEnv();

import { answerQuestion } from "./query.mjs";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: npm run ask -- "What do we know about Lila?"');
  process.exit(1);
}

answerQuestion(question).then((result) => {
  console.log(result.answer);
  console.log("\nSources:");
  for (const source of result.sources) {
    console.log(`- ${source.path} (${source.heading}, ${source.score})`);
  }
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
