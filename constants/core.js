import path from "path";

const packageJsonPath = path.resolve(path.join('./plugins', 'yunzai-plugin-deer-pipe'));

// 本地资源
export const CHECK_IMG = `${packageJsonPath}/assets/check@96x100.png`;
export const WRONG_IMG = `${packageJsonPath}/assets/wrong@96x100.png`;
export const DEERPIPE_IMG = `${packageJsonPath}/assets/deerpipe@100x82.png`;

// redis存储位置
export const REDIS_YUNZAI_DEER_PIPE = "Yz:deer_pipe:core:sign";

// 体力系统存储位置（精力/肾气系统）
export const REDIS_YUNZAI_DEER_PIPE_ENERGY = "Yz:deer_pipe:core:vitality";
