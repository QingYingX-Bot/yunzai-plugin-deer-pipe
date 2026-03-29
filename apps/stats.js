// 统计功能

import { REDIS_YUNZAI_DEER_PIPE } from '../constants/core.js';
import { redisExistAndGetKey } from '../utils/redis.js';

export class StatsApp extends plugin {
    constructor() {
        super({
            name: "🦌管统计",
            dsc: "群统计和全局统计",
            event: "message",
            priority: 5000,
            rule: [
                {
                    reg: "^#鹿鹿统计$",
                    fnc: "groupStats",
                },
                {
                    reg: "^#总鹿鹿统计$",
                    fnc: "totalStats",
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
     * 群统计
     * @param {object} e 事件对象
     */
    async groupStats(e) {
        if (!e.group_id) {
            await e.reply("此功能只能在群聊中使用~");
            return;
        }

        const currentMonth = new Date().getMonth() + 1;
        const signData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        const curGroup = e.group || Bot?.pickGroup(e.group_id);
        const membersMap = await curGroup?.getMemberMap();
        
        if (!membersMap) {
            await e.reply("获取群成员信息失败~");
            return;
        }

        let groupTotalCount = 0;
        let groupActiveUsers = 0;
        let groupActiveDays = 0;
        const userStats = [];

        for (const [userId, member] of membersMap) {
            const userData = signData[userId];
            if (userData && userData.lastSignMonth === currentMonth) {
                let userTotalCount = 0;
                let userActiveDays = 0;
                for (const day in userData) {
                    if (day !== 'lastSignMonth' && !day.startsWith('w_') && userData[day] > 0) {
                        userTotalCount += userData[day];
                        userActiveDays++;
                    }
                }
                if (userTotalCount > 0) {
                    groupTotalCount += userTotalCount;
                    groupActiveUsers++;
                    groupActiveDays += userActiveDays;
                    userStats.push({
                        name: this.filterMessageContent(member.card || member.nickname),
                        count: userTotalCount,
                        days: userActiveDays
                    });
                }
            }
        }

        userStats.sort((a, b) => b.count - a.count);

        let statsText = `📊 群聊鹿鹿统计\n📅 统计月份：${currentMonth}月\n🦌 群总次数：${groupTotalCount}次\n👥 活跃用户：${groupActiveUsers}人\n📆 总活跃天数：${groupActiveDays}天`;
        
        if (userStats.length > 0) {
            const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
            statsText += `\n\n🏆 排行榜：\n`;
            userStats.slice(0, 5).forEach((user, index) => {
                statsText += `${medals[index]} ${user.name}: ${user.count}次 (${user.days}天)\n`;
            });
        }

        await e.reply(statsText);
    }

    /**
     * 全局统计
     * @param {object} e 事件对象
     */
    async totalStats(e) {
        const currentMonth = new Date().getMonth() + 1;
        const signData = await redisExistAndGetKey(REDIS_YUNZAI_DEER_PIPE) || {};
        
        let globalTotalCount = 0;
        let globalActiveUsers = 0;
        let globalActiveDays = 0;

        for (const userId in signData) {
            const userData = signData[userId];
            if (userData && userData.lastSignMonth === currentMonth) {
                let userTotalCount = 0;
                let userActiveDays = 0;
                for (const day in userData) {
                    if (day !== 'lastSignMonth' && !day.startsWith('w_') && userData[day] > 0) {
                        userTotalCount += userData[day];
                        userActiveDays++;
                    }
                }
                if (userTotalCount > 0) {
                    globalTotalCount += userTotalCount;
                    globalActiveUsers++;
                    globalActiveDays += userActiveDays;
                }
            }
        }

        let statsText = `📊 全局鹿鹿统计\n📅 统计月份：${currentMonth}月\n🦌 全局总次数：${globalTotalCount}次\n👥 活跃用户：${globalActiveUsers}人\n📆 总活跃天数：${globalActiveDays}天`;
        
        if (globalActiveDays > 0 || globalActiveUsers > 0) {
            const avgCount = globalActiveDays > 0 ? Math.floor(globalTotalCount / globalActiveDays) : 0;
            const avgUser = globalActiveUsers > 0 ? Math.floor(globalTotalCount / globalActiveUsers) : 0;
            statsText += `\n📈 平均每天：${avgCount}次\n👤 平均每人：${avgUser}次`;
        }

        await e.reply(statsText);
    }
}