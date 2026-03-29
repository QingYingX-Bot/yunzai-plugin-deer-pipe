import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

if (!global.segment) {
    global.segment = (await import("oicq")).segment;
}

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const pluginName = packageJson.name;

logger.info(logger.yellow(`🦌管插件（${pluginName}）初始化`));

const files = fs.readdirSync(path.join(__dirname, 'apps')).filter(file => file.endsWith(".js"));
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
