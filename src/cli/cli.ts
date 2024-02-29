#!/usr/bin/env node
import * as dotenv from "dotenv";
dotenv.config();
import { textSync } from "figlet";
import chalk from "chalk";
import { InquirerUIProvider } from "../ui/InquirerUIProvider";
import { startup } from "./startup";

async function main() {
  require("ts-node/register");
  console.debug = function () {};

  showTitle();

  const ui = new InquirerUIProvider();

  await startup(ui);

  ui.close();
}

process.on("SIGINT", () => {
  process.exit(130);
});

main()
  .catch(console.error)
  .then(() => process.exit(0));

function showTitle() {
  const orange = chalk.hex("#ce7f33");
  console.log(orange(textSync("Tonnel", "ANSI Shadow")));
}
export { startup };
