// 签到核心逻辑（已移除精力/气血系统）

import { REDIS_YUNZAI_DEER_PIPE } from '../constants/core.js';
import { redisExistAndGetKey, redisSetKey } from '../utils/redis.js';
import { generateImage } from '../utils/image.js';

export class SignApp extends plugin {
    constructor() {
        super({
            name: "🦌管签到",
            dsc: "签到与补签",
            event: "message",
            priority: 5000,
            rule: [
                {
                    reg: "^(🦌|🦒|鹿|打胶)$",
                    fnc: "sign",
                },
                {
                    reg: "^补(🦌|🦒|鹿|打胶)\\s*[0-9]+$",
                    fnc: "makeupSign",
                }
            ]
        })
    }

    /**
     * 执行签到
     * @param {object} e 事件对象
     */
    async sign(e) {
        const { user_id, nickname, card } = e.sender;
        const userId = parseInt(user_id);
        const date = new Date();
        const day = date.getDate();

        // 记录签到
        const todayCount = await this.recordSign(userId, day, false);

        // 同一天仅第一次签到发送图片，后续仅返回次数提示
        if (todayCount > 1) {
            await e.reply(`✅ 今日已鹿 ${todayCount} 次\n📷 图片请使用 #鹿鹿查询 查看`);
            return;
        }

        const signData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const raw = await generateImage(date, card || nickname, signData[userId] || {}, null);
        await e.reply([`✅ 鹿鹿成功，今日第 ${todayCount} 次`, segment.image(raw)]);
    }

    /**
     * 补签
     * @param {object} e 事件对象
     */
    async makeupSign(e) {
        const day = parseInt(/\d+/.exec(e.msg.trim())[0]);
        const nowDay = new Date().getDate();
        if (day > nowDay || day === 0) {
            await e.reply("❌ 只能补签过去的日期");
            return;
        }

        const { user_id, nickname, card } = e.sender;
        const userId = parseInt(user_id);

        const beforeSignData = await this.getSignData(userId, day);
        if (beforeSignData && beforeSignData > 0) {
            await e.reply("❌ 该日期已经签到过了");
            return;
        }

        await this.recordSign(userId, day, true);

        const signData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const raw = await generateImage(new Date(), card || nickname, signData[userId] || {}, null);
        await e.reply(["✅ 补鹿成功", segment.image(raw)]);
    }

    /**
     * 记录签到
     * @param {number} userId 用户ID
     * @param {number} day 日期
     * @param {boolean} isMakeup 是否补签
     */
    async recordSign(userId, day, isMakeup = false) {
        const currentMonth = new Date().getMonth() + 1;
        let deerData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};

        if (!deerData[userId] || deerData[userId].lastSignMonth !== currentMonth) {
            deerData[userId] = { lastSignMonth: currentMonth };
        }

        const dayKey = String(day);
        if (deerData[userId][dayKey] === undefined) {
            deerData[userId][dayKey] = 0;
        }

        if (isMakeup) {
            deerData[userId][dayKey] = 1;
        } else {
            deerData[userId][dayKey] += 1;
        }

        await redisSetKey(REDIS_YUNZAI_DEER_PIPE, deerData);
        return deerData[userId][dayKey];
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
