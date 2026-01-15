import fs from "node:fs";
import path from "path";
import config from "./model/config.js";

if (!global.segment) {
    global.segment = (await import("oicq")).segment;
}

const versionData = config.getConfig("version");
const packageJsonPath = path.join('./plugins', 'yunzai-plugin-deer-pipe', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const pluginName = packageJson.name;

logger.info(logger.yellow(`🦌管插件（yunzai-plugin-deer-pipe）：${versionData[0].version}初始化`));

const files = fs.readdirSync(`./plugins/${pluginName}/apps`).filter(file => file.endsWith(".js"));
const ret = await Promise.allSettled(files.map(file => import(`./apps/${file}`)));

const apps = {};
for (let i = 0; i < files.length; i++) {
    const name = files[i].replace(".js", "");
    if (ret[i].status !== "fulfilled") {
        logger.error(`载入插件错误：${logger.red(name)}`);
        logger.error(ret[i].reason);
        continue;
    }
    apps[name] = ret[i].value[Object.keys(ret[i].value)[0]];
}

export { apps };
