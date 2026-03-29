// Redis工具函数
export async function redisExistAndGetKey(key) {
    if (await redis.exists(key)) {
        return JSON.parse(await redis.get(key));
    }
    return null;
}

export async function redisSetKey(key, value = {}) {
    return redis.set(key, JSON.stringify(value));
}

export async function redisDeleteKey(key) {
    return redis.del(key);
}