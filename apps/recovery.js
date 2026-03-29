// 恢复机制（休息、戒鹿）- 已移除精力/气血，仅保留戒鹿记录

import { REDIS_YUNZAI_DEER_PIPE } from '../constants/core.js';
import { redisExistAndGetKey, redisSetKey } from '../utils/redis.js';
import { generateImage } from '../utils/image.js';

const MSG_ENERGY_REMOVED = "精力/气血系统已移除，该功能暂不可用。";

export class RecoveryApp extends plugin {
    constructor() {
        super({
            name: "🦌管恢复",
            dsc: "戒鹿记录（休息/精力已移除）",
            event: "message",
            priority: 5000,
            rule: [
                {
                    reg: "^#休息$",
                    fnc: "rest",
                },
                {
                    reg: "^#查询休息$",
                    fnc: "queryRest",
                },
                {
                    reg: "^戒(🦌|🦒|鹿|打胶)\\s*[0-9]*$",
                    fnc: "abstinence",
                }
            ]
        })
    }

    /** 休息指令 - 精力系统已移除 */
    async rest(e) {
        await e.reply(MSG_ENERGY_REMOVED);
    }

    /** 查询休息 - 精力系统已移除 */
    async queryRest(e) {
        await e.reply(MSG_ENERGY_REMOVED);
    }

    /**
     * 戒鹿指令（仅记录戒鹿日期，不再更新精力/气血）
     * @param {object} e 事件对象
     */
    async abstinence(e) {
        const { user_id, nickname, card } = e.sender;
        const userId = parseInt(user_id);
        const nowDay = new Date().getDate();
        let day = parseInt(/\d+/.exec(e.msg.trim())?.[0] || nowDay);

        if (day > nowDay || day === 0) {
            await e.reply("❌ 只能记录过去的日期");
            return;
        }

        // 检查今天是否已经签到（已签到则不能记戒鹿）
        if (day === nowDay) {
            const signData = await this.getSignData(userId, day);
            if (signData && signData > 0) {
                await e.reply("❌ 你今天已经破戒了");
                return;
            }
        }

        await this.recordAbstinence(userId, day);

        const signData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const raw = await generateImage(new Date(), card || nickname, signData[userId] || {}, null);
        await e.reply(["✅ 成功戒鹿", segment.image(raw)]);
    }

    /**
     * 记录戒鹿
     * @param {number} userId 用户ID
     * @param {number} day 日期
     */
    async recordAbstinence(userId, day) {
        const currentMonth = new Date().getMonth() + 1;
        let deerData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};

        if (!deerData[userId] || deerData[userId].lastSignMonth !== currentMonth) {
            deerData[userId] = { lastSignMonth: currentMonth };
        }

        const dayKey = `w_${day}`;
        if (deerData[userId][dayKey] === undefined) {
            deerData[userId][dayKey] = 0;
        }

        deerData[userId][dayKey] += 1;
        await redisSetKey(REDIS_YUNZAI_DEER_PIPE, deerData);
    }

    /**
     * 获取签到数据
     * @param {number} userId 用户ID
     * @param {number} day 日期
     * @returns {Promise<number>} 签到次数
     */
    async getSignData(userId, day) {
        const deerData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const dayKey = String(day);
        if (!deerData[userId]) {
            return undefined;
        }
        return deerData[userId][dayKey];
    }
}
