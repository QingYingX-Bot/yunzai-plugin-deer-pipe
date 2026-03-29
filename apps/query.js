// 查询功能（已移除精力/气血相关）

import { REDIS_YUNZAI_DEER_PIPE } from '../constants/core.js';
import { redisExistAndGetKey } from '../utils/redis.js';
import { generateImage } from '../utils/image.js';

export class QueryApp extends plugin {
    constructor() {
        super({
            name: "🦌管查询",
            dsc: "查询签到",
            event: "message",
            priority: 5000,
            rule: [
                {
                    reg: "^#鹿鹿查询$",
                    fnc: "viewSign",
                }
            ]
        })
    }

    /**
     * 过滤消息内容
     * @param {string} text 文本
     * @returns {string} 过滤后的文本
     */
    filterMessageContent(text) {
        if (!text) return '';
        return text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\-_()（）【】\[\]{}，。！？、：；""''…~@#$%^&*+=|\\/<>]/g, '');
    }

    /**
     * 查看签到
     * @param {object} e 事件对象
     */
    async viewSign(e) {
        let user, isAt = false;
        if (e.at) {
            const curGroup = e.group || Bot?.pickGroup(e.group_id);
            const membersMap = await curGroup?.getMemberMap();
            user = membersMap.get(parseInt(e.at));
            isAt = true;
        } else {
            user = e.sender;
        }

        const { user_id, nickname, card } = user;
        const userId = parseInt(user_id);
        const date = new Date();
        const signData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const curMonth = date.getMonth() + 1;

        if (!signData[userId] || signData[userId].lastSignMonth !== curMonth) {
            await e.reply(isAt ? "ta本月还没有🦌过呢~" : "你本月还没有🦌过呢~");
            return;
        }

        let totalCount = 0;
        let activeDays = 0;
        for (const day in signData[userId]) {
            if (day !== 'lastSignMonth' && !day.startsWith('w_') && signData[userId][day] > 0) {
                totalCount += signData[userId][day];
                activeDays++;
            }
        }
        const avgCount = activeDays > 0 ? Math.floor(totalCount / activeDays) : 0;
        const displayName = this.filterMessageContent(card || nickname);

        const raw = await generateImage(date, card || nickname, signData[userId], null);
        const statsText = `📊 ${displayName} 的鹿鹿查询\n📅 统计月份：${curMonth}月\n🦌 总次数：${totalCount}次\n📆 活跃天数：${activeDays}天\n📈 平均每天：${avgCount}次`;

        await e.reply([statsText, segment.image(raw)]);
    }
}
